# lembrete-hoje

Envia um push (via `enviar-notificacao`) para todos que estão escalados **para o dia de hoje**
em escalas com status `Publicada`. Complementa o `lembrete-amanha` (que roda 1 dia antes).

## Deploy

```bash
supabase functions deploy lembrete-hoje
```

## Agendamento (16h de Brasília)

O agendamento **não fica no código** — é configurado no projeto Supabase, igual ao
`lembrete-amanha`. Há duas formas:

### Opção A — Painel (mais simples)

Dashboard → Edge Functions → `lembrete-hoje` → aba **Schedules** → *Add schedule*
- Cron: `0 19 * * *`  (19:00 UTC = 16:00 em Brasília, UTC-3)
- Method: `POST`

### Opção B — SQL (pg_cron + pg_net)

Rode no SQL Editor uma única vez. Troque `SEU_SERVICE_ROLE_KEY` pela Service Role Key
(Dashboard → Project Settings → API). É o mesmo padrão usado pelo `lembrete-amanha`.

```sql
-- garante as extensões (provavelmente já estão ativas)
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'lembrete-hoje-16h',
  '0 19 * * *',
  $$
  select net.http_post(
    url := 'https://nboixgqhnwcjrxxroymu.supabase.co/functions/v1/lembrete-hoje',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Conferir / remover:

```sql
select jobid, jobname, schedule, active from cron.job;
select cron.unschedule('lembrete-hoje-16h');
```

> Observação sobre fuso: o `pg_cron` roda em UTC. `16:00` em Brasília = `19:00 UTC`.
> Se algum dia o Brasil voltar a ter horário de verão, ajuste para `0 18 * * *`.
