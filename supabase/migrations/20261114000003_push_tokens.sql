-- =====================================================================
-- Push em todos os aparelhos do usuário
--
-- Antes: users_profile.fcm_token guardava UM token por usuário — quem usa
-- celular e computador só recebia no último aparelho que abriu o app.
-- Agora: uma linha por aparelho em push_tokens.
--
-- A coluna users_profile.fcm_token NÃO é apagada (compatibilidade): o app
-- continua gravando nela por enquanto e as Edge Functions usam como
-- fallback quando o usuário ainda não tem nenhuma linha em push_tokens.
-- =====================================================================

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null unique,
  plataforma  text,
  criado_em   timestamptz default now(),
  visto_em    timestamptz default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Cada usuário só enxerga/mexe nos próprios aparelhos.
-- (As Edge Functions usam a Service Role, que passa por cima do RLS.)
drop policy if exists "push_tokens: ver os próprios" on public.push_tokens;
create policy "push_tokens: ver os próprios"
  on public.push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "push_tokens: inserir os próprios" on public.push_tokens;
create policy "push_tokens: inserir os próprios"
  on public.push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens: atualizar os próprios" on public.push_tokens;
create policy "push_tokens: atualizar os próprios"
  on public.push_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens: apagar os próprios" on public.push_tokens;
create policy "push_tokens: apagar os próprios"
  on public.push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- RPC registrar_push_token(token, plataforma)
--
-- Por que RPC e não um upsert direto do cliente: quando outra conta entra
-- no MESMO aparelho, o token já existe com o user_id da conta anterior.
-- O upsert (on conflict do update) esbarra no RLS, porque a linha antiga
-- não é do usuário atual. Esta função (SECURITY DEFINER) transfere o token
-- para quem está logado agora — só o próprio auth.uid(), nunca outro id.
-- ---------------------------------------------------------------------
create or replace function public.registrar_push_token(p_token text, p_plataforma text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  if p_token is null or length(trim(p_token)) = 0 or length(p_token) > 4096 then
    raise exception 'Token inválido.';
  end if;

  insert into push_tokens (user_id, token, plataforma, visto_em)
  values (auth.uid(), p_token, left(p_plataforma, 40), now())
  on conflict (token) do update
    set user_id    = excluded.user_id,
        plataforma = coalesce(excluded.plataforma, push_tokens.plataforma),
        visto_em   = now();
end;
$$;

revoke all on function public.registrar_push_token(text, text) from public;
revoke all on function public.registrar_push_token(text, text) from anon;
grant execute on function public.registrar_push_token(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Copia os tokens que já existem (users_profile.id = auth.users.id)
-- ---------------------------------------------------------------------
insert into public.push_tokens (user_id, token)
select id, fcm_token
from public.users_profile
where fcm_token is not null and length(trim(fcm_token)) > 0
on conflict (token) do nothing;
