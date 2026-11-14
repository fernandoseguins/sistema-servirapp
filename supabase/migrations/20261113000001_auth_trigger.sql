-- Gatilho que cria o perfil (users_profile) quando alguém se cadastra.
-- Ele fica no schema "auth", que o `supabase db dump` não exporta,
-- por isso é recriado aqui para o ambiente local.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
