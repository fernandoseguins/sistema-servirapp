import { describe, it, expect } from 'vitest'
import { eventoDaEscala, gerarIcs, linkGoogleAgenda, escaparTexto, nomeArquivoIcs } from './agenda'

const AGORA = new Date(Date.UTC(2026, 10, 14, 15, 30, 0))

const escalaNoite = { id: 'abc-123', data: '2026-12-06', turno: 'Noite', titulo: '', horario_ensaio: 'Após o culto da manhã' }
const evNoite = eventoDaEscala(escalaNoite, { departamento: 'Louvor', funcoes: 'Voz Principal, Violão' })

describe('escaparTexto', () => {
  it('escapa barra, ponto e vírgula, vírgula e quebras', () => {
    expect(escaparTexto('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf')
  })
  it('tolera nulo', () => expect(escaparTexto(null)).toBe(''))
})

describe('gerarIcs', () => {
  const ics = gerarIcs(evNoite, { agora: AGORA })
  const linhas = ics.split('\r\n')

  it('usa CRLF e termina com CRLF', () => {
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })
  it('tem estrutura VCALENDAR/VEVENT', () => {
    expect(linhas[0]).toBe('BEGIN:VCALENDAR')
    expect(linhas).toContain('VERSION:2.0')
    expect(linhas).toContain('BEGIN:VEVENT')
    expect(linhas).toContain('END:VEVENT')
    expect(linhas.at(-2)).toBe('END:VCALENDAR')
  })
  it('UID estável baseado no id da escala', () => {
    expect(linhas).toContain('UID:escala-abc-123@escala-louvor')
    expect(gerarIcs(evNoite, { agora: new Date() })).toContain('UID:escala-abc-123@escala-louvor')
  })
  it('DTSTAMP em UTC', () => expect(linhas).toContain('DTSTAMP:20261114T153000Z'))
  it('horário local com TZID de São Paulo, sem converter para UTC', () => {
    expect(linhas).toContain('DTSTART;TZID=America/Sao_Paulo:20261206T190000')
    expect(linhas).toContain('DTEND;TZID=America/Sao_Paulo:20261206T210000')
    expect(linhas).toContain('TZID:America/Sao_Paulo')
  })
  it('SUMMARY com departamento e turno', () => {
    expect(linhas).toContain('SUMMARY:Escala Louvor — Noite')
  })
  it('DESCRIPTION com função e ensaio escapados', () => {
    const desc = ics.replace(/\r\n /g, '').split('\r\n').find(l => l.startsWith('DESCRIPTION:Sua'))
    expect(desc).toContain('Sua função: Voz Principal\\, Violão')
    expect(desc).toContain('\\nEnsaio: Após o culto da manhã')
  })
  it('alarme 2h antes por padrão, e pode ser desligado', () => {
    expect(linhas).toContain('BEGIN:VALARM')
    expect(linhas).toContain('TRIGGER:-PT120M')
    expect(gerarIcs(evNoite, { agora: AGORA, alarmeMinutos: null })).not.toContain('VALARM')
  })
  it('nenhuma linha passa de 75 octetos', () => {
    const longo = eventoDaEscala({ ...escalaNoite, titulo: 'Culto de celebração com ministração especial '.repeat(4) }, { departamento: 'Louvor', funcoes: ['Teclado'] })
    const enc = new TextEncoder()
    for (const l of gerarIcs(longo, { agora: AGORA }).split('\r\n')) expect(enc.encode(l).length).toBeLessThanOrEqual(75)
  })
  it('turno Integral vira evento de dia inteiro, sem alarme', () => {
    const ev = eventoDaEscala({ id: 'x', data: '2026-12-31', turno: 'Integral' }, { departamento: 'Diaconia' })
    const t = gerarIcs(ev, { agora: AGORA })
    expect(t).toContain('DTSTART;VALUE=DATE:20261231')
    expect(t).toContain('DTEND;VALUE=DATE:20270101')
    expect(t).not.toContain('VALARM')
    expect(t).not.toContain('VTIMEZONE')
  })
})

describe('linkGoogleAgenda', () => {
  it('monta link com datas locais e ctz', () => {
    const url = new URL(linkGoogleAgenda(evNoite))
    expect(url.origin).toBe('https://calendar.google.com')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Escala Louvor — Noite')
    expect(url.searchParams.get('dates')).toBe('20261206T190000/20261206T210000')
    expect(url.searchParams.get('ctz')).toBe('America/Sao_Paulo')
    expect(url.searchParams.get('details')).toContain('Ensaio: Após o culto da manhã')
  })
  it('manhã usa horário padrão', () => {
    const ev = eventoDaEscala({ id: 'm', data: '2026-12-06', turno: 'Manhã', horario_ensaio: '08:00' }, { departamento: 'Louvor' })
    expect(new URL(linkGoogleAgenda(ev)).searchParams.get('dates')).toBe('20261206T090000/20261206T113000')
  })
  it('dia inteiro usa datas sem hora', () => {
    const ev = eventoDaEscala({ id: 'i', data: '2026-12-06', turno: 'Integral' })
    const url = new URL(linkGoogleAgenda(ev))
    expect(url.searchParams.get('dates')).toBe('20261206/20261207')
    expect(url.searchParams.get('ctz')).toBeNull()
  })
})

describe('nomeArquivoIcs', () => {
  it('gera nome sem acentos', () => {
    expect(nomeArquivoIcs(eventoDaEscala({ id: 'm', data: '2026-12-06', turno: 'Manhã' }, { departamento: 'Mídia' })))
      .toBe('escala-midia-2026-12-06-manha.ics')
  })
})
