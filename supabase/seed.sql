-- supabase/seed.sql
-- Dados de TESTE para o Supabase local. Roda só em `supabase start` / `supabase db reset`.
-- Nunca é enviado para produção.
--
-- Usuário de teste (criado pela tela de cadastro do app, só existe no banco local):
--   e-mail: admin@teste.local
--   senha:  Teste@12345
--   convite: TESTE1
-- Membros extras de teste (criados pela API admin do Auth local): membro1..membro4@teste.local, mesma senha.
-- Depois do cadastro ele é promovido a admin/super_admin (ver supabase/promover_admin_local.sql).

-- Igreja de teste (código de convite: TESTE1)
insert into public.igrejas (id, nome, slug, codigo_convite, ativa)
values ('00000000-0000-0000-0000-000000000001', 'Igreja Teste Local', 'igreja-teste', 'TESTE1', true)
on conflict (id) do nothing;

-- Departamentos (os nomes precisam bater com os usados em Auth.jsx)
insert into public.departamentos (id, nome, igreja_id, tipo, cor) values
  ('00000000-0000-0000-0000-0000000000a1', 'Louvor',    '00000000-0000-0000-0000-000000000001', 'louvor',    '#2563eb'),
  ('00000000-0000-0000-0000-0000000000a2', 'Mídia',     '00000000-0000-0000-0000-000000000001', 'midia',     '#7c3aed'),
  ('00000000-0000-0000-0000-0000000000a3', 'Infantil',  '00000000-0000-0000-0000-000000000001', 'infantil',  '#f59e0b'),
  ('00000000-0000-0000-0000-0000000000a4', 'Diaconia',  '00000000-0000-0000-0000-000000000001', 'generico',  '#10b981'),
  ('00000000-0000-0000-0000-0000000000a5', 'Ministros', '00000000-0000-0000-0000-000000000001', 'ministros', '#ef4444'),
  ('00000000-0000-0000-0000-0000000000a6', 'Cantina',   '00000000-0000-0000-0000-000000000001', 'cantina',   '#f97316')
on conflict (id) do nothing;
