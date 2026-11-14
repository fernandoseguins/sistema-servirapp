-- 01_checagem_antes.sql
-- SÓ LEITURA. Rode no SQL Editor de produção ANTES de aplicar a correção.

-- A) As políticas antigas que a correção remove precisam existir com estes nomes
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('users_profile', 'membros_departamentos', 'kids_registry', 'kids_checkin')
order by tablename, policyname;

-- B) Quem é super admin hoje (os donos do sistema precisam aparecer aqui com true)
select up.nome, au.email, up.role, up.super_admin
from users_profile up
join auth.users au on au.id = up.id
where up.super_admin = true
   or au.email in ('fernando.seguinsf@gmail.com', 'raymendesmelo@hotmail.com');

-- C) Nenhuma das funções novas pode existir ainda (esperado: 0 linhas)
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('eh_admin_da_igreja', 'eh_lider_do_departamento', 'eh_lider_em_algum_departamento',
                  'departamento_da_minha_igreja', 'usuario_da_minha_igreja', 'entrar_na_igreja',
                  'proteger_colunas_perfil');

-- D) Alguém já virou admin/super_admin de forma suspeita? (revise a lista)
select up.nome, au.email, up.role, up.super_admin, up.igreja_id
from users_profile up
join auth.users au on au.id = up.id
where up.role = 'admin' or up.super_admin = true
order by up.igreja_id, up.nome;
