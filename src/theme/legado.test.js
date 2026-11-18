// src/theme/legado.test.js
// Guarda da reforma visual: telas já reformadas não podem voltar a usar
// cores soltas do Tailwind, peças antigas ou elementos não-botão clicáveis,
// e a rota delas tem que estar liberada do invólucro claro (ROTAS_NOVAS).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ROTAS_NOVAS, comeca } from '../components/shell/rotas'

// arquivo: relativo a src/. rota: caminho real de exemplo (null = sem checagem).
const TELAS_REFORMADAS = [
  { arquivo: 'pages/Hub.jsx',             rota: '/hub' },
  { arquivo: 'pages/Dashboard.jsx',       rota: '/dashboard' },
  { arquivo: 'pages/ScheduleDetails.jsx', rota: '/escala/abc' },
  { arquivo: 'pages/Profile.jsx',         rota: '/perfil' },
  { arquivo: 'pages/Auth.jsx',            rota: null },
  { arquivo: 'pages/MinhasEscalas.jsx',   rota: '/escalas' },
  { arquivo: 'pages/Avisos.jsx',          rota: '/avisos' },
  { arquivo: 'components/Skeletons.jsx',  rota: null },
  { arquivo: 'pages/Unavailability.jsx',  rota: '/indisponibilidade' },
]

const COR_ANTIGA = /\b(bg|text|border|ring|from|via|to|divide|placeholder)-(gray|slate|zinc|neutral|stone|blue|indigo|purple|violet|sky|cyan|teal|emerald|green|lime|yellow|amber|orange|red|rose|pink|fuchsia)-\d{2,3}\b/
const IMPORT_ANTIGO = /from\s+['"][^'"]*(components\/PageHeader|components\/EmptyState|departmentThemes)['"]/
const DIV_CLICAVEL = /<(div|span|li|img)\b[^>]*\bonClick=/

const ler = (arquivo) => readFileSync(new URL('../' + arquivo, import.meta.url), 'utf8')

describe.each(TELAS_REFORMADAS)('$arquivo', ({ arquivo, rota }) => {
  it('não usa cores soltas do Tailwind', () => {
    expect(ler(arquivo)).not.toMatch(COR_ANTIGA)
  })
  it('não importa peças antigas', () => {
    expect(ler(arquivo)).not.toMatch(IMPORT_ANTIGO)
  })
  it('não tem div/span/li/img clicável', () => {
    expect(ler(arquivo)).not.toMatch(DIV_CLICAVEL)
  })
  it.skipIf(!rota)('rota fora do invólucro claro', () => {
    expect(comeca(rota, ROTAS_NOVAS)).toBe(true)
  })
})

it('guarda distingue tela legada (/equipe ainda não reformada)', () => {
  expect(comeca('/equipe', ROTAS_NOVAS)).toBe(false)
})
