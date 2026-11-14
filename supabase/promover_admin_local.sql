-- supabase/promover_admin_local.sql
-- SÓ PARA O BANCO LOCAL. Promove o usuário de teste admin@teste.local a:
--   admin da igreja + super_admin (Painel do Dono) + líder de todos os departamentos.
-- Rodar (com o Supabase local no ar):
--   docker exec -i supabase_db_escala-louvor psql -U postgres -d postgres < supabase/promover_admin_local.sql

update public.users_profile
set role = 'admin', super_admin = true
where id = (select id from auth.users where email = 'admin@teste.local');

insert into public.membros_departamentos (user_id, departamento_id, role)
select u.id, d.id, 'líder'
from auth.users u
cross join public.departamentos d
where u.email = 'admin@teste.local'
  and d.igreja_id = '00000000-0000-0000-0000-000000000001'
  and not exists (
    select 1 from public.membros_departamentos md
    where md.user_id = u.id and md.departamento_id = d.id
  );

update public.membros_departamentos
set role = 'líder'
where user_id = (select id from auth.users where email = 'admin@teste.local');
