-- 04_checagem_melhorias.sql
-- SÓ LEITURA. Rode no SQL Editor de produção ANTES do 05_aplicar_melhorias.sql.

-- A) A correção de segurança (02_aplicar_correcao.sql) já foi aplicada?
--    Esperado: 6 linhas. Se vier 0, rode 01 → 02 primeiro (a troca depende delas).
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('eh_admin_da_igreja', 'eh_lider_do_departamento', 'eh_lider_em_algum_departamento',
                  'departamento_da_minha_igreja', 'usuario_da_minha_igreja', 'entrar_na_igreja')
order by proname;

-- B) Valores atuais de presença. Esperado: só 'Pendente', 'Confirmado', 'Recusado' ou null.
--    Qualquer outro valor (ex.: 'confirmado') precisa ser corrigido antes.
select status_confirmacao, count(*)
from schedule_roles
group by status_confirmacao
order by 2 desc;

-- C) Nada das melhorias pode existir ainda (esperado: 0 linhas)
select 'funcao' as tipo, proname as nome
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('separar_funcoes', 'responder_troca', 'responder_escala', 'registrar_push_token')
union all
select 'tabela', tablename from pg_tables where schemaname = 'public' and tablename = 'push_tokens';

-- D) Quantos aparelhos serão copiados para push_tokens
select count(*) as tokens_atuais from users_profile where fcm_token is not null;
