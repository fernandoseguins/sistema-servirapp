// supabase/functions/chat-bot/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { mensagem, contextoUsuario } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    if (!apiKey) throw new Error("Chave do Groq não encontrada.")

    // 🕵️‍♂️ Lendo a identidade do usuário (se existir)
    let blocoIdentidade = "";
    if (contextoUsuario) {
      blocoIdentidade = `
      🚨 IDENTIDADE DE QUEM ESTÁ FALANDO COM VOCÊ:
      - Nome: ${contextoUsuario.nome}
      - Departamento principal: ${contextoUsuario.departamento}
      - Cargo no departamento: ${contextoUsuario.cargo}
      
      INSTRUÇÃO OBRIGATÓRIA: Chame a pessoa pelo nome ao responder. Use as informações acima para dar respostas mais precisas baseadas na realidade dela (por exemplo, se ela for Líder, trate-a como líder).
      `;
    }

    const promptSistema = `
      Você é o "ServirBot", o assistente exclusivo do ServirApp, um aplicativo de gestão de escalas de igreja.
      
      ${blocoIdentidade}
      
      🚨 REGRA DE OURO E INQUEBRÁVEL 🚨:
      Você SÓ PODE responder a perguntas estritamente relacionadas ao aplicativo ServirApp, escalas da igreja, departamentos, trocas de dias, avisos, repertório de músicas e funções do sistema.
      Se perguntarem sobre QUALQUER OUTRO ASSUNTO, recuse educadamente dizendo que você só ajuda com o aplicativo da igreja.
      
      Instruções do sistema para ajudar:
      - Escalas: Ficam no calendário do Dashboard ou menu Escalas.
      - Trocas: O voluntário entra na escala, clica em "Trocar", escolhe um substituto e explica o motivo. A troca só ocorre após o líder aprovar.
      - Mídia: Tem um botão "Cabine" e devem enviar o "Checklist" com foto no dia do culto.
      - Louvor: Podem ver repertório, tons e links de cifras na aba "Músicas".
      - Indisponibilidade: Devem ir em "Dias Off" e marcar datas off antes da escala ser gerada.
      
      Responda de forma amorosa, curta e gentil, usando linguagem cristã.
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: mensagem }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    })

    const data = await response.json()

    if (data.error) throw new Error(`Erro do Groq: ${data.error.message}`)

    const respostaIA = data.choices[0].message.content

    return new Response(JSON.stringify({ resposta: respostaIA }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})