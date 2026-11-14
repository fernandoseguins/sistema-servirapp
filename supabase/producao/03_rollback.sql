-- 03_rollback.sql
-- DESFAZ a correção 20261114000000_corrige_rls_seguranca.sql e volta as regras ANTIGAS.
-- Atenção: as regras antigas têm as falhas de segurança. Use só se o app quebrar,
-- e reaplique a correção depois de ajustar.

begin;

-- users_profile
drop trigger if exists trg_proteger_colunas_perfil on public.users_profile;
drop function if exists public.proteger_colunas_perfil();
drop policy if exists "Lideres editam perfis da propria igreja" on public.users_profile;
create policy "Admins podem editar perfis" on public.users_profile for update using (
  (select users_profile_1.role from public.users_profile users_profile_1 where users_profile_1.id = auth.uid())
  = any (array['admin'::public.user_role, 'líder'::public.user_role]));
create policy "Permitir atualizacao de perfis" on public.users_profile for update to authenticated using (true);
create policy "Permitir update em users_profile" on public.users_profile for update to authenticated using (true);

-- membros_departamentos
drop policy if exists "Ver vinculos da igreja" on public.membros_departamentos;
drop policy if exists "Criar vinculos" on public.membros_departamentos;
drop policy if exists "Alterar vinculos" on public.membros_departamentos;
drop policy if exists "Remover vinculos" on public.membros_departamentos;
create policy "Membros da igreja" on public.membros_departamentos to authenticated
  using ((user_id = auth.uid()) or (departamento_id in (select departamentos.id from public.departamentos where departamentos.igreja_id = public.minha_igreja())))
  with check ((user_id = auth.uid()) or (departamento_id in (select departamentos.id from public.departamentos where departamentos.igreja_id = public.minha_igreja())));

-- kids
drop policy if exists "Kids registry do departamento" on public.kids_registry;
create policy "Kids registry da igreja" on public.kids_registry to authenticated
  using (igreja_id = public.minha_igreja())
  with check (departamento_id in (select departamentos.id from public.departamentos where departamentos.igreja_id = public.minha_igreja()));
drop policy if exists "Kids checkin do departamento" on public.kids_checkin;
create policy "Kids checkin da igreja" on public.kids_checkin to authenticated
  using (igreja_id = public.minha_igreja())
  with check (departamento_id in (select departamentos.id from public.departamentos where departamentos.igreja_id = public.minha_igreja()));

-- funções novas (o app antigo não usa nenhuma)
drop function if exists public.entrar_na_igreja(text);
drop function if exists public.eh_admin_da_igreja();
drop function if exists public.eh_lider_do_departamento(uuid);
drop function if exists public.eh_lider_em_algum_departamento();
drop function if exists public.departamento_da_minha_igreja(uuid);
drop function if exists public.usuario_da_minha_igreja(uuid);

commit;
