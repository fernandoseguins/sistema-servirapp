// supabase/functions/lembrete-hoje/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { exigirServiceRole } from '../_shared/seguranca.ts'
import { enviarPushParaUsuario } from '../_shared/push.ts'

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

// ["Violão", "Voz", "Teclado"] → "Violão, Voz e Teclado"
function juntarFuncoes(funcoes: string[]): string {
  if (funcoes.length <= 1) return funcoes[0] || ''
  return `${funcoes.slice(0, -1).join(', ')} e ${funcoes[funcoes.length - 1]}`
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

  // Data de hoje (o cron roda em UTC; às 16h de Brasília ainda é o mesmo dia UTC)
  const hoje = new Date()
  const dataFormatada = hoje.toISOString().split('T')[0]

  console.log(`Buscando escalas para HOJE: ${dataFormatada}`)

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

  console.log(`Encontrei ${escalas?.length || 0} escalas para hoje.`)

  let enviados = 0

  for (const esc of escalas || []) {
    // Uma pessoa com 2+ funções na mesma escala recebe UM push só (funções juntas).
    const porUsuario = new Map<string, { nome: string; funcoes: string[] }>()
    for (const papel of esc.schedule_roles || []) {
      const perfil = papel.users_profile
      if (!papel.user_id || !perfil) continue
      const atual = porUsuario.get(papel.user_id) ?? { nome: perfil.nome, funcoes: [] }
      if (papel.funcao && !atual.funcoes.includes(papel.funcao)) atual.funcoes.push(papel.funcao)
      porUsuario.set(papel.user_id, atual)
    }

    const turno = rotuloTurno(esc.turno)
    const departamento = esc.departamentos?.nome || 'seu departamento'

    for (const [userId, { nome, funcoes }] of porUsuario) {
      const titulo = "⏰ Hoje você serve"
      const base = `Oi, ${primeiroNome(nome)}! Hoje (${turno}) você está na escala de ${departamento}`
      const comFuncoes = funcoes.length ? `${base} como ${juntarFuncoes(funcoes)}.` : `${base}.`
      const mensagem = comFuncoes.length <= 120 ? comFuncoes : `${base}.`

      try {
        // Todos os aparelhos da pessoa (o client usa a Service Role → passa pelo RLS de push_tokens)
        const r = await enviarPushParaUsuario(supabaseAdmin, userId, {
          titulo,
          mensagem,
          link: `https://servirapp.netlify.app/dashboard/${esc.departamento_id}`,
          tag: `lembrete-${esc.id}`,
        })
        if (r.enviados > 0) enviados++
      } catch (err) {
        console.error(`Erro ao disparar push para ${nome}:`, err)
      }
    }
  }

  console.log(`Finalizado. ${enviados} lembretes de hoje enviados.`)

  return new Response(JSON.stringify({ message: `Sucesso! ${enviados} lembretes enviados.` }), {
    headers: { "Content-Type": "application/json" },
  })
})
