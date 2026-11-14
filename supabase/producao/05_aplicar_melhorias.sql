-- 05_aplicar_melhorias.sql
-- Aplica, numa transação só: troca atômica, confirmação de presença e push em vários aparelhos.
-- Gerado a partir de supabase/migrations/20261114000001..03. Rode DEPOIS do 04 conferido.
-- Se der erro, nada é aplicado (rollback automático da transação).

begin;

-- ===================== 20261114000001_aprovar_troca_rpc.sql =====================
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

-- ===================== 20261114000002_confirmar_presenca.sql =====================
-- Confirmação de presença na escala.
--
-- Valores de schedule_roles.status_confirmacao: 'Pendente' | 'Confirmado' | 'Recusado'.
-- O membro responde pela RPC responder_escala (só o próprio papel, só escala futura).
-- Ao recusar, os líderes do departamento recebem uma notificação
-- (o INSERT em notifications dispara o push pelo webhook já existente).

-- Restringe os valores. NOT VALID: não verifica as linhas antigas, só as novas/alteradas.
alter table public.schedule_roles
  drop constraint if exists schedule_roles_status_confirmacao_check;
alter table public.schedule_roles
  add constraint schedule_roles_status_confirmacao_check
  check (status_confirmacao is null or status_confirmacao in ('Pendente', 'Confirmado', 'Recusado'))
  not valid;

create or replace function public.responder_escala(p_role_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_papel     schedule_roles%rowtype;
  v_escala    schedules%rowtype;
  v_hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  v_nome      text;
  v_dept_nome text;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('Confirmado', 'Recusado') then
    raise exception 'Status inválido: use Confirmado ou Recusado' using errcode = '22023';
  end if;

  select * into v_papel from schedule_roles where id = p_role_id for update;
  if not found then
    raise exception 'Papel não encontrado' using errcode = 'P0002';
  end if;

  if v_papel.user_id is distinct from v_uid then
    raise exception 'Você só pode responder a sua própria escala' using errcode = '42501';
  end if;

  select * into v_escala from schedules where id = v_papel.schedule_id;
  if not found then
    raise exception 'Escala não encontrada' using errcode = 'P0002';
  end if;

  if v_escala.data < v_hoje then
    raise exception 'Esta escala já passou' using errcode = '22023';
  end if;

  -- Nada mudou: não grava nem notifica de novo.
  if v_papel.status_confirmacao is not distinct from p_status then
    return p_status;
  end if;

  update schedule_roles set status_confirmacao = p_status where id = p_role_id;

  if p_status = 'Recusado' then
    select nome into v_nome from users_profile where id = v_uid;
    select nome into v_dept_nome from departamentos where id = v_escala.departamento_id;

    insert into notifications (user_id, departamento_id, titulo, mensagem, tipo, link_redirecionamento, igreja_id)
    select distinct md.user_id,
           v_escala.departamento_id,
           '⚠️ Presença recusada',
           coalesce(v_nome, 'Um membro') || ' não poderá servir em '
             || to_char(v_escala.data, 'DD/MM')
             || coalesce(' (' || v_escala.turno || ')', '')
             || coalesce(' · ' || v_dept_nome, '')
             || ' como ' || v_papel.funcao || '.',
           'escala',
           '/escala/' || v_escala.id::text,
           v_escala.igreja_id
      from membros_departamentos md
     where md.departamento_id = v_escala.departamento_id
       and md.role in ('líder', 'admin')
       and md.user_id is not null
       and md.user_id <> v_uid;
  end if;

  return p_status;
end;
$$;

alter function public.responder_escala(uuid, text) owner to postgres;

revoke all on function public.responder_escala(uuid, text) from public, anon;
grant execute on function public.responder_escala(uuid, text) to authenticated;

-- ===================== 20261114000003_push_tokens.sql =====================
-- =====================================================================
-- Push em todos os aparelhos do usuário
--
-- Antes: users_profile.fcm_token guardava UM token por usuário — quem usa
-- celular e computador só recebia no último aparelho que abriu o app.
-- Agora: uma linha por aparelho em push_tokens.
--
-- A coluna users_profile.fcm_token NÃO é apagada (compatibilidade): o app
-- continua gravando nela por enquanto e as Edge Functions usam como
-- fallback quando o usuário ainda não tem nenhuma linha em push_tokens.
-- =====================================================================

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null unique,
  plataforma  text,
  criado_em   timestamptz default now(),
  visto_em    timestamptz default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Cada usuário só enxerga/mexe nos próprios aparelhos.
-- (As Edge Functions usam a Service Role, que passa por cima do RLS.)
drop policy if exists "push_tokens: ver os próprios" on public.push_tokens;
create policy "push_tokens: ver os próprios"
  on public.push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "push_tokens: inserir os próprios" on public.push_tokens;
create policy "push_tokens: inserir os próprios"
  on public.push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens: atualizar os próprios" on public.push_tokens;
create policy "push_tokens: atualizar os próprios"
  on public.push_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens: apagar os próprios" on public.push_tokens;
create policy "push_tokens: apagar os próprios"
  on public.push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- RPC registrar_push_token(token, plataforma)
--
-- Por que RPC e não um upsert direto do cliente: quando outra conta entra
-- no MESMO aparelho, o token já existe com o user_id da conta anterior.
-- O upsert (on conflict do update) esbarra no RLS, porque a linha antiga
-- não é do usuário atual. Esta função (SECURITY DEFINER) transfere o token
-- para quem está logado agora — só o próprio auth.uid(), nunca outro id.
-- ---------------------------------------------------------------------
create or replace function public.registrar_push_token(p_token text, p_plataforma text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  if p_token is null or length(trim(p_token)) = 0 or length(p_token) > 4096 then
    raise exception 'Token inválido.';
  end if;

  insert into push_tokens (user_id, token, plataforma, visto_em)
  values (auth.uid(), p_token, left(p_plataforma, 40), now())
  on conflict (token) do update
    set user_id    = excluded.user_id,
        plataforma = coalesce(excluded.plataforma, push_tokens.plataforma),
        visto_em   = now();
end;
$$;

revoke all on function public.registrar_push_token(text, text) from public;
revoke all on function public.registrar_push_token(text, text) from anon;
grant execute on function public.registrar_push_token(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Copia os tokens que já existem (users_profile.id = auth.users.id)
-- ---------------------------------------------------------------------
insert into public.push_tokens (user_id, token)
select id, fcm_token
from public.users_profile
where fcm_token is not null and length(trim(fcm_token)) > 0
on conflict (token) do nothing;

commit;
