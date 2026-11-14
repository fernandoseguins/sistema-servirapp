// src/utils/escalas.js
// Agrupa escalas por mês. Datas "YYYY-MM-DD" são tratadas como texto/local
// (sem converter para UTC), para o dia 1º não cair no mês anterior.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

// "2026-12-06" → "Domingo, 06/12" (meio-dia local, para não mudar de dia por fuso)
export function dataComDia(iso) {
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS[d.getDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

// "Noite" → "Culto da noite"; tolera turno vazio (coluna aceita nulo)
export function rotuloTurno(turno) {
  if (!turno) return 'Culto'
  if (turno === 'Integral') return 'Culto principal'
  if (turno === 'Extra') return 'Culto extra'
  return `Culto da ${turno.toLowerCase()}`
}

export function agruparPorMes(escalas) {
  const ordenadas = [...escalas].sort((a, b) => a.data.localeCompare(b.data))
  const grupos = []
  for (const e of ordenadas) {
    const chave = e.data.slice(0, 7)
    let g = grupos[grupos.length - 1]
    if (!g || g.chave !== chave) {
      const [ano, mes] = chave.split('-')
      g = { chave, titulo: `${MESES[Number(mes) - 1]} de ${ano}`, itens: [] }
      grupos.push(g)
    }
    g.itens.push(e)
  }
  return grupos
}
