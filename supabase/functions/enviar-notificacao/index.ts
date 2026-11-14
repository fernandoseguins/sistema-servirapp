// supabase/functions/enviar-notificacao/index.ts
// Função INTERNA: só é chamada por outras funções/crons/webhooks com a Service Role Key.
// (Antes aceitava a chave anon pública — qualquer um podia mandar push com link falso.)
//
// Corpo aceito:
// - { userId, titulo, mensagem, link }   → envia para TODOS os aparelhos do usuário
// - { fcmToken, titulo, mensagem, link } → legado: descobre o dono do token e envia
//   para todos os aparelhos dele (se não achar o dono, envia só para o token)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { exigirServiceRole, json, texto } from "../_shared/seguranca.ts";
import { donoDoToken, enviarParaTokens, enviarPushParaUsuario } from "../_shared/push.ts";

serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);

  const negado = exigirServiceRole(req);
  if (negado) return negado;

  try {
    // 1. Recebe os dados (usuário ou token, Título, Mensagem e o LINK)
    const body = await req.json().catch(() => ({}));
    const userId   = texto(body.userId, 64);
    const fcmToken = texto(body.fcmToken, 4096);
    const titulo   = texto(body.titulo, 200);
    const mensagem = texto(body.mensagem, 1000);
    const link     = typeof body.link === 'string' ? body.link : undefined;

    if (!userId && !fcmToken) return json({ erro: "Informe userId ou fcmToken." }, 400);

    if (!Deno.env.get('FIREBASE_SERVICE_ACCOUNT')) {
      console.error("FIREBASE_SERVICE_ACCOUNT não configurada.");
      return json({ erro: "Serviço de notificação indisponível." }, 500);
    }

    // 2. Client com Service Role (push_tokens tem RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 3. Envia para cada aparelho (tokens mortos são apagados no caminho)
    const msg = { titulo, mensagem, link };
    const dono = userId || await donoDoToken(admin, fcmToken);
    const resultado = dono
      ? await enviarPushParaUsuario(admin, dono, msg)
      : await enviarParaTokens(admin, [fcmToken], msg);

    if (resultado.enviados === 0 && resultado.falhas > 0) {
      return json({ erro: "Falha ao enviar notificação." }, 502);
    }

    return json({ sucesso: true, ...resultado });
  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return json({ erro: "Erro interno." }, 500);
  }
});
