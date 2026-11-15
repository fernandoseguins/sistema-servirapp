-- supabase/producao/07_crons_push.sql
-- Ajusta os crons de push. Nenhuma chave neste arquivo: o cabeçalho Authorization
-- (JWT service_role) é copiado do job `lembrete-diario-voluntarios`, que já o tem.
--
-- Antes (2026-11-15):
--   despertador-cobrador-louvor  0 11 * * *   sem Authorization → 401 sempre
--   check_reminders_every_4h     0 */4 * * *  POST na raiz do projeto → 404 (lixo)
--   cobrar-louvor-intensivo-4h   0 */4 * * *  6 cobranças por dia ao condutor
--   lembrete-diario-voluntarios  20 13 * * *  ok
--   (lembrete-hoje sem cron)
--
-- Depois:
--   despertador-cobrador-louvor  0 11 * * *   com Authorization (08h Brasília)
--   check_reminders_every_4h     removido
--   cobrar-louvor-intensivo-4h   0 12 * * *   1x por dia (09h Brasília)
--   lembrete-hoje-16h            0 19 * * *   novo (16h Brasília)

begin;

do $$
declare
  cabecalho text;
  id_cobrador bigint;
  id_intensivo bigint;
begin
  select substring(command from '(headers\s*:=\s*''[^'']*''::jsonb)') into cabecalho
    from cron.job where jobname = 'lembrete-diario-voluntarios';
  if cabecalho is null or cabecalho not like '%Bearer%' then
    raise exception 'Cabeçalho com Authorization não encontrado em lembrete-diario-voluntarios';
  end if;

  -- 1. Job quebrado que chamava a raiz do projeto
  if exists (select 1 from cron.job where jobname = 'check_reminders_every_4h') then
    perform cron.unschedule('check_reminders_every_4h');
  end if;

  -- 2. Cobrança intensiva: de 4 em 4 horas → 1x por dia
  select jobid into id_intensivo from cron.job where jobname = 'cobrar-louvor-intensivo-4h';
  if id_intensivo is not null then
    perform cron.alter_job(id_intensivo, schedule := '0 12 * * *');
  end if;

  -- 3. Cobrador (D-4) sem Authorization
  select jobid into id_cobrador from cron.job where jobname = 'despertador-cobrador-louvor';
  if id_cobrador is not null then
    perform cron.alter_job(id_cobrador, command := format(
      'select net.http_post(url:=%L, %s) as request_id;',
      'https://nboixgqhnwcjrxxroymu.supabase.co/functions/v1/cobrador-louvor', cabecalho));
  end if;

  -- 4. Lembrete de hoje (não tinha cron)
  if not exists (select 1 from cron.job where jobname = 'lembrete-hoje-16h') then
    perform cron.schedule('lembrete-hoje-16h', '0 19 * * *', format(
      'select net.http_post(url:=%L, %s) as request_id;',
      'https://nboixgqhnwcjrxxroymu.supabase.co/functions/v1/lembrete-hoje', cabecalho));
  end if;
end $$;

commit;

-- Rollback (manual):
--   select cron.unschedule('lembrete-hoje-16h');
--   select cron.alter_job((select jobid from cron.job where jobname='cobrar-louvor-intensivo-4h'), schedule := '0 */4 * * *');
--   (check_reminders_every_4h e o comando antigo do cobrador estavam quebrados — não vale recriar)
