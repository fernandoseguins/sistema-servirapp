-- =====================================================================
-- Aprovação/rejeição de pedido de troca de forma atômica
--
-- Antes o navegador fazia 4–7 escritas separadas em schedule_roles e
-- swap_requests. Se a conexão caísse no meio, a escala ficava inconsistente.
-- Agora tudo acontece numa única transação dentro de responder_troca().
--
-- Regras (iguais às que existiam no cliente):
--   * funções do papel são uma string juntada com ' + ' (ex.: 'Voz + Violão');
--     na leitura aceitamos '+' ou '/' como separador;
--   * funções trocadas = swap_requests.funcoes_alvo (ou todas as do papel original);
--   * troca total (não sobra função ao solicitante):
--       - substituto já escalado: funções mescladas no papel dele e o papel
--         original é apagado;
--       - senão: o papel original passa para o substituto (user_id);
--   * troca parcial (sobram funções ao solicitante):
--       - papel original fica só com as funções restantes;
--       - substituto já escalado: funções mescladas no papel dele;
--       - senão: novo papel para o substituto com status 'Confirmado'.
-- =====================================================================

-- Separa 'Voz + Violão' / 'Voz/Violão' em {Voz,Violão}, sem itens vazios
create or replace function public.separar_funcoes(p_funcao text)
returns text[]
language sql immutable
set search_path = public
as $$
  select coalesce(array_agg(t order by ord), '{}'::text[])
  from (
    select regexp_replace(parte, '^\s+|\s+$', '', 'g') as t, ord
    from unnest(regexp_split_to_array(coalesce(p_funcao, ''), '[+/]')) with ordinality as u(parte, ord)
  ) q
  where t <> '';
$$;

revoke all on function public.separar_funcoes(text) from public, anon;
grant execute on function public.separar_funcoes(text) to authenticated;

-- Responde (aprova/rejeita) um pedido de troca.
-- Retorna as funções trocadas (texto) quando aprovada; null quando rejeitada.
create or replace function public.responder_troca(p_pedido_id uuid, p_aprovar boolean)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_pedido        swap_requests%rowtype;
  v_departamento  uuid;
  v_original      schedule_roles%rowtype;
  v_sub           schedule_roles%rowtype;
  v_tem_sub       boolean;
  v_trocadas_str  text;
  v_trocadas      text[];
  v_restantes     text[];
  v_nova_funcao   text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;

  if p_pedido_id is null or p_aprovar is null then
    raise exception 'Parâmetros inválidos para responder a troca.';
  end if;

  -- Trava o pedido para evitar duas respostas simultâneas
  select * into v_pedido from swap_requests where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido de troca não encontrado.';
  end if;

  if v_pedido.status is distinct from 'pendente' then
    raise exception 'Este pedido de troca já foi respondido.';
  end if;

  select departamento_id into v_departamento from schedules where id = v_pedido.schedule_id;
  if v_departamento is null then
    raise exception 'Escala do pedido de troca não encontrada.';
  end if;

  -- Líder/admin do departamento, ou admin da igreja dona do departamento
  if not (
    eh_lider_do_departamento(v_departamento)
    or (eh_admin_da_igreja() and departamento_da_minha_igreja(v_departamento))
  ) then
    raise exception 'Apenas líderes ou administradores do departamento podem responder pedidos de troca.'
      using errcode = '42501';
  end if;

  if not p_aprovar then
    update swap_requests set status = 'rejeitada' where id = p_pedido_id;
    return null;
  end if;

  -- Papel original (de quem pediu a troca)
  select * into v_original
  from schedule_roles
  where id = v_pedido.role_id and schedule_id = v_pedido.schedule_id
  for update;
  if not found then
    raise exception 'A função original deste pedido não existe mais na escala.';
  end if;

  -- Papel que o substituto já tenha na mesma escala (se houver)
  select * into v_sub
  from schedule_roles
  where schedule_id = v_pedido.schedule_id and user_id = v_pedido.substitute_id
  order by id
  limit 1
  for update;
  v_tem_sub := found;

  if v_tem_sub and v_sub.id = v_original.id then
    raise exception 'O substituto não pode ser o próprio solicitante.';
  end if;

  v_trocadas_str := coalesce(nullif(v_pedido.funcoes_alvo, ''), v_original.funcao, '');
  v_trocadas     := separar_funcoes(v_trocadas_str);
  v_restantes    := array(
    select f
    from unnest(separar_funcoes(v_original.funcao)) with ordinality as u(f, ord)
    where f <> all (v_trocadas)
    order by ord
  );

  if v_tem_sub then
    -- Mescla as funções no papel do substituto, sem repetir, mantendo a ordem
    select string_agg(f, ' + ' order by primeira)
      into v_nova_funcao
    from (
      select f, min(ord) as primeira
      from unnest(separar_funcoes(v_sub.funcao) || v_trocadas) with ordinality as u(f, ord)
      group by f
    ) q;
  end if;

  if cardinality(v_restantes) = 0 then
    -- Troca total
    if v_tem_sub then
      update schedule_roles set funcao = v_nova_funcao where id = v_sub.id;
      delete from schedule_roles where id = v_original.id;
    else
      -- O substituto aceitou a troca: o papel passa para ele já confirmado
      -- (não herda 'Pendente'/'Recusado' de quem pediu a troca)
      update schedule_roles
         set user_id = v_pedido.substitute_id, status_confirmacao = 'Confirmado'
       where id = v_original.id;
    end if;
  else
    -- Troca parcial
    update schedule_roles set funcao = array_to_string(v_restantes, ' + ') where id = v_original.id;
    if v_tem_sub then
      update schedule_roles set funcao = v_nova_funcao where id = v_sub.id;
    else
      insert into schedule_roles (schedule_id, user_id, funcao, status_confirmacao)
      values (v_pedido.schedule_id, v_pedido.substitute_id, v_trocadas_str, 'Confirmado');
    end if;
  end if;

  update swap_requests set status = 'aprovada' where id = p_pedido_id;
  return v_trocadas_str;
end;
$$;

revoke all on function public.responder_troca(uuid, boolean) from public, anon;
grant execute on function public.responder_troca(uuid, boolean) to authenticated;
