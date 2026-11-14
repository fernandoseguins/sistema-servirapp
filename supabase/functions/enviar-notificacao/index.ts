// supabase/functions/enviar-notificacao/index.ts
// Função INTERNA: só é chamada por outras funções/crons/webhooks com a Service Role Key.
// (Antes aceitava a chave anon pública — qualquer um podia mandar push com link falso.)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JWT } from "npm:google-auth-library@9";
import { exigirServiceRole, json, linkSeguroDoApp, texto } from "../_shared/seguranca.ts";

serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);

  const negado = exigirServiceRole(req);
  if (negado) return negado;

  try {
    // 1. Recebe os dados (Token do celular, Título, Mensagem e o LINK)
    const body = await req.json().catch(() => ({}));
    const fcmToken = texto(body.fcmToken, 4096);
    const titulo   = texto(body.titulo, 200);
    const mensagem = texto(body.mensagem, 1000);

    if (!fcmToken) return json({ erro: "Token FCM não fornecido." }, 400);

    // 2. Pega a Chave Mestra do Firebase das variáveis de ambiente
    const serviceAccountKey = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountKey) {
      console.error("FIREBASE_SERVICE_ACCOUNT não configurada.");
      return json({ erro: "Serviço de notificação indisponível." }, 500);
    }
    const serviceAccount = JSON.parse(serviceAccountKey);

    // 3. Gera um "crachá de acesso" temporário usando a biblioteca do Google
    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const accessToken = await jwtClient.getAccessToken();

    // 4. Monta a notificação — o link só pode apontar para o próprio app
    const fcmPayload = {
      message: {
        token: fcmToken,
        notification: { title: titulo, body: mensagem },
        webpush: { fcm_options: { link: linkSeguroDoApp(body.link) } },
      },
    };

    // 5. Envia para o Firebase
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload),
    });

    if (!response.ok) {
      // Detalhes só no log do servidor — nunca na resposta
      console.error("Erro do Firebase:", await response.text());
      return json({ erro: "Falha ao enviar notificação." }, 502);
    }

    return json({ sucesso: true });
  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return json({ erro: "Erro interno." }, 500);
  }
});
