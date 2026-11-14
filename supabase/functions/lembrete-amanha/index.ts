// supabase/functions/lembrete-amanha/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { exigirServiceRole } from '../_shared/seguranca.ts'
import { enviarPushParaUsuario } from '../_shared/push.ts'

serve(async (req) => {
  // Só o cron (Service Role Key) pode disparar — a chave anon pública não serve.
  const negado = exigirServiceRole(req)
  if (negado) return negado
  const authHeader = req.headers.get('Authorization')!

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  const dataFormatada = amanha.toISOString().split('T')[0]

  console.log(`Buscando escalados para: ${dataFormatada}`)

  const { data: escalas, error } = await supabaseAdmin
    .from('schedules')
    .select(`
      id, turno, departamento_id,
      departamentos ( nome ),
      schedule_roles (
        user_id,
        funcao,
        users_profile ( nome )
      )
    `)
    .eq('data', dataFormatada)
    .eq('status', 'Publicada')

  if (error) {
    console.error("Erro ao buscar no banco:", error.message)
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500 })
  }

  console.log(`Encontrei ${escalas?.length || 0} escalas para amanhã.`)

  let enviados = 0

  for (const esc of escalas || []) {
    for (const papel of esc.schedule_roles || []) {
      const perfil = papel.users_profile
      
      if (papel.user_id && perfil) {
        const titulo = "📅 Lembrete de Escala"
        const mensagem = `Olá ${perfil.nome}, passando para lembrar que você está escalado para amanhã (${esc.turno}) no departamento de ${esc.departamentos?.nome}.`
        const link = `/dashboard/${esc.departamento_id}`

        try {
          // Todos os aparelhos da pessoa (o client usa a Service Role → passa pelo RLS de push_tokens)
          const r = await enviarPushParaUsuario(supabaseAdmin, papel.user_id, {
            titulo,
            mensagem,
            link: `https://servirapp.netlify.app${link}`
          })
          if (r.enviados > 0) enviados++
        } catch (err) {
          console.error(`Erro ao disparar push para ${perfil.nome}:`, err)
        }
      }
    }
  }

  console.log(`Finalizado. ${enviados} lembretes enviados.`)

  return new Response(JSON.stringify({ message: `Sucesso! ${enviados} lembretes enviados.` }), {
    headers: { "Content-Type": "application/json" },
  })
})