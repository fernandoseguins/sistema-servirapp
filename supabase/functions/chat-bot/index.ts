// supabase/functions/chat-bot/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { exigirUsuario, json, texto } from "../_shared/seguranca.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_MENSAGEM = 500

// Limite simples por usuário (por instância da função — melhor esforço).
// Evita que alguém esgote a cota do Groq em loop.
const LIMITE_POR_MINUTO = 10
const janelas = new Map<string, number[]>()
function excedeuLimite(userId: string): boolean {
  const agora = Date.now()
  const recentes = (janelas.get(userId) ?? []).filter(t => agora - t < 60_000)
  recentes.push(agora)
  janelas.set(userId, recentes)
  return recentes.length > LIMITE_POR_MINUTO
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405, corsHeaders)

  // Exige usuário logado de verdade (a chave anon pública não basta)
  const auth = await exigirUsuario(req)
  if (!auth.user || !auth.client) return json({ error: 'Não autorizado' }, 401, corsHeaders)
  const { user, client } = auth

  if (excedeuLimite(user.id)) {
    return json({ error: 'Muitas perguntas seguidas. Aguarde um minuto e tente de novo.' }, 429, corsHeaders)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const mensagem = texto(body.mensagem, MAX_MENSAGEM).trim()
    if (!mensagem) return json({ error: 'Mensagem vazia.' }, 400, corsHeaders)

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) {
      console.error("GROQ_API_KEY não configurada.")
      return json({ error: 'Assistente indisponível no momento.' }, 500, corsHeaders)
    }

    // 🕵️‍♂️ Identidade lida do BANCO (com o RLS do próprio usuário), não do que o cliente manda
    const { data: perfil } = await client.from('users_profile').select('nome').eq('id', user.id).maybeSingle()
    const { data: vinculo } = await client
      .from('membros_departamentos')
      .select('role, departamentos(nome)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const contextoUsuario = {
      nome: texto(perfil?.nome, 80) || 'Irmão(ã)',
      cargo: texto(vinculo?.role, 40) || 'Voluntário',
      // deno-lint-ignore no-explicit-any
      departamento: texto((vinculo as any)?.departamentos?.nome, 80) || 'Nenhum departamento específico',
    }

    const blocoIdentidade = `
      🚨 IDENTIDADE DE QUEM ESTÁ FALANDO COM VOCÊ:
      - Nome: ${contextoUsuario.nome}
      - Departamento principal: ${contextoUsuario.departamento}
      - Cargo no departamento: ${contextoUsuario.cargo}

      INSTRUÇÃO OBRIGATÓRIA: Chame a pessoa pelo nome ao responder. Use as informações acima para dar respostas mais precisas baseadas na realidade dela (por exemplo, se ela for Líder, trate-a como líder).
      `

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
    `

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

    const data = await response.json().catch(() => null)
    const respostaIA = data?.choices?.[0]?.message?.content

    if (!response.ok || !respostaIA) {
      console.error('Erro do Groq:', data?.error?.message ?? response.status)
      return json({ error: 'O assistente não conseguiu responder agora. Tente novamente.' }, 502, corsHeaders)
    }

    return json({ resposta: respostaIA }, 200, corsHeaders)
  } catch (error) {
    console.error('Erro no chat-bot:', error)
    return json({ error: 'Erro interno.' }, 500, corsHeaders)
  }
})
