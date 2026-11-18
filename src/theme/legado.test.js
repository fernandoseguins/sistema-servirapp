// src/theme/legado.test.js
// Guarda da reforma visual: telas não podem voltar a usar cores soltas do
// Tailwind, peças antigas ou elementos não-botão clicáveis; e nada no app pode
// voltar a importar as peças do visual antigo (removidas na fase 3).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

// Relativo a src/.
const TELAS_REFORMADAS = [
  'pages/Hub.jsx',
  'pages/Dashboard.jsx',
  'pages/ScheduleDetails.jsx',
  'pages/Profile.jsx',
  'pages/Auth.jsx',
  'pages/MinhasEscalas.jsx',
  'pages/Avisos.jsx',
  'components/Skeletons.jsx',
  'components/InstallPrompt.jsx',
  'pages/Unavailability.jsx',
  'pages/SwapRequests.jsx',
  'pages/Team.jsx',
  'pages/Songs.jsx',
  'pages/CreateNotice.jsx',
  'pages/AvisoGeral.jsx',
  'pages/GlobalNotice.jsx',
  'pages/FrequencyReport.jsx',
  'pages/GenerateSchedule.jsx',
  'pages/CantinaSchedule.jsx',
  'pages/MinistrosSchedule.jsx',
  'pages/InfantilLessons.jsx',
  'pages/InfantilCheckin.jsx',
  'pages/Cabine.jsx',
  'pages/ChecklistMidia.jsx',
  'pages/PrintSchedules.jsx',
  'pages/GestaoIgreja.jsx',
  'pages/PainelDono.jsx',
  'pages/IgrejaDetalhes.jsx',
  'pages/CriarIgreja.jsx',
]

const COR_ANTIGA = /\b(bg|text|border|ring|from|via|to|divide|placeholder)-(gray|slate|zinc|neutral|stone|blue|indigo|purple|violet|sky|cyan|teal|emerald|green|lime|yellow|amber|orange|red|rose|pink|fuchsia)-\d{2,3}\b/
const IMPORT_ANTIGO = /from\s+['"][^'"]*(components\/PageHeader|components\/EmptyState|departmentThemes|TemaClaroForcado|GlobalUserMenu)['"]/
const DIV_CLICAVEL = /<(div|span|li|img)\b[^>]*\bonClick=/

const SRC = new URL('../', import.meta.url)
const ler = (arquivo) => readFileSync(new URL(arquivo, SRC), 'utf8')

describe.each(TELAS_REFORMADAS)('%s', (arquivo) => {
  it('não usa cores soltas do Tailwind', () => {
    expect(ler(arquivo)).not.toMatch(COR_ANTIGA)
  })
  it('não tem div/span/li/img clicável', () => {
    expect(ler(arquivo)).not.toMatch(DIV_CLICAVEL)
  })
})

it('nenhum arquivo do app importa peças do visual antigo', () => {
  const arquivos = readdirSync(SRC, { recursive: true })
    .map(String)
    .filter(f => /\.(js|jsx)$/.test(f) && !f.endsWith('.test.js'))
  const culpados = arquivos.filter(f => IMPORT_ANTIGO.test(ler(f.replaceAll('\\', '/'))))
  expect(culpados).toEqual([])
})
