import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2' // ✅ Corrigido aqui: supabase-js
import { exigirServiceRole, escaparHtml } from '../_shared/seguranca.ts'
import { dataBrasil } from '../_shared/data.ts'

// Puxa a chave do Resend que guardamos no servidor
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const APP_URL = 'https://servirapp.netlify.app'

// Mesma regra de src/utils/escalas.js (rotuloTurno): "Noite" → "Culto da noite"
function rotuloTurno(turno?: string | null): string {
  if (!turno) return 'Culto'
  if (turno === 'Integral') return 'Culto principal'
  if (turno === 'Extra') return 'Culto extra'
  return `Culto da ${turno.toLowerCase()}`
}

function primeiroNome(nome?: string | null): string {
  return (nome || '').trim().split(' ')[0] || ''
}

// "2026-11-18" → "18/11"
function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

serve(async (req) => {
  // Só o cron (Service Role Key) pode disparar — senão qualquer um com a chave anon mandaria e-mails em massa.
  const negado = exigirServiceRole(req)
  if (negado) return negado

  // Conecta ao banco de dados com poder máximo (Service Role)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Calcula a data exata de daqui a 4 dias
  // (horário de Brasília — toISOString é UTC e erra o dia à noite)
  const dataFormatada = dataBrasil(4)

  // Busca todas as escalas publicadas do Louvor para essa data
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
    .eq('status', 'Publicada')

  if (error) {
    console.error('Erro ao buscar escalas:', error.message)
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500 })
  }

  let cobrancasFeitas = 0

  for (const esc of escalas || []) {
    const quantidadeMusicas = esc.schedule_songs?.length || 0

    // Se a pessoa não colocou pelo menos 1 música, a cobrança acontece!
    if (quantidadeMusicas !== 0) continue

    // Procura quem é o condutor desta escala
    // deno-lint-ignore no-explicit-any
    const condutor = (esc.schedule_roles || []).find((r: any) => r.funcao?.includes('Condução'))
    const perfil = condutor?.users_profile
    if (!condutor?.user_id || !perfil) continue

    const userId = condutor.user_id
    const emailCondutor = perfil.email
    const nomeCompleto = perfil.nome || ''
    const nome = primeiroNome(nomeCompleto)
    const turno = rotuloTurno(esc.turno)
    const data = ddmm(esc.data || dataFormatada)
    const caminho = `/escala/${esc.id}`

    // 1. Envia NOTIFICAÇÃO no Sininho do App
    // Obs.: o push sai pelo gatilho da tabela notifications, que não repassa `tag`.
    const { error: erroNotif } = await supabaseAdmin.from('notifications').insert([{
      user_id: userId,
      departamento_id: esc.departamento_id,
      titulo: "🎵 Repertório pendente",
      mensagem: `Oi, ${nome}! Faltam 4 dias para o ${turno} (${data}) e o repertório ainda está vazio. A equipe precisa ensaiar!`,
      tipo: "aviso",
      link_redirecionamento: caminho,
    }])
    if (erroNotif) console.error('Erro ao inserir notificação:', erroNotif.message)

    // 2. Dispara o E-MAIL via Resend
    if (emailCondutor) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Portal da Igreja <onboarding@resend.dev>', // O e-mail padrão gratuito do Resend
            to: emailCondutor,
            subject: `🎵 Lembrete: repertório do dia ${data}`,
            html: `<div style="font-family: sans-serif; padding: 20px; background: #f9fafb; border-radius: 10px;">
                    <h2 style="color: #dc2626;">Graça e paz, ${escaparHtml(nome)}!</h2>
                    <p>Faltam apenas <strong>4 dias</strong> para o culto que você vai conduzir (<strong>${escaparHtml(turno)}</strong>, ${data}) e o repertório ainda está em branco.</p>
                    <p>Por favor, <a href="${APP_URL}${caminho}">acesse o app</a> e adicione as músicas para que a banda possa estudar as cifras e os tons.</p>
                    <p><em>Equipe de liderança 🦅</em></p>
                   </div>`
          })
        })
      } catch (err) {
        console.error('Erro ao enviar e-mail:', err)
      }
    }
    cobrancasFeitas++
  }

  return new Response(JSON.stringify({ message: `Cálculo terminado! ${cobrancasFeitas} cobranças enviadas.` }), {
    headers: { "Content-Type": "application/json" },
  })
})
