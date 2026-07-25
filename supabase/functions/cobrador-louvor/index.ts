import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2' // ✅ Corrigido aqui: supabase-js

// Puxa a chave do Resend que guardámos no servidor
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  // Conecta ao banco de dados com poder máximo (Service Role)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Calcula a data exata de daqui a 4 dias
  const dataAlvo = new Date()
  dataAlvo.setDate(dataAlvo.getDate() + 4)
  const dataFormatada = dataAlvo.toISOString().split('T')[0]

  // Busca todas as escalas do Louvor para essa data
  const { data: escalas, error } = await supabaseAdmin
    .from('schedules')
    .select(`
      id, data, turno, departamento_id,
      departamentos!inner(nome),
      schedule_roles!inner(user_id, funcao, users_profile(nome, email)),
      schedule_songs(id)
    `)
    .eq('data', dataFormatada)
    .eq('departamentos.nome', 'Louvor')

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  let cobrancasFeitas = 0

  for (const esc of escalas || []) {
    const quantidadeMusicas = esc.schedule_songs?.length || 0
    
    // Se a pessoa não colocou pelo menos 1 música, a cobrança acontece!
    if (quantidadeMusicas === 0) {
      // Procura quem é o condutor desta escala
      const condutor = esc.schedule_roles.find(r => r.funcao.includes('Condução'))
      
      if (condutor) {
        const userId = condutor.user_id
        const emailCondutor = condutor.users_profile.email
        const nomeCondutor = condutor.users_profile.nome

        // 1. Envia NOTIFICAÇÃO no Sininho do App
        await supabaseAdmin.from('notifications').insert([{
          user_id: userId,
          departamento_id: esc.departamento_id,
          titulo: "🚨 Repertório Vazio!",
          mensagem: `Atenção ${nomeCondutor}! Faltam 4 dias para o culto de ${esc.turno} e você ainda não adicionou os louvores. A equipa precisa ensaiar!`,
          tipo: "aviso"
        }])

        // 2. Dispara o E-MAIL via Resend
        if (emailCondutor) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Portal da Igreja <onboarding@resend.dev>', // O e-mail padrão gratuito do Resend
              to: emailCondutor,
              subject: `🚨 Lembrete URGENTE: Repertório do dia ${dataFormatada}`,
              html: `<div style="font-family: sans-serif; padding: 20px; background: #f9fafb; border-radius: 10px;">
                      <h2 style="color: #dc2626;">Graça e Paz, ${nomeCondutor}!</h2>
                      <p>Faltam apenas <strong>4 dias</strong> para o seu culto de condução (<strong>${esc.turno}</strong>) e o repertório ainda está em branco.</p>
                      <p>Por favor, aceda ao portal e adicione as músicas para que a banda possa estudar as cifras e os tons.</p>
                      <p><em>Equipa de Liderança 🦅</em></p>
                     </div>`
            })
          })
        }
        cobrancasFeitas++
      }
    }
  }

  return new Response(JSON.stringify({ message: `Cálculo terminado! ${cobrancasFeitas} cobranças enviadas.` }), {
    headers: { "Content-Type": "application/json" },
  })
})