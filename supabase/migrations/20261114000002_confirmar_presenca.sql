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
