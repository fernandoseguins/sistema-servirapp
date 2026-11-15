// supabase/functions/cobrar-louvor-intensivo/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { exigirServiceRole } from '../_shared/seguranca.ts'
import { enviarPushParaUsuario } from '../_shared/push.ts'
import { dataBrasil } from '../_shared/data.ts'

const MINIMO_MUSICAS = 3

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

// 1 → "1 música"; 2 → "2 músicas"
function musicas(n: number): string {
  return `${n} ${n === 1 ? 'música' : 'músicas'}`
}

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

  // Datas no horário de Brasília (toISOString é UTC e erra o dia à noite)
  const hoje = dataBrasil()
  const limiteFormatado = dataBrasil(3)

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
        users_profile(nome)
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
    if (qtdMusicas >= MINIMO_MUSICAS) continue

    // deno-lint-ignore no-explicit-any
    const condutor = (esc.schedule_roles || []).find((r: any) => r.funcao?.includes('Condução'))
    const perfil = condutor?.users_profile
    if (!condutor?.user_id || !perfil) continue

    const eHoje = esc.data === hoje
    const nome = primeiroNome(perfil.nome)
    const turno = rotuloTurno(esc.turno)
    const faltam = MINIMO_MUSICAS - qtdMusicas

    let titulo: string
    let mensagem: string
    if (eHoje) {
      titulo = qtdMusicas === 0 ? "⚠️ Repertório de hoje vazio" : "⚠️ Repertório de hoje incompleto"
      mensagem = qtdMusicas === 0
        ? `Oi, ${nome}! Hoje (${turno}) o repertório ainda não tem músicas. Adicione agora.`
        : `Oi, ${nome}! Hoje (${turno}) o repertório tem só ${musicas(qtdMusicas)}. Adicione mais ${faltam} para chegar a ${MINIMO_MUSICAS}.`
    } else {
      const data = ddmm(esc.data)
      titulo = "🎵 Repertório pendente"
      mensagem = qtdMusicas === 0
        ? `Oi, ${nome}! O repertório de ${data} (${turno}) ainda não tem músicas. Que tal montar agora?`
        : `Oi, ${nome}! ${faltam === 1 ? 'Falta' : 'Faltam'} ${musicas(faltam)} no repertório de ${data} (${turno}) para chegar a ${MINIMO_MUSICAS}.`
    }

    try {
      // Todos os aparelhos do condutor (o client usa a Service Role → passa pelo RLS de push_tokens)
      // Mesma tag do cobrador-louvor: cobranças repetidas substituem a anterior no aparelho.
      const r = await enviarPushParaUsuario(supabaseAdmin, condutor.user_id, {
        titulo,
        mensagem,
        link: `https://servirapp.netlify.app/escala/${esc.id}`,
        tag: `repertorio-${esc.id}`,
      })
      if (r.enviados > 0) lembretesEnviados++
    } catch (err) {
      console.error("Erro ao enviar push:", err)
    }
  }

  return new Response(JSON.stringify({ message: `Processado! ${lembretesEnviados} lembretes enviados.` }), {
    headers: { "Content-Type": "application/json" },
  })
})
