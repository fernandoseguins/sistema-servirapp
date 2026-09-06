// supabase/functions/lembrete-hoje/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  // Data de hoje (o cron roda em UTC; às 16h de Brasília ainda é o mesmo dia UTC)
  const hoje = new Date()
  const dataFormatada = hoje.toISOString().split('T')[0]

  console.log(`Buscando escalados para HOJE: ${dataFormatada}`)

  const { data: escalas, error } = await supabaseAdmin
    .from('schedules')
    .select(`
      id, turno, departamento_id,
      departamentos ( nome ),
      schedule_roles (
        user_id,
        funcao,
        users_profile ( nome, fcm_token )
      )
    `)
    .eq('data', dataFormatada)
    .eq('status', 'Publicada')

  if (error) {
    console.error("Erro ao buscar no banco:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`Encontrei ${escalas?.length || 0} escalas para hoje.`)

  let enviados = 0

  for (const esc of escalas || []) {
    for (const papel of esc.schedule_roles || []) {
      const perfil = papel.users_profile

      if (perfil?.fcm_token) {
        const titulo = "🙌 Hoje é seu dia de servir!"
        const mensagem = `Olá ${perfil.nome}, lembrete de que você está escalado para HOJE (${esc.turno}) no departamento de ${esc.departamentos?.nome}. Nos vemos mais tarde!`
        const link = `/dashboard/${esc.departamento_id}`

        try {
          await fetch(`${supabaseUrl}/functions/v1/enviar-notificacao`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              fcmToken: perfil.fcm_token,
              titulo,
              mensagem,
              link: `https://servirapp.netlify.app${link}`
            })
          })
          enviados++
        } catch (err) {
          console.error(`Erro ao disparar push para ${perfil.nome}:`, err)
        }
      }
    }
  }

  console.log(`Finalizado. ${enviados} lembretes de hoje enviados.`)

  return new Response(JSON.stringify({ message: `Sucesso! ${enviados} lembretes enviados.` }), {
    headers: { "Content-Type": "application/json" },
  })
})
