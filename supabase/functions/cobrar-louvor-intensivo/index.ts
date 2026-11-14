// supabase/functions/cobrar-louvor-intensivo/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { exigirServiceRole } from '../_shared/seguranca.ts'

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

  const hoje = new Date().toISOString().split('T')[0]
  
  const dataLimite = new Date()
  dataLimite.setDate(dataLimite.getDate() + 3)
  const limiteFormatado = dataLimite.toISOString().split('T')[0]

  console.log(`Verificando cobranças pendentes entre ${hoje} e ${limiteFormatado}`)

  const { data: escalas, error } = await supabaseAdmin
    .from('schedules')
    .select(`
      id, data, turno,
      departamentos!inner(nome),
      schedule_songs(id),
      schedule_roles!inner(
        user_id,
        funcao,
        users_profile(nome, fcm_token)
      )
    `)
    .eq('departamentos.nome', 'Louvor')
    .gte('data', hoje)           
    .lte('data', limiteFormatado) 
    .eq('status', 'Publicada')    

  if (error) {
    console.error("Erro no banco:", error.message)
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500 })
  }

  console.log(`Analisando ${escalas?.length || 0} escalas de louvor.`)

  let lembretesEnviados = 0

  for (const esc of escalas || []) {
    const qtdMusicas = esc.schedule_songs?.length || 0

    if (qtdMusicas < 3) {
      const condutor = esc.schedule_roles.find(r => r.funcao.includes('Condução'))
      const perfil = condutor?.users_profile

      if (perfil?.fcm_token) {
        const dataEscala = esc.data;
        const eHoje = dataEscala === hoje;
        
        const titulo = eHoje ? "🚨 REPERTÓRIO URGENTE!" : "🎸 Lembrete de Repertório";
        
        let mensagem = "";
        if (qtdMusicas === 0) {
          mensagem = eHoje 
            ? `ATENÇÃO ${perfil.nome}! Sua escala é HOJE (${esc.turno}) e o repertório está VAZIO. Adicione agora!`
            : `Olá ${perfil.nome}! Sua escala (${esc.turno}) está chegando e ainda não tem músicas.`;
        } else {
          mensagem = eHoje
            ? `URGENTE: Sua escala é hoje e só tem ${qtdMusicas} música(s). Complete o mínimo de 3!`
            : `Olá ${perfil.nome}! Faltam apenas ${3 - qtdMusicas} música(s) para completar o mínimo da sua escala.`;
        }

        try {
          await fetch(`${supabaseUrl}/functions/v1/enviar-notificacao`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              fcmToken: perfil.fcm_token,
              titulo: titulo,
              mensagem: mensagem,
              link: `https://servirapp.netlify.app/escala/${esc.id}`
            })
          })
          lembretesEnviados++
        } catch (err) {
          console.error("Erro ao enviar push:", err)
        }
      }
    }
  }

  return new Response(JSON.stringify({ message: `Processado! ${lembretesEnviados} lembretes enviados.` }), {
    headers: { "Content-Type": "application/json" },
  })
})