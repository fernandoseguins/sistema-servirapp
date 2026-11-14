-- 06_rollback_melhorias.sql
-- Desfaz o 05_aplicar_melhorias.sql. Só use se precisar voltar atrás.
-- ATENÇÃO: apaga a tabela push_tokens (os aparelhos se registram de novo ao abrir o app;
-- users_profile.fcm_token continua intacto). Os status de presença já respondidos ficam.
-- Volte também o site/funções para a versão anterior, senão os botões dão erro.

begin;

drop function if exists public.responder_troca(uuid, boolean);
drop function if exists public.separar_funcoes(text);
drop function if exists public.responder_escala(uuid, text);
drop function if exists public.registrar_push_token(text, text);

alter table public.schedule_roles drop constraint if exists schedule_roles_status_confirmacao_check;

drop table if exists public.push_tokens;

commit;
