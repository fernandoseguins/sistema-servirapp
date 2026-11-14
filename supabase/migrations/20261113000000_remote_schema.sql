


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'líder',
    'membro'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apagar_igreja_completa"("p_igreja_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_dept_ids uuid[];
  v_schedule_ids uuid[];
BEGIN
  -- Só super-admin
  IF NOT sou_super_admin_flag() THEN
    RAISE EXCEPTION 'Apenas o super-admin pode apagar uma igreja.';
  END IF;

  -- Coleta os departamentos da igreja
  SELECT array_agg(id) INTO v_dept_ids
  FROM departamentos WHERE igreja_id = p_igreja_id;

  -- Coleta as escalas desses departamentos
  IF v_dept_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_schedule_ids
    FROM schedules WHERE departamento_id = ANY(v_dept_ids);
  END IF;

  -- 1. Apaga o que depende das ESCALAS
  IF v_schedule_ids IS NOT NULL THEN
    DELETE FROM schedule_roles WHERE schedule_id = ANY(v_schedule_ids);
    DELETE FROM schedule_songs WHERE schedule_id = ANY(v_schedule_ids);
  END IF;

  -- 2. Apaga o que depende dos DEPARTAMENTOS
  IF v_dept_ids IS NOT NULL THEN
    DELETE FROM schedules            WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM membros_departamentos WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM departamento_cores   WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM songs                WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM lessons              WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM media_checklists     WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM kids_checkin         WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM kids_registry        WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM notices              WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM indisponibilidades   WHERE departamento_id = ANY(v_dept_ids);
    DELETE FROM swap_requests        WHERE departamento_id = ANY(v_dept_ids);
  END IF;

  -- 3. Notificações dos membros desta igreja
  DELETE FROM notifications
  WHERE user_id IN (SELECT id FROM users_profile WHERE igreja_id = p_igreja_id);

  -- 4. Apaga os departamentos
  DELETE FROM departamentos WHERE igreja_id = p_igreja_id;

  -- 5. Desvincula os membros (mantém a conta, tira da igreja)
  UPDATE users_profile
  SET igreja_id = NULL, role = 'membro'
  WHERE igreja_id = p_igreja_id;

  -- 6. Finalmente, apaga a igreja
  DELETE FROM igrejas WHERE id = p_igreja_id;

  -- Se qualquer passo acima falhar, o PostgreSQL faz ROLLBACK de tudo.
END;
$$;


ALTER FUNCTION "public"."apagar_igreja_completa"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_igreja_completa"("p_nome" "text", "p_slug" "text", "p_cor" "text", "p_codigo" "text", "p_departamentos" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  nova_igreja_id uuid;
  dept jsonb;
BEGIN
  -- Proteção: código de convite não pode já existir
  IF EXISTS (SELECT 1 FROM igrejas WHERE codigo_convite = p_codigo) THEN
    RAISE EXCEPTION 'Código de convite já existe. Tente novamente.';
  END IF;

  -- 1. Cria a igreja
  INSERT INTO igrejas (nome, slug, cor_primaria, plano, codigo_convite, ativa)
  VALUES (p_nome, p_slug, p_cor, 'pro', p_codigo, true)
  RETURNING id INTO nova_igreja_id;

  -- 2. Cria os departamentos (percorre o JSON)
  FOR dept IN SELECT * FROM jsonb_array_elements(p_departamentos)
  LOOP
    INSERT INTO departamentos (nome, igreja_id, cor, icone, tipo)
    VALUES (
      dept->>'nome',
      nova_igreja_id,
      NULLIF(dept->>'cor', ''),
      NULLIF(dept->>'icone', ''),
      COALESCE(NULLIF(dept->>'tipo', ''), 'generico')
    );
  END LOOP;

  -- Se chegou aqui, tudo deu certo. Retorna o id.
  RETURN nova_igreja_id;

  -- Se QUALQUER coisa acima falhar, o PostgreSQL faz ROLLBACK
  -- automático de toda a função (nada é criado).
END;
$$;


ALTER FUNCTION "public"."criar_igreja_completa"("p_nome" "text", "p_slug" "text", "p_cor" "text", "p_codigo" "text", "p_departamentos" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."definir_admin_igreja"("p_user_id" "uuid", "p_tornar_admin" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT sou_super_admin_flag() THEN
    RAISE EXCEPTION 'Apenas o super-admin pode definir admins.';
  END IF;

  UPDATE users_profile
  SET role = (CASE WHEN p_tornar_admin THEN 'admin' ELSE 'membro' END)::user_role
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."definir_admin_igreja"("p_user_id" "uuid", "p_tornar_admin" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."definir_lider_departamento"("p_user_id" "uuid", "p_departamento_id" "uuid", "p_tornar_lider" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_igreja_do_dept uuid;
  v_igreja_do_admin uuid;
  v_sou_admin boolean;
BEGIN
  SELECT igreja_id INTO v_igreja_do_dept
  FROM departamentos WHERE id = p_departamento_id;

  SELECT igreja_id, (role = 'admin') INTO v_igreja_do_admin, v_sou_admin
  FROM users_profile WHERE id = auth.uid();

  IF NOT (sou_super_admin_flag() OR (v_sou_admin AND v_igreja_do_admin = v_igreja_do_dept)) THEN
    RAISE EXCEPTION 'Sem permissão para definir líder neste departamento.';
  END IF;

  UPDATE membros_departamentos
  SET role = (CASE WHEN p_tornar_lider THEN 'líder' ELSE 'membro' END)::user_role  -- ✅ cast
  WHERE user_id = p_user_id AND departamento_id = p_departamento_id;
END;
$$;


ALTER FUNCTION "public"."definir_lider_departamento"("p_user_id" "uuid", "p_departamento_id" "uuid", "p_tornar_lider" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."departamentos_por_codigo"("codigo" "text") RETURNS TABLE("id" "uuid", "nome" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT d.id, d.nome
  FROM departamentos d
  JOIN igrejas i ON i.id = d.igreja_id
  WHERE i.codigo_convite = upper(trim(codigo))
    AND i.ativa = true
    AND d.tipo <> 'cantina'   -- ✅ esconde a Cantina (rodízio automático)
  ORDER BY d.nome;
$$;


ALTER FUNCTION "public"."departamentos_por_codigo"("codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detalhes_igreja"("p_igreja_id" "uuid") RETURNS TABLE("id" "uuid", "nome" "text", "codigo_convite" "text", "cor_primaria" "text", "plano" "text", "ativa" boolean, "criada_em" timestamp with time zone, "qtd_membros" bigint, "qtd_departamentos" bigint, "qtd_admins" bigint, "qtd_escalas" bigint, "qtd_lideres" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT sou_super_admin_flag() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    i.id, i.nome, i.codigo_convite, i.cor_primaria, i.plano, i.ativa, i.criada_em,
    (SELECT COUNT(*) FROM users_profile up WHERE up.igreja_id = i.id) AS qtd_membros,
    (SELECT COUNT(*) FROM departamentos d WHERE d.igreja_id = i.id) AS qtd_departamentos,
    (SELECT COUNT(*) FROM users_profile up WHERE up.igreja_id = i.id AND up.role = 'admin') AS qtd_admins,
    (SELECT COUNT(*) FROM schedules s
       JOIN departamentos d ON d.id = s.departamento_id
       WHERE d.igreja_id = i.id) AS qtd_escalas,
    (SELECT COUNT(DISTINCT md.user_id) FROM membros_departamentos md
       JOIN departamentos d ON d.id = md.departamento_id
       WHERE d.igreja_id = i.id AND md.role = 'líder') AS qtd_lideres
  FROM igrejas i
  WHERE i.id = p_igreja_id;
END;
$$;


ALTER FUNCTION "public"."detalhes_igreja"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_codigo_convite"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sem O/0/I/1 (evita confusão)
  resultado text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    resultado := resultado || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN resultado;
END;
$$;


ALTER FUNCTION "public"."gerar_codigo_convite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  i text;
begin
  -- 1. Cria o perfil com as funções de voz e sonoplastia
  insert into public.users_profile (id, nome, role, voz, backing_vocal, sonoplastia)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), 
    'membro',
    coalesce((new.raw_user_meta_data->>'voz')::boolean, false),
    coalesce((new.raw_user_meta_data->>'backing_vocal')::boolean, false),
    coalesce((new.raw_user_meta_data->>'sonoplastia')::boolean, false)
  );

  -- 2. Lê a lista de instrumentos e salva na tabela correta
  if new.raw_user_meta_data->'instrumentos' is not null then
    for i in select jsonb_array_elements_text(new.raw_user_meta_data->'instrumentos') loop
      insert into public.user_instruments (user_id, instrumento) values (new.id, i);
    end loop;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_igrejas_painel"() RETURNS TABLE("id" "uuid", "nome" "text", "codigo_convite" "text", "cor_primaria" "text", "plano" "text", "ativa" boolean, "criada_em" timestamp with time zone, "qtd_membros" bigint, "qtd_departamentos" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Só super admin pode usar
  IF NOT sou_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    i.id, i.nome, i.codigo_convite, i.cor_primaria, i.plano, i.ativa, i.criada_em,
    (SELECT COUNT(*) FROM users_profile up WHERE up.igreja_id = i.id) AS qtd_membros,
    (SELECT COUNT(*) FROM departamentos d WHERE d.igreja_id = i.id) AS qtd_departamentos
  FROM igrejas i
  ORDER BY i.criada_em DESC;
END;
$$;


ALTER FUNCTION "public"."listar_igrejas_painel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_membros_da_igreja"("p_igreja_id" "uuid") RETURNS TABLE("id" "uuid", "nome" "text", "email" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT sou_super_admin_flag() THEN
    RAISE EXCEPTION 'Apenas o super-admin pode listar membros de outras igrejas.';
  END IF;

  RETURN QUERY
    SELECT up.id, up.nome, au.email::text, up.role::text   -- ✅ cast ::text
    FROM users_profile up
    JOIN auth.users au ON au.id = up.id
    WHERE up.igreja_id = p_igreja_id
    ORDER BY
      CASE up.role::text WHEN 'admin' THEN 0 WHEN 'líder' THEN 1 ELSE 2 END,
      up.nome;
END;
$$;


ALTER FUNCTION "public"."listar_membros_da_igreja"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_membros_igreja"() RETURNS TABLE("id" "uuid", "nome" "text", "role" "text", "qtd_departamentos" bigint, "departamentos" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT sou_admin_igreja() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.nome,
    up.role::text,
    (SELECT COUNT(*) FROM membros_departamentos md
       JOIN departamentos d ON d.id = md.departamento_id
       WHERE md.user_id = up.id AND d.igreja_id = minha_igreja()) AS qtd_departamentos,
    (SELECT string_agg(d.nome, ', ') FROM membros_departamentos md
       JOIN departamentos d ON d.id = md.departamento_id
       WHERE md.user_id = up.id AND d.igreja_id = minha_igreja()) AS departamentos
  FROM users_profile up
  WHERE up.igreja_id = minha_igreja()
  ORDER BY up.nome;
END;
$$;


ALTER FUNCTION "public"."listar_membros_igreja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meu_email"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    -- Caminho 1: claim direto 'email'
    nullif(current_setting('request.jwt.claims', true)::json ->> 'email', ''),
    -- Caminho 2: dentro de user_metadata
    nullif(current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'email', ''),
    -- Caminho 3: busca no perfil pelo id (fallback garantido)
    (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()),
    ''
  );
$$;


ALTER FUNCTION "public"."meu_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."minha_igreja"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT igreja_id FROM users_profile WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."minha_igreja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preencher_igreja_do_usuario"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.igreja_id IS NULL THEN
    SELECT igreja_id INTO NEW.igreja_id FROM users_profile WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."preencher_igreja_do_usuario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preencher_igreja_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Se já veio com igreja_id, mantém. Senão, pega do usuário destinatário.
  IF NEW.igreja_id IS NULL THEN
    SELECT igreja_id INTO NEW.igreja_id
    FROM users_profile WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."preencher_igreja_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preencher_igreja_por_departamento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.igreja_id IS NULL AND NEW.departamento_id IS NOT NULL THEN
    SELECT igreja_id INTO NEW.igreja_id FROM departamentos WHERE id = NEW.departamento_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."preencher_igreja_por_departamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preencher_igreja_por_schedule"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.igreja_id IS NULL AND NEW.schedule_id IS NOT NULL THEN
    SELECT igreja_id INTO NEW.igreja_id FROM schedules WHERE id = NEW.schedule_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."preencher_igreja_por_schedule"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promover_primeiro_admin"("p_igreja_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  qtd_admins int;
BEGIN
  -- Conta admins já existentes na igreja, olhando OS DOIS lugares:
  --  1. role geral no perfil (users_profile)
  --  2. role nos vínculos de departamento (membros_departamentos)
  SELECT
    (SELECT COUNT(*) FROM users_profile
       WHERE igreja_id = p_igreja_id AND role IN ('admin', 'líder'))
    +
    (SELECT COUNT(*) FROM membros_departamentos md
       JOIN departamentos d ON d.id = md.departamento_id
       WHERE d.igreja_id = p_igreja_id AND md.role IN ('admin', 'líder'))
  INTO qtd_admins;

  -- Se não há nenhum admin/líder ainda, promove este usuário
  IF qtd_admins = 0 THEN
    -- 1. Marca admin no perfil (funciona mesmo sem departamento)
    UPDATE users_profile SET role = 'admin' WHERE id = p_user_id;

    -- 2. Marca admin nos departamentos dele (se tiver algum)
    UPDATE membros_departamentos md
    SET role = 'admin'
    FROM departamentos d
    WHERE md.departamento_id = d.id
      AND d.igreja_id = p_igreja_id
      AND md.user_id = p_user_id;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."promover_primeiro_admin"("p_igreja_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remover_membro_da_igreja"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  minha_ig uuid;
  igreja_do_alvo uuid;
BEGIN
  minha_ig := minha_igreja();

  -- Verifica se quem chama é admin da própria igreja
  IF NOT sou_admin_igreja() THEN
    RAISE EXCEPTION 'Apenas administradores podem remover membros';
  END IF;

  -- Verifica se o alvo é da MESMA igreja (não pode remover de outra)
  SELECT igreja_id INTO igreja_do_alvo FROM users_profile WHERE id = p_user_id;
  IF igreja_do_alvo IS DISTINCT FROM minha_ig THEN
    RAISE EXCEPTION 'Este membro não pertence à sua igreja';
  END IF;

  -- Não deixa remover a si mesmo (evita acidente)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode remover a si mesmo';
  END IF;

  -- Remove os vínculos (só os desta igreja)
  DELETE FROM membros_departamentos
  WHERE user_id = p_user_id
    AND departamento_id IN (SELECT id FROM departamentos WHERE igreja_id = minha_ig);

  DELETE FROM user_instruments WHERE user_id = p_user_id;

  DELETE FROM indisponibilidades
  WHERE user_id = p_user_id
    AND departamento_id IN (SELECT id FROM departamentos WHERE igreja_id = minha_ig);

  -- Remove das escalas desta igreja
  DELETE FROM schedule_roles
  WHERE user_id = p_user_id
    AND schedule_id IN (SELECT id FROM schedules WHERE igreja_id = minha_ig);

  -- Remove notificações desta igreja
  DELETE FROM notifications WHERE user_id = p_user_id AND igreja_id = minha_ig;

  -- Desvincula o perfil da igreja (a pessoa fica "sem igreja")
  UPDATE users_profile SET igreja_id = NULL, role = 'membro' WHERE id = p_user_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."remover_membro_da_igreja"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sou_admin_igreja"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    meu_email() IN ('raymendesmelo@hotmail.com', 'fernando.seguinsf@gmail.com')
    OR (SELECT role FROM users_profile WHERE id = auth.uid()) IN ('admin', 'líder')
    OR EXISTS (SELECT 1 FROM membros_departamentos WHERE user_id = auth.uid() AND role IN ('admin', 'líder'));
$$;


ALTER FUNCTION "public"."sou_admin_igreja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sou_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT meu_email() IN ('fernando.seguinsf@gmail.com', 'raymendesmelo@hotmail.com');
$$;


ALTER FUNCTION "public"."sou_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sou_super_admin_flag"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT super_admin FROM users_profile WHERE id = auth.uid()),
    false
  );
$$;


ALTER FUNCTION "public"."sou_super_admin_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_codigo_convite"("codigo" "text") RETURNS TABLE("igreja_id" "uuid", "igreja_nome" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT id, nome FROM igrejas
  WHERE codigo_convite = upper(trim(codigo)) AND ativa = true
  LIMIT 1;
$$;


ALTER FUNCTION "public"."validar_codigo_convite"("codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vinculos_do_membro"("p_user_id" "uuid") RETURNS TABLE("departamento_id" "uuid", "departamento_nome" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT (sou_admin_igreja() OR sou_super_admin_flag()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
    SELECT md.departamento_id, d.nome, md.role::text   -- ✅ cast ::text
    FROM membros_departamentos md
    JOIN departamentos d ON d.id = md.departamento_id
    WHERE md.user_id = p_user_id
      AND d.igreja_id = minha_igreja()
    ORDER BY d.nome;
END;
$$;


ALTER FUNCTION "public"."vinculos_do_membro"("p_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."departamento_cores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "departamento_id" "uuid",
    "cor" "text" NOT NULL,
    "igreja_id" "uuid"
);


ALTER TABLE "public"."departamento_cores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "indisponibilidades_bloqueadas" boolean DEFAULT false,
    "igreja_id" "uuid",
    "cor" "text",
    "icone" "text",
    "tipo" "text" DEFAULT 'generico'::"text"
);


ALTER TABLE "public"."departamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."igrejas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "slug" "text",
    "logo_url" "text",
    "cor_primaria" "text" DEFAULT '#2E5496'::"text",
    "plano" "text" DEFAULT 'pro'::"text",
    "ativa" boolean DEFAULT true,
    "criada_em" timestamp with time zone DEFAULT "now"(),
    "codigo_convite" "text"
);


ALTER TABLE "public"."igrejas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."indisponibilidades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "departamento_id" "uuid",
    "data" "date" NOT NULL,
    "motivo" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "turno" "text" DEFAULT 'Integral'::"text"
);


ALTER TABLE "public"."indisponibilidades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kids_checkin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "departamento_id" "uuid",
    "nome_crianca" "text" NOT NULL,
    "nome_responsavel" "text" NOT NULL,
    "telefone_responsavel" "text" NOT NULL,
    "status" "text" DEFAULT 'presente'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "registry_id" "uuid",
    "checkout_time" timestamp with time zone,
    "igreja_id" "uuid"
);


ALTER TABLE "public"."kids_checkin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kids_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "departamento_id" "uuid",
    "nome_crianca" "text" NOT NULL,
    "nome_responsavel" "text" NOT NULL,
    "telefone_responsavel" "text" NOT NULL,
    "restricoes_medicas" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "sala" "text",
    "igreja_id" "uuid"
);


ALTER TABLE "public"."kids_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "departamento_id" "uuid",
    "titulo" "text" NOT NULL,
    "link" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "igreja_id" "uuid"
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mapas_vocais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "nome_arquivo" "text",
    "enviado_por" "uuid",
    "enviado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mapas_vocais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "departamento_id" "uuid",
    "user_id" "uuid",
    "nome_responsavel" "text" NOT NULL,
    "data" "date" DEFAULT CURRENT_DATE,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "schedule_id" "uuid",
    "turno" "text",
    "equipamentos_ok" boolean DEFAULT false,
    "computadores_ok" boolean DEFAULT false,
    "tvs_ok" boolean DEFAULT false,
    "ar_ok" boolean DEFAULT false,
    "bancada_ok" boolean DEFAULT false,
    "relato_problema" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."media_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membros_departamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "departamento_id" "uuid",
    "role" "text" DEFAULT 'membro'::"text"
);


ALTER TABLE "public"."membros_departamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "departamento_id" "uuid",
    "user_id" "uuid",
    "titulo" "text" NOT NULL,
    "conteudo" "text" NOT NULL,
    "urgente" boolean DEFAULT false,
    "data_criacao" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "da_gestao" boolean DEFAULT false,
    "igreja_id" "uuid"
);


ALTER TABLE "public"."notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "departamento_id" "uuid",
    "titulo" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "lida" boolean DEFAULT false,
    "tipo" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "link_redirecionamento" "text",
    "igreja_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid",
    "user_id" "uuid",
    "funcao" "text" NOT NULL,
    "status_confirmacao" "text" DEFAULT 'Pendente'::"text",
    "nome_externo" "text"
);


ALTER TABLE "public"."schedule_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid",
    "song_id" "uuid",
    "ordem" integer NOT NULL,
    "tom" "text"
);


ALTER TABLE "public"."schedule_songs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data" "date" NOT NULL,
    "cor_roupa" "text",
    "turno" "text" DEFAULT 'Integral'::"text",
    "horario_ensaio" "text" DEFAULT 'A combinar'::"text",
    "status" "text" DEFAULT 'Rascunho'::"text",
    "departamento_id" "uuid",
    "titulo" "text",
    "lider_cabine_id" "uuid",
    "status_repertorio" "text" DEFAULT 'rascunho'::"text",
    "mapa_vocal_url" "text",
    "mapa_vocal_digital" "jsonb",
    "obs_condutor" "text" DEFAULT ''::"text",
    "obs_lideres" "text" DEFAULT ''::"text",
    "igreja_id" "uuid"
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link" "text",
    "artista" "text",
    "tag" "text" DEFAULT 'Adoração'::"text",
    "titulo" "text",
    "tom" "text",
    "bpm" "text",
    "link_youtube" "text",
    "departamento_id" "uuid",
    "categoria" "text",
    "link_cifra" "text",
    "igreja_id" "uuid"
);


ALTER TABLE "public"."songs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."swap_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid",
    "role_id" "uuid",
    "requester_id" "uuid",
    "requester_nome" "text",
    "substitute_id" "uuid",
    "substitute_nome" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "funcoes_alvo" "text",
    "motivo" "text"
);


ALTER TABLE "public"."swap_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unavailability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "data" "date" NOT NULL,
    "turno" "text" DEFAULT 'Integral'::"text",
    "motivo" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."unavailability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_instruments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "instrumento" "text" NOT NULL
);


ALTER TABLE "public"."user_instruments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users_profile" (
    "id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'membro'::"public"."user_role",
    "voz" boolean DEFAULT false,
    "sonoplastia" boolean DEFAULT false,
    "backing_vocal" boolean DEFAULT false,
    "data_nascimento" "date",
    "midia_computador" boolean DEFAULT false,
    "midia_fotografia" boolean DEFAULT false,
    "midia_redacao" boolean DEFAULT false,
    "infantil_bercario" boolean DEFAULT false,
    "infantil_sala3_8" boolean DEFAULT false,
    "infantil_sala9_11" boolean DEFAULT false,
    "infantil_acolhimento" boolean DEFAULT false,
    "conducao" boolean DEFAULT false,
    "infantil_auxiliar" boolean DEFAULT false,
    "diaconia" boolean DEFAULT false,
    "fcm_token" "text",
    "igreja_id" "uuid",
    "super_admin" boolean DEFAULT false
);


ALTER TABLE "public"."users_profile" OWNER TO "postgres";


ALTER TABLE ONLY "public"."departamento_cores"
    ADD CONSTRAINT "departamento_cores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departamentos"
    ADD CONSTRAINT "departamentos_nome_igreja_key" UNIQUE ("nome", "igreja_id");



ALTER TABLE ONLY "public"."departamentos"
    ADD CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."igrejas"
    ADD CONSTRAINT "igrejas_codigo_convite_key" UNIQUE ("codigo_convite");



ALTER TABLE ONLY "public"."igrejas"
    ADD CONSTRAINT "igrejas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."igrejas"
    ADD CONSTRAINT "igrejas_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."indisponibilidades"
    ADD CONSTRAINT "indisponibilidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kids_checkin"
    ADD CONSTRAINT "kids_checkin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kids_registry"
    ADD CONSTRAINT "kids_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mapas_vocais"
    ADD CONSTRAINT "mapas_vocais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_checklists"
    ADD CONSTRAINT "media_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membros_departamentos"
    ADD CONSTRAINT "membros_departamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membros_departamentos"
    ADD CONSTRAINT "membros_departamentos_user_id_departamento_id_key" UNIQUE ("user_id", "departamento_id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_roles"
    ADD CONSTRAINT "schedule_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_songs"
    ADD CONSTRAINT "schedule_songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_data_turno_departamento_key" UNIQUE ("data", "turno", "departamento_id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."swap_requests"
    ADD CONSTRAINT "swap_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unavailability"
    ADD CONSTRAINT "unavailability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_instruments"
    ADD CONSTRAINT "user_instruments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users_profile"
    ADD CONSTRAINT "users_profile_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_mapas_vocais_schedule" ON "public"."mapas_vocais" USING "btree" ("schedule_id");



-- [LOCAL] Gatilho "push_on_notification" removido deste arquivo:
-- em produção ele chama a edge function push-on-insert com a chave service_role.
-- No ambiente local ele mandaria push reais e exporia a chave no repositório.



CREATE OR REPLACE TRIGGER "trg_igreja_dept_cores" BEFORE INSERT ON "public"."departamento_cores" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_igreja_por_departamento"();



CREATE OR REPLACE TRIGGER "trg_igreja_kids_checkin" BEFORE INSERT ON "public"."kids_checkin" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_igreja_por_departamento"();



CREATE OR REPLACE TRIGGER "trg_igreja_kids_registry" BEFORE INSERT ON "public"."kids_registry" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_igreja_por_departamento"();



CREATE OR REPLACE TRIGGER "trg_igreja_lessons" BEFORE INSERT ON "public"."lessons" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_igreja_por_departamento"();



CREATE OR REPLACE TRIGGER "trg_igreja_notices" BEFORE INSERT ON "public"."notices" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_igreja_do_usuario"();



CREATE OR REPLACE TRIGGER "trg_igreja_schedules" BEFORE INSERT ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_igreja_por_departamento"();



CREATE OR REPLACE TRIGGER "trg_igreja_songs" BEFORE INSERT ON "public"."songs" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_igreja_do_usuario"();



CREATE OR REPLACE TRIGGER "trg_preencher_igreja_notification" BEFORE INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_igreja_notification"();



ALTER TABLE ONLY "public"."departamento_cores"
    ADD CONSTRAINT "departamento_cores_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departamento_cores"
    ADD CONSTRAINT "departamento_cores_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."departamentos"
    ADD CONSTRAINT "departamentos_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."indisponibilidades"
    ADD CONSTRAINT "indisponibilidades_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."indisponibilidades"
    ADD CONSTRAINT "indisponibilidades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kids_checkin"
    ADD CONSTRAINT "kids_checkin_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kids_checkin"
    ADD CONSTRAINT "kids_checkin_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."kids_registry"
    ADD CONSTRAINT "kids_registry_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kids_registry"
    ADD CONSTRAINT "kids_registry_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."mapas_vocais"
    ADD CONSTRAINT "mapas_vocais_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mapas_vocais"
    ADD CONSTRAINT "mapas_vocais_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_checklists"
    ADD CONSTRAINT "media_checklists_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_checklists"
    ADD CONSTRAINT "media_checklists_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_checklists"
    ADD CONSTRAINT "media_checklists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membros_departamentos"
    ADD CONSTRAINT "membros_departamentos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membros_departamentos"
    ADD CONSTRAINT "membros_departamentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_roles"
    ADD CONSTRAINT "schedule_roles_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_roles"
    ADD CONSTRAINT "schedule_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."schedule_songs"
    ADD CONSTRAINT "schedule_songs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_songs"
    ADD CONSTRAINT "schedule_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."swap_requests"
    ADD CONSTRAINT "swap_requests_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."schedule_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."swap_requests"
    ADD CONSTRAINT "swap_requests_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unavailability"
    ADD CONSTRAINT "unavailability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_instruments"
    ADD CONSTRAINT "user_instruments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users_profile"
    ADD CONSTRAINT "users_profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."users_profile"
    ADD CONSTRAINT "users_profile_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



CREATE POLICY "Acesso por igreja" ON "public"."departamentos" TO "authenticated" USING (("igreja_id" = "public"."minha_igreja"())) WITH CHECK (("igreja_id" = "public"."minha_igreja"()));



CREATE POLICY "Admins podem editar perfis" ON "public"."users_profile" FOR UPDATE USING ((( SELECT "users_profile_1"."role"
   FROM "public"."users_profile" "users_profile_1"
  WHERE ("users_profile_1"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"public"."user_role", 'líder'::"public"."user_role"])));



CREATE POLICY "Apagar propria unavailability" ON "public"."unavailability" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Avisos da igreja" ON "public"."notices" TO "authenticated" USING (("igreja_id" = "public"."minha_igreja"())) WITH CHECK ((("igreja_id" = "public"."minha_igreja"()) OR ("igreja_id" IS NULL)));



CREATE POLICY "Checklists da igreja" ON "public"."media_checklists" TO "authenticated" USING (("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"())))) WITH CHECK (("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Condutor gerencia repertorio" ON "public"."schedule_songs" USING (((( SELECT "users_profile"."role"
   FROM "public"."users_profile"
  WHERE ("users_profile"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"public"."user_role", 'líder'::"public"."user_role"])) OR (EXISTS ( SELECT 1
   FROM "public"."schedule_roles"
  WHERE (("schedule_roles"."schedule_id" = "schedule_songs"."schedule_id") AND ("schedule_roles"."user_id" = "auth"."uid"()) AND ("schedule_roles"."funcao" = 'Condução'::"text")))))) WITH CHECK (((( SELECT "users_profile"."role"
   FROM "public"."users_profile"
  WHERE ("users_profile"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"public"."user_role", 'líder'::"public"."user_role"])) OR (EXISTS ( SELECT 1
   FROM "public"."schedule_roles"
  WHERE (("schedule_roles"."schedule_id" = "schedule_songs"."schedule_id") AND ("schedule_roles"."user_id" = "auth"."uid"()) AND ("schedule_roles"."funcao" = 'Condução'::"text"))))));



CREATE POLICY "Cores da igreja" ON "public"."departamento_cores" TO "authenticated" USING ((("igreja_id" = "public"."minha_igreja"()) OR ("igreja_id" IS NULL))) WITH CHECK (("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Criar departamentos" ON "public"."departamentos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Criar igrejas" ON "public"."igrejas" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enviar mapas vocais da própria igreja" ON "public"."mapas_vocais" FOR INSERT WITH CHECK (("schedule_id" IN ( SELECT "s"."id"
   FROM ("public"."schedules" "s"
     JOIN "public"."departamentos" "d" ON (("d"."id" = "s"."departamento_id")))
  WHERE ("d"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Escalas da igreja" ON "public"."schedules" FOR SELECT TO "authenticated" USING ((("igreja_id" = "public"."minha_igreja"()) AND (("status" = 'Publicada'::"text") OR "public"."sou_admin_igreja"())));



CREATE POLICY "Funcoes da igreja" ON "public"."schedule_roles" TO "authenticated" USING (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE ("schedules"."igreja_id" = "public"."minha_igreja"())))) WITH CHECK (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE ("schedules"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Gerenciar proprias indisponibilidades" ON "public"."indisponibilidades" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Gerenciar proprios instrumentos" ON "public"."user_instruments" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Inserir propria unavailability" ON "public"."unavailability" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Kids checkin da igreja" ON "public"."kids_checkin" TO "authenticated" USING (("igreja_id" = "public"."minha_igreja"())) WITH CHECK (("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Kids registry da igreja" ON "public"."kids_registry" TO "authenticated" USING (("igreja_id" = "public"."minha_igreja"())) WITH CHECK (("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Leitura por igreja" ON "public"."departamentos" FOR SELECT TO "authenticated" USING (("igreja_id" = "public"."minha_igreja"()));



CREATE POLICY "Lessons da igreja" ON "public"."lessons" TO "authenticated" USING (("igreja_id" = "public"."minha_igreja"())) WITH CHECK (("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Lider Admin edita escalas igreja" ON "public"."schedules" TO "authenticated" USING ((("igreja_id" = "public"."minha_igreja"()) AND "public"."sou_admin_igreja"())) WITH CHECK ((("igreja_id" = "public"."minha_igreja"()) AND "public"."sou_admin_igreja"()));



CREATE POLICY "Louvores da igreja" ON "public"."songs" TO "authenticated" USING (("igreja_id" = "public"."minha_igreja"())) WITH CHECK ((("igreja_id" = "public"."minha_igreja"()) OR ("igreja_id" IS NULL)));



CREATE POLICY "Líder/Admin edita funcoes" ON "public"."schedule_roles" USING ((( SELECT "users_profile"."role"
   FROM "public"."users_profile"
  WHERE ("users_profile"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"public"."user_role", 'líder'::"public"."user_role"]))) WITH CHECK ((( SELECT "users_profile"."role"
   FROM "public"."users_profile"
  WHERE ("users_profile"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"public"."user_role", 'líder'::"public"."user_role"])));



CREATE POLICY "Membros da igreja" ON "public"."membros_departamentos" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR ("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"())))));



CREATE POLICY "Notificacoes da igreja" ON "public"."notifications" TO "authenticated" USING (("igreja_id" = "public"."minha_igreja"())) WITH CHECK (("user_id" IN ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Perfis da mesma igreja" ON "public"."users_profile" FOR SELECT TO "authenticated" USING ((("igreja_id" = "public"."minha_igreja"()) OR ("id" = "auth"."uid"())));



CREATE POLICY "Permitir atualizacao de perfis" ON "public"."users_profile" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Permitir update em users_profile" ON "public"."users_profile" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Remover mapas vocais da própria igreja" ON "public"."mapas_vocais" FOR DELETE USING (("schedule_id" IN ( SELECT "s"."id"
   FROM ("public"."schedules" "s"
     JOIN "public"."departamentos" "d" ON (("d"."id" = "s"."departamento_id")))
  WHERE ("d"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Repertorio da igreja" ON "public"."schedule_songs" TO "authenticated" USING (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE ("schedules"."igreja_id" = "public"."minha_igreja"())))) WITH CHECK (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE ("schedules"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Schedule roles da igreja" ON "public"."schedule_roles" TO "authenticated" USING (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE (("schedules"."igreja_id" = "public"."minha_igreja"()) OR ("schedules"."departamento_id" IN ( SELECT "departamentos"."id"
           FROM "public"."departamentos"
          WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))))))) WITH CHECK (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE (("schedules"."igreja_id" = "public"."minha_igreja"()) OR ("schedules"."departamento_id" IN ( SELECT "departamentos"."id"
           FROM "public"."departamentos"
          WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"())))))));



CREATE POLICY "Schedule songs da igreja" ON "public"."schedule_songs" TO "authenticated" USING (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE (("schedules"."igreja_id" = "public"."minha_igreja"()) OR ("schedules"."departamento_id" IN ( SELECT "departamentos"."id"
           FROM "public"."departamentos"
          WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))))))) WITH CHECK (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE (("schedules"."igreja_id" = "public"."minha_igreja"()) OR ("schedules"."departamento_id" IN ( SELECT "departamentos"."id"
           FROM "public"."departamentos"
          WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"())))))));



CREATE POLICY "Schedules da igreja" ON "public"."schedules" TO "authenticated" USING ((("igreja_id" = "public"."minha_igreja"()) OR ("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))))) WITH CHECK (("departamento_id" IN ( SELECT "departamentos"."id"
   FROM "public"."departamentos"
  WHERE ("departamentos"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Trocas da igreja" ON "public"."swap_requests" TO "authenticated" USING (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE ("schedules"."igreja_id" = "public"."minha_igreja"())))) WITH CHECK (("schedule_id" IN ( SELECT "schedules"."id"
   FROM "public"."schedules"
  WHERE ("schedules"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Unavailability da igreja" ON "public"."unavailability" FOR SELECT TO "authenticated" USING (("user_id" IN ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Usuário edita o próprio perfil" ON "public"."users_profile" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Ver indisponibilidades da igreja" ON "public"."indisponibilidades" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("user_id" IN ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."igreja_id" = "public"."minha_igreja"())))));



CREATE POLICY "Ver instrumentos da igreja" ON "public"."user_instruments" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("user_id" IN ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."igreja_id" = "public"."minha_igreja"())))));



CREATE POLICY "Ver mapas vocais da própria igreja" ON "public"."mapas_vocais" FOR SELECT USING (("schedule_id" IN ( SELECT "s"."id"
   FROM ("public"."schedules" "s"
     JOIN "public"."departamentos" "d" ON (("d"."id" = "s"."departamento_id")))
  WHERE ("d"."igreja_id" = "public"."minha_igreja"()))));



CREATE POLICY "Ver proprio perfil sempre" ON "public"."users_profile" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."departamento_cores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."igrejas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "igrejas_select" ON "public"."igrejas" FOR SELECT TO "authenticated" USING ((("id" = "public"."minha_igreja"()) OR "public"."sou_super_admin"()));



CREATE POLICY "igrejas_update" ON "public"."igrejas" FOR UPDATE TO "authenticated" USING ((("id" = "public"."minha_igreja"()) OR "public"."sou_super_admin"()));



ALTER TABLE "public"."indisponibilidades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kids_checkin" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kids_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mapas_vocais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_checklists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."membros_departamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."swap_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unavailability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_instruments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_profile" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."apagar_igreja_completa"("p_igreja_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apagar_igreja_completa"("p_igreja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apagar_igreja_completa"("p_igreja_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_igreja_completa"("p_nome" "text", "p_slug" "text", "p_cor" "text", "p_codigo" "text", "p_departamentos" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_igreja_completa"("p_nome" "text", "p_slug" "text", "p_cor" "text", "p_codigo" "text", "p_departamentos" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_igreja_completa"("p_nome" "text", "p_slug" "text", "p_cor" "text", "p_codigo" "text", "p_departamentos" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."definir_admin_igreja"("p_user_id" "uuid", "p_tornar_admin" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."definir_admin_igreja"("p_user_id" "uuid", "p_tornar_admin" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."definir_admin_igreja"("p_user_id" "uuid", "p_tornar_admin" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."definir_lider_departamento"("p_user_id" "uuid", "p_departamento_id" "uuid", "p_tornar_lider" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."definir_lider_departamento"("p_user_id" "uuid", "p_departamento_id" "uuid", "p_tornar_lider" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."definir_lider_departamento"("p_user_id" "uuid", "p_departamento_id" "uuid", "p_tornar_lider" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."departamentos_por_codigo"("codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."departamentos_por_codigo"("codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."departamentos_por_codigo"("codigo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."detalhes_igreja"("p_igreja_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."detalhes_igreja"("p_igreja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detalhes_igreja"("p_igreja_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gerar_codigo_convite"() TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_codigo_convite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_codigo_convite"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."listar_igrejas_painel"() TO "anon";
GRANT ALL ON FUNCTION "public"."listar_igrejas_painel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_igrejas_painel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."listar_membros_da_igreja"("p_igreja_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."listar_membros_da_igreja"("p_igreja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_membros_da_igreja"("p_igreja_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."listar_membros_igreja"() TO "anon";
GRANT ALL ON FUNCTION "public"."listar_membros_igreja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_membros_igreja"() TO "service_role";



GRANT ALL ON FUNCTION "public"."meu_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."meu_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meu_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."minha_igreja"() TO "anon";
GRANT ALL ON FUNCTION "public"."minha_igreja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."minha_igreja"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preencher_igreja_do_usuario"() TO "anon";
GRANT ALL ON FUNCTION "public"."preencher_igreja_do_usuario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preencher_igreja_do_usuario"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preencher_igreja_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."preencher_igreja_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preencher_igreja_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preencher_igreja_por_departamento"() TO "anon";
GRANT ALL ON FUNCTION "public"."preencher_igreja_por_departamento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preencher_igreja_por_departamento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preencher_igreja_por_schedule"() TO "anon";
GRANT ALL ON FUNCTION "public"."preencher_igreja_por_schedule"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preencher_igreja_por_schedule"() TO "service_role";



GRANT ALL ON FUNCTION "public"."promover_primeiro_admin"("p_igreja_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."promover_primeiro_admin"("p_igreja_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."promover_primeiro_admin"("p_igreja_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remover_membro_da_igreja"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remover_membro_da_igreja"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remover_membro_da_igreja"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sou_admin_igreja"() TO "anon";
GRANT ALL ON FUNCTION "public"."sou_admin_igreja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sou_admin_igreja"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sou_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."sou_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sou_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sou_super_admin_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."sou_super_admin_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sou_super_admin_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_codigo_convite"("codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validar_codigo_convite"("codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_codigo_convite"("codigo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."vinculos_do_membro"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."vinculos_do_membro"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vinculos_do_membro"("p_user_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."departamento_cores" TO "anon";
GRANT ALL ON TABLE "public"."departamento_cores" TO "authenticated";
GRANT ALL ON TABLE "public"."departamento_cores" TO "service_role";



GRANT ALL ON TABLE "public"."departamentos" TO "anon";
GRANT ALL ON TABLE "public"."departamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."departamentos" TO "service_role";



GRANT ALL ON TABLE "public"."igrejas" TO "anon";
GRANT ALL ON TABLE "public"."igrejas" TO "authenticated";
GRANT ALL ON TABLE "public"."igrejas" TO "service_role";



GRANT ALL ON TABLE "public"."indisponibilidades" TO "anon";
GRANT ALL ON TABLE "public"."indisponibilidades" TO "authenticated";
GRANT ALL ON TABLE "public"."indisponibilidades" TO "service_role";



GRANT ALL ON TABLE "public"."kids_checkin" TO "anon";
GRANT ALL ON TABLE "public"."kids_checkin" TO "authenticated";
GRANT ALL ON TABLE "public"."kids_checkin" TO "service_role";



GRANT ALL ON TABLE "public"."kids_registry" TO "anon";
GRANT ALL ON TABLE "public"."kids_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."kids_registry" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON TABLE "public"."mapas_vocais" TO "anon";
GRANT ALL ON TABLE "public"."mapas_vocais" TO "authenticated";
GRANT ALL ON TABLE "public"."mapas_vocais" TO "service_role";



GRANT ALL ON TABLE "public"."media_checklists" TO "anon";
GRANT ALL ON TABLE "public"."media_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."media_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."membros_departamentos" TO "anon";
GRANT ALL ON TABLE "public"."membros_departamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."membros_departamentos" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_roles" TO "anon";
GRANT ALL ON TABLE "public"."schedule_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_roles" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_songs" TO "anon";
GRANT ALL ON TABLE "public"."schedule_songs" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_songs" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."songs" TO "anon";
GRANT ALL ON TABLE "public"."songs" TO "authenticated";
GRANT ALL ON TABLE "public"."songs" TO "service_role";



GRANT ALL ON TABLE "public"."swap_requests" TO "anon";
GRANT ALL ON TABLE "public"."swap_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."swap_requests" TO "service_role";



GRANT ALL ON TABLE "public"."unavailability" TO "anon";
GRANT ALL ON TABLE "public"."unavailability" TO "authenticated";
GRANT ALL ON TABLE "public"."unavailability" TO "service_role";



GRANT ALL ON TABLE "public"."user_instruments" TO "anon";
GRANT ALL ON TABLE "public"."user_instruments" TO "authenticated";
GRANT ALL ON TABLE "public"."user_instruments" TO "service_role";



GRANT ALL ON TABLE "public"."users_profile" TO "anon";
GRANT ALL ON TABLE "public"."users_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."users_profile" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































