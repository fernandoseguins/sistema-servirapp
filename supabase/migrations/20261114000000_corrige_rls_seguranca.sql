-- =====================================================================
-- Correção de segurança (RLS)
--
-- 1) users_profile: qualquer usuário logado podia alterar QUALQUER perfil
--    (inclusive o próprio role / super_admin / igreja_id) por causa de
--    políticas UPDATE com USING (true).
-- 2) membros_departamentos: política FOR ALL deixava qualquer membro mudar o
--    próprio cargo para 'admin', remover outros e se vincular a qualquer depto.
-- 3) kids_registry / kids_checkin: qualquer membro da igreja (de qualquer
--    departamento) lia/editava/apagava fichas das crianças.
--
-- Também cria a RPC entrar_na_igreja(codigo), que vincula o perfil à igreja
-- validando o código de convite (o cliente não define mais igreja_id direto).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER: leem as tabelas sem passar por RLS)
-- ---------------------------------------------------------------------

-- Admin da igreja: super admin, perfil admin, ou admin de algum depto da própria igreja
create or replace function public.eh_admin_da_igreja()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    coalesce((select super_admin from users_profile where id = auth.uid()), false)
    or coalesce((select role = 'admin' from users_profile where id = auth.uid()), false)
    or exists (
      select 1 from membros_departamentos md
      join departamentos d on d.id = md.departamento_id
      where md.user_id = auth.uid()
        and md.role = 'admin'
        and d.igreja_id = minha_igreja()
    );
$$;

-- Líder (ou admin) de um departamento específico
create or replace function public.eh_lider_do_departamento(p_departamento_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from membros_departamentos
    where user_id = auth.uid()
      and departamento_id = p_departamento_id
      and role in ('líder', 'admin')
  );
$$;

-- Líder (ou admin) de qualquer departamento da própria igreja
create or replace function public.eh_lider_em_algum_departamento()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from membros_departamentos md
    join departamentos d on d.id = md.departamento_id
    where md.user_id = auth.uid()
      and md.role in ('líder', 'admin')
      and d.igreja_id = minha_igreja()
  );
$$;

-- Departamento pertence à igreja de quem chama
create or replace function public.departamento_da_minha_igreja(p_departamento_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from departamentos
    where id = p_departamento_id and igreja_id = minha_igreja()
  );
$$;

-- Usuário pertence à igreja de quem chama
create or replace function public.usuario_da_minha_igreja(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from users_profile
    where id = p_user_id and igreja_id = minha_igreja()
  );
$$;

grant execute on function public.eh_admin_da_igreja() to authenticated;
grant execute on function public.eh_lider_do_departamento(uuid) to authenticated;
grant execute on function public.eh_lider_em_algum_departamento() to authenticated;
grant execute on function public.departamento_da_minha_igreja(uuid) to authenticated;
grant execute on function public.usuario_da_minha_igreja(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Entrar na igreja pelo código de convite (substitui o UPDATE direto de igreja_id)
-- ---------------------------------------------------------------------
create or replace function public.entrar_na_igreja(codigo text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_igreja uuid;
  v_atual  uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select id into v_igreja from igrejas
  where codigo_convite = upper(trim(codigo)) and ativa = true
  limit 1;

  if v_igreja is null then
    raise exception 'Código de convite inválido.';
  end if;

  select igreja_id into v_atual from users_profile where id = auth.uid();

  -- Já está nesta igreja: nada a fazer
  if v_atual = v_igreja then
    return v_igreja;
  end if;

  -- Já está em OUTRA igreja: não troca por aqui
  if v_atual is not null then
    raise exception 'Você já pertence a outra igreja.';
  end if;

  update users_profile set igreja_id = v_igreja where id = auth.uid();
  return v_igreja;
end;
$$;

revoke all on function public.entrar_na_igreja(text) from anon;
grant execute on function public.entrar_na_igreja(text) to authenticated;

-- ---------------------------------------------------------------------
-- users_profile
-- ---------------------------------------------------------------------
drop policy if exists "Permitir atualizacao de perfis" on public.users_profile;
drop policy if exists "Permitir update em users_profile" on public.users_profile;
drop policy if exists "Admins podem editar perfis" on public.users_profile;
-- "Usuário edita o próprio perfil" (auth.uid() = id) continua valendo.

-- Líderes/admins editam perfis (funções, instrumentos...) de membros da PRÓPRIA igreja
create policy "Lideres editam perfis da propria igreja"
  on public.users_profile for update to authenticated
  using (
    igreja_id = minha_igreja()
    and (eh_admin_da_igreja() or eh_lider_em_algum_departamento())
  )
  with check (igreja_id = minha_igreja());

-- Colunas sensíveis só mudam por funções do servidor (SECURITY DEFINER) ou pelo super admin.
create or replace function public.proteger_colunas_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Chamadas diretas da API rodam como 'authenticated'/'anon'.
  -- Funções SECURITY DEFINER (definir_admin_igreja, entrar_na_igreja,
  -- remover_membro_da_igreja...) rodam como o dono ('postgres') e passam.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Super admin (definido só pelo banco/servidor) pode alterar essas colunas
  if sou_super_admin_flag() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Sem permissão para alterar o cargo (role).';
  end if;
  if new.super_admin is distinct from old.super_admin then
    raise exception 'Sem permissão para alterar super_admin.';
  end if;
  if new.igreja_id is distinct from old.igreja_id then
    raise exception 'Use o código de convite para entrar em uma igreja.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_colunas_perfil on public.users_profile;
create trigger trg_proteger_colunas_perfil
  before update on public.users_profile
  for each row execute function public.proteger_colunas_perfil();

-- ---------------------------------------------------------------------
-- membros_departamentos
-- ---------------------------------------------------------------------
drop policy if exists "Membros da igreja" on public.membros_departamentos;

-- Ver: os próprios vínculos e os da própria igreja (igual antes)
create policy "Ver vinculos da igreja"
  on public.membros_departamentos for select to authenticated
  using (user_id = auth.uid() or departamento_da_minha_igreja(departamento_id));

-- Criar vínculo:
--  * o próprio usuário entra como 'membro' num depto da sua igreja (cadastro), ou
--  * líder do depto / admin da igreja adiciona alguém da igreja.
--  Só admin da igreja cria vínculo com cargo 'admin'.
create policy "Criar vinculos"
  on public.membros_departamentos for insert to authenticated
  with check (
    departamento_da_minha_igreja(departamento_id)
    and usuario_da_minha_igreja(user_id)
    and (
      (user_id = auth.uid() and role = 'membro')
      or eh_lider_do_departamento(departamento_id)
      or eh_admin_da_igreja()
    )
    and (role <> 'admin' or eh_admin_da_igreja())
  );

-- Alterar cargo: líder do depto ou admin da igreja.
-- Líder não mexe em quem é admin e não promove ninguém a admin.
create policy "Alterar vinculos"
  on public.membros_departamentos for update to authenticated
  using (
    departamento_da_minha_igreja(departamento_id)
    and (eh_lider_do_departamento(departamento_id) or eh_admin_da_igreja())
    and (role <> 'admin' or eh_admin_da_igreja())
  )
  with check (
    departamento_da_minha_igreja(departamento_id)
    and (eh_lider_do_departamento(departamento_id) or eh_admin_da_igreja())
    and (role <> 'admin' or eh_admin_da_igreja())
  );

-- Remover vínculo: sair do próprio depto, ou líder do depto / admin da igreja.
create policy "Remover vinculos"
  on public.membros_departamentos for delete to authenticated
  using (
    departamento_da_minha_igreja(departamento_id)
    and (
      user_id = auth.uid()
      or ((eh_lider_do_departamento(departamento_id) or eh_admin_da_igreja())
          and (role <> 'admin' or eh_admin_da_igreja()))
    )
  );

-- ---------------------------------------------------------------------
-- Infantil: só quem é do departamento (ou admin da igreja) vê as crianças
-- ---------------------------------------------------------------------
drop policy if exists "Kids registry da igreja" on public.kids_registry;
create policy "Kids registry do departamento"
  on public.kids_registry for all to authenticated
  using (
    igreja_id = minha_igreja()
    and (
      departamento_id in (select departamento_id from membros_departamentos where user_id = auth.uid())
      or eh_admin_da_igreja()
    )
  )
  with check (
    departamento_da_minha_igreja(departamento_id)
    and (
      departamento_id in (select departamento_id from membros_departamentos where user_id = auth.uid())
      or eh_admin_da_igreja()
    )
  );

drop policy if exists "Kids checkin da igreja" on public.kids_checkin;
create policy "Kids checkin do departamento"
  on public.kids_checkin for all to authenticated
  using (
    igreja_id = minha_igreja()
    and (
      departamento_id in (select departamento_id from membros_departamentos where user_id = auth.uid())
      or eh_admin_da_igreja()
    )
  )
  with check (
    departamento_da_minha_igreja(departamento_id)
    and (
      departamento_id in (select departamento_id from membros_departamentos where user_id = auth.uid())
      or eh_admin_da_igreja()
    )
  );
