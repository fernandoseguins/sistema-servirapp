// src/utils/cantinaRotacao.js
// Rotação de responsáveis pela Cantina, por domingo.
// Louvor → Diaconia → Infantil → Mídia (cíclico e CONTÍNUO entre meses).
//
// Fonte única desta regra: usada em CantinaSchedule.jsx (montagem da escala)
// e em ScheduleBoard.jsx (rótulo do card quando o quadro é da Cantina).
// Se precisar recalibrar, mude SÓ aqui.

// Sequência fixa de responsáveis por domingo.
export const SEQUENCIA_DEPTS_CANTINA = ['Louvor', 'Diaconia', 'Infantil', 'Mídia']

// Domingo-âncora: marco zero da sequência (este domingo = índice 0 = Louvor).
// Calibrado: 28/06/2026 = Mídia.
export const DOMINGO_ANCORA_CANTINA = new Date(2026, 5, 7) // 07/06/2026 (domingo)

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000

// Aceita um Date ou uma string 'YYYY-MM-DD' e devolve um Date com a hora zerada
// (evita problemas de fuso/horário de verão).
function normalizarData(data) {
  if (data instanceof Date) {
    return new Date(data.getFullYear(), data.getMonth(), data.getDate())
  }
  const [ano, mes, dia] = String(data).split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

// Conta quantos domingos existem entre a âncora e uma data (contínuo entre meses).
export function indiceDomingoGlobalCantina(data) {
  const a = normalizarData(DOMINGO_ANCORA_CANTINA)
  const b = normalizarData(data)
  return Math.round((b - a) / MS_POR_SEMANA)
}

// Departamento responsável pela Cantina numa data (Date ou 'YYYY-MM-DD').
export function deptResponsavelCantina(data) {
  const idx = indiceDomingoGlobalCantina(data)
  const n = SEQUENCIA_DEPTS_CANTINA.length
  return SEQUENCIA_DEPTS_CANTINA[((idx % n) + n) % n]
}
