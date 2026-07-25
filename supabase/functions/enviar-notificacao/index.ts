// supabase/functions/enviar-notificacao/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JWT } from "npm:google-auth-library@9";

// Configuração para permitir que o seu app React converse com esta função (CORS)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Responde rápido às verificações de segurança do navegador (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Recebe os dados do React (Token do celular, Título, Mensagem e agora o LINK!)
    const { fcmToken, titulo, mensagem, link } = await req.json();

    if (!fcmToken) {
      throw new Error("Token FCM não fornecido.");
    }

    // 2. Pega a Chave Mestra do Firebase que vamos salvar nas variáveis de ambiente
    const serviceAccountKey = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountKey) {
      throw new Error("Chave do Firebase não encontrada nas variáveis de ambiente.");
    }
    const serviceAccount = JSON.parse(serviceAccountKey);

    // 3. Gera um "crachá de acesso" temporário usando a biblioteca do Google
    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const accessToken = await jwtClient.getAccessToken();

    // 4. Monta a encomenda (A notificação push com o Link de Redirecionamento)
    const fcmPayload = {
      message: {
        token: fcmToken,
        notification: {
          title: titulo,
          body: mensagem,
        },
        // ✅ O SEGREDO ESTÁ AQUI: Diz pro PWA abrir esse link ao ser clicado
        webpush: {
          fcm_options: {
            link: link || "https://servirapp.netlify.app/hub"
          }
        }
      },
    };

    // 5. Envia a encomenda para o servidor do Firebase
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Erro do Firebase:", responseData);
      throw new Error(`Erro ao enviar pelo Firebase: ${JSON.stringify(responseData)}`);
    }

    // 6. Retorna o sucesso para o React
    return new Response(JSON.stringify({ sucesso: true, dados: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(JSON.stringify({ erro: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});