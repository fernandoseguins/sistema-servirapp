// supabase/functions/_shared/data.ts
// Datas no fuso da igreja. `new Date().toISOString()` é UTC: entre 21h e 0h
// (horário de Brasília) ele já devolve o dia seguinte.

const FUSO = 'America/Sao_Paulo'

// 'YYYY-MM-DD' de hoje (+ diasAFrente) no horário de Brasília
export function dataBrasil(diasAFrente = 0): string {
  const instante = new Date(Date.now() + diasAFrente * 24 * 60 * 60 * 1000)
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(instante)
}
