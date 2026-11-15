// supabase/functions/push-on-insert/index.ts
//
// Disparada pelo trigger `push_on_notification` (AFTER INSERT em `notifications`)
// com a Service Role. Transforma cada notificação do sininho em push.
//
// Antes: não conferia quem chamava (qualquer um com a chave anon pública mandava
// push para qualquer pessoa, com link externo), usava só o fcm_token legado
// (um aparelho) e mandava bloco `notification`.
// Agora: só Service Role, todos os aparelhos (push_tokens), link só do app e
// envio pelo _shared/push.ts (formato que o service worker exibe uma única vez).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { exigirServiceRole, json, texto } from "../_shared/seguranca.ts"
import { enviarPushParaUsuario } from "../_shared/push.ts"

// O gateway (verify_jwt = true) já validou a assinatura do JWT; aqui basta
// conferir que é a Service Role. Aceita também a chave idêntica à do ambiente.
function ehServiceRole(req: Request): boolean {
  if (!exigirServiceRole(req)) return true
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  try {
    const parte = token.split('.')[1] ?? ''
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '=')
    return JSON.parse(atob(base64))?.role === 'service_role'
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405)
  if (!ehServiceRole(req)) return json({ error: 'Não autorizado' }, 401)

  try {
    // O trigger manda o registro inserido em `record`
    const payload = await req.json().catch(() => ({}))
    const record = payload?.record ?? {}

    const userId   = typeof record.user_id === 'string' ? record.user_id : ''
    const titulo   = texto(record.titulo, 200)
    const mensagem = texto(record.mensagem, 1000)

    if (!userId || !titulo) return json({ skip: 'sem user_id ou titulo' })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Todos os aparelhos da pessoa; link passa pelo linkSeguroDoApp dentro do helper
    const r = await enviarPushParaUsuario(admin, userId, {
      titulo,
      mensagem,
      link: typeof record.link_redirecionamento === 'string' ? record.link_redirecionamento : undefined,
    })

    // Sempre 200: erro aqui não pode desfazer o INSERT da notificação
    return json({ sucesso: true, ...r })
  } catch (erro) {
    console.error('Erro na push-on-insert:', erro)
    return json({ erro: 'Erro interno.' })
  }
})
