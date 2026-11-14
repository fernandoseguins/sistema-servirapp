// src/utils/presenca.js
// Confirmação de presença na escala (schedule_roles.status_confirmacao).
// Valores: 'Pendente' | 'Confirmado' | 'Recusado'. Linhas antigas sem valor contam como Pendente.

import { supabase } from '../supabase'

export const PENDENTE = 'Pendente'
export const CONFIRMADO = 'Confirmado'
export const RECUSADO = 'Recusado'

/** Normaliza o status (nulo/desconhecido vira Pendente). */
export function statusPresenca(status) {
  return status === CONFIRMADO || status === RECUSADO ? status : PENDENTE
}

/** Tom do <Pill> para cada status. */
export function tomPresenca(status) {
  const s = statusPresenca(status)
  return s === CONFIRMADO ? 'sucesso' : s === RECUSADO ? 'perigo' : 'aviso'
}

/** Rótulo curto exibido no selo. */
export function rotuloPresenca(status) {
  const s = statusPresenca(status)
  return s === CONFIRMADO ? 'Confirmado' : s === RECUSADO ? 'Não vai' : 'Pendente'
}

/** Status agregado de vários papéis da mesma pessoa: Recusado > Pendente > Confirmado. */
export function statusAgregado(papeis = []) {
  const lista = papeis.map(p => statusPresenca(p?.status_confirmacao))
  if (lista.length === 0) return PENDENTE
  if (lista.includes(RECUSADO)) return RECUSADO
  if (lista.includes(PENDENTE)) return PENDENTE
  return CONFIRMADO
}

/** Contagem por status: { confirmados, pendentes, recusados }. */
export function contarPresenca(papeis = []) {
  const c = { confirmados: 0, pendentes: 0, recusados: 0 }
  for (const p of papeis) {
    const s = statusPresenca(p?.status_confirmacao)
    if (s === CONFIRMADO) c.confirmados++
    else if (s === RECUSADO) c.recusados++
    else c.pendentes++
  }
  return c
}

/** Texto do resumo: "5 confirmados · 2 pendentes · 1 recusou". Partes zeradas somem. */
export function resumoPresenca(papeis = []) {
  const { confirmados, pendentes, recusados } = contarPresenca(papeis)
  const partes = []
  if (confirmados) partes.push(`${confirmados} ${confirmados === 1 ? 'confirmado' : 'confirmados'}`)
  if (pendentes) partes.push(`${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`)
  if (recusados) partes.push(`${recusados} ${recusados === 1 ? 'recusou' : 'recusaram'}`)
  return partes.join(' · ')
}

/**
 * Responde a escala pela RPC (o banco valida dono do papel, data e valor,
 * e notifica os líderes quando recusa). Retorna { ok, erro }.
 */
export async function responderEscala(roleId, status) {
  const { error } = await supabase.rpc('responder_escala', { p_role_id: roleId, p_status: status })
  if (error) {
    console.warn('Erro ao responder escala:', error.message)
    return { ok: false, erro: error.message }
  }
  return { ok: true, erro: null }
}
