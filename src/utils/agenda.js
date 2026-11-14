// src/utils/agenda.js
// "Adicionar à agenda": gera arquivo .ics (RFC 5545) e link do Google Agenda
// para uma escala. Funções puras — sem DOM, fáceis de testar.
//
// FUSO: o app é usado no Brasil (America/Sao_Paulo). As horas são escritas
// como horário LOCAL com TZID (no .ics) e com `ctz` (no Google), nunca
// convertidas para UTC — assim 19:00 continua 19:00 em qualquer aparelho.

export const FUSO = 'America/Sao_Paulo'

// O banco não guarda o horário do culto, só o turno. Ajuste aqui se a igreja
// mudar os horários. Turno sem entrada (ex.: 'Integral') vira evento de dia inteiro.
export const HORARIOS_TURNO = {
  'Manhã': { inicio: '09:00', fim: '11:30' },
  'Tarde': { inicio: '15:00', fim: '17:00' },
  'Noite': { inicio: '19:00', fim: '21:00' },
  'Extra': { inicio: '19:00', fim: '21:00' }, // culto extra: sem horário no banco, assume noite
}

// Alarme padrão: 2h antes do início
export const ALARME_PADRAO_MIN = 120

const DOMINIO_UID = 'escala-louvor'

/**
 * Monta o objeto de evento a partir de uma escala do banco.
 * @param {object} escala   linha de `schedules` (id, data, turno, titulo, horario_ensaio)
 * @param {object} opts     { departamento, funcoes: string | string[] }
 */
export function eventoDaEscala(escala, { departamento = '', funcoes = [] } = {}) {
  return {
    id: escala.id,
    data: escala.data,
    turno: escala.turno || null,
    titulo: escala.titulo || '',
    departamento: departamento || '',
    funcoes: Array.isArray(funcoes) ? funcoes.filter(Boolean) : (funcoes ? [funcoes] : []),
    ensaio: escala.horario_ensaio || '',
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

const doisDigitos = (n) => String(n).padStart(2, '0')

// '2026-12-06' → '20261206'
const dataCompacta = (iso) => iso.replaceAll('-', '')

// '2026-12-06' + '19:00' → '20261206T190000'
const dataHoraCompacta = (iso, hhmm) => `${dataCompacta(iso)}T${hhmm.replace(':', '')}00`

// Dia seguinte em 'YYYY-MM-DD', calculado em UTC puro (só aritmética de calendário)
function diaSeguinte(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + 1))
  return `${dt.getUTCFullYear()}-${doisDigitos(dt.getUTCMonth() + 1)}-${doisDigitos(dt.getUTCDate())}`
}

// Instante em UTC no formato iCalendar: 20261114T153000Z
function carimboUTC(date) {
  return `${date.getUTCFullYear()}${doisDigitos(date.getUTCMonth() + 1)}${doisDigitos(date.getUTCDate())}T` +
    `${doisDigitos(date.getUTCHours())}${doisDigitos(date.getUTCMinutes())}${doisDigitos(date.getUTCSeconds())}Z`
}

/** Escapa texto conforme RFC 5545 §3.3.11 (\\ ; , e quebras de linha). */
export function escaparTexto(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// Dobra linhas com mais de 75 octetos (RFC 5545 §3.1), sem partir caracteres UTF-8
function dobrarLinha(linha) {
  const enc = new TextEncoder()
  if (enc.encode(linha).length <= 75) return linha
  const partes = []
  let atual = ''
  let bytes = 0
  let limite = 75
  for (const ch of linha) {
    const b = enc.encode(ch).length
    if (bytes + b > limite) {
      partes.push(atual)
      atual = ''
      bytes = 0
      limite = 74 // linhas de continuação começam com um espaço
    }
    atual += ch
    bytes += b
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

/** Horário do evento: { diaInteiro, inicio, fim } (inicio/fim 'HH:MM' ou datas ISO). */
export function horarioDoEvento(evento) {
  const h = evento.turno && HORARIOS_TURNO[evento.turno]
  if (h) return { diaInteiro: false, inicio: h.inicio, fim: h.fim }
  return { diaInteiro: true, inicio: evento.data, fim: diaSeguinte(evento.data) }
}

export function resumoDoEvento(evento) {
  const dept = evento.departamento ? ` ${evento.departamento}` : ''
  const turno = evento.turno ? ` — ${evento.turno}` : ''
  const titulo = evento.titulo ? ` · ${evento.titulo}` : ''
  return `Escala${dept}${turno}${titulo}`
}

export function descricaoDoEvento(evento) {
  const linhas = []
  if (evento.funcoes?.length) linhas.push(`Sua função: ${evento.funcoes.join(' + ')}`)
  if (evento.ensaio) linhas.push(`Ensaio: ${evento.ensaio}`)
  if (evento.titulo) linhas.push(evento.titulo)
  const h = horarioDoEvento(evento)
  if (!h.diaInteiro) linhas.push(`Horário estimado do culto: ${h.inicio}–${h.fim}`)
  return linhas.join('\n')
}

// Brasil não tem horário de verão desde 2019: offset fixo -03:00
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${FUSO}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:-0300',
  'TZOFFSETTO:-0300',
  'TZNAME:-03',
  'END:STANDARD',
  'END:VTIMEZONE',
]

/**
 * Gera o conteúdo de um arquivo .ics (VCALENDAR com um VEVENT).
 * @param {object} evento  saída de eventoDaEscala()
 * @param {object} opts    { alarmeMinutos = 120 (null/0 desliga), agora = new Date() }
 */
export function gerarIcs(evento, { alarmeMinutos = ALARME_PADRAO_MIN, agora = new Date() } = {}) {
  const h = horarioDoEvento(evento)
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Escala Louvor//Escala//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  if (!h.diaInteiro) linhas.push(...VTIMEZONE)
  linhas.push(
    'BEGIN:VEVENT',
    `UID:escala-${evento.id}@${DOMINIO_UID}`,
    `DTSTAMP:${carimboUTC(agora)}`,
  )
  if (h.diaInteiro) {
    linhas.push(`DTSTART;VALUE=DATE:${dataCompacta(h.inicio)}`, `DTEND;VALUE=DATE:${dataCompacta(h.fim)}`)
  } else {
    linhas.push(
      `DTSTART;TZID=${FUSO}:${dataHoraCompacta(evento.data, h.inicio)}`,
      `DTEND;TZID=${FUSO}:${dataHoraCompacta(evento.data, h.fim)}`,
    )
  }
  linhas.push(`SUMMARY:${escaparTexto(resumoDoEvento(evento))}`)
  const descricao = descricaoDoEvento(evento)
  if (descricao) linhas.push(`DESCRIPTION:${escaparTexto(descricao)}`)
  // Alarme não faz sentido em evento de dia inteiro (dispararia na véspera)
  if (alarmeMinutos && !h.diaInteiro) {
    linhas.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escaparTexto(resumoDoEvento(evento))}`,
      `TRIGGER:-PT${Math.round(alarmeMinutos)}M`,
      'END:VALARM',
    )
  }
  linhas.push('END:VEVENT', 'END:VCALENDAR')
  return linhas.map(dobrarLinha).join('\r\n') + '\r\n'
}

/** Link "criar evento" do Google Agenda, com horário local + ctz. */
export function linkGoogleAgenda(evento) {
  const h = horarioDoEvento(evento)
  const datas = h.diaInteiro
    ? `${dataCompacta(h.inicio)}/${dataCompacta(h.fim)}`
    : `${dataHoraCompacta(evento.data, h.inicio)}/${dataHoraCompacta(evento.data, h.fim)}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: resumoDoEvento(evento),
    dates: datas,
    details: descricaoDoEvento(evento),
  })
  if (!h.diaInteiro) params.set('ctz', FUSO)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Nome de arquivo seguro: escala-louvor-2026-12-06-noite.ics */
export function nomeArquivoIcs(evento) {
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return ['escala', slug(evento.departamento), evento.data, slug(evento.turno)].filter(Boolean).join('-') + '.ics'
}
