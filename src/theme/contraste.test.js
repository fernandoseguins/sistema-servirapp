// Garante contraste WCAG AA (4,5:1) dos pares de cor usados em texto, nos dois temas.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf-8')

function tokens(seletorRegex) {
  const bloco = css.match(seletorRegex)?.[1] ?? ''
  const out = {}
  for (const [, nome, r, g, b] of bloco.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) out[nome] = [+r, +g, +b]
  return out
}
const CLARO = tokens(/:root,\s*\.tema-claro-forcado\s*\{([\s\S]*?)\n {2}\}/)
const ESCURO = tokens(/\.dark\s*\{([\s\S]*?)\n {2}\}/)

const lum = ([r, g, b]) => {
  const c = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

// [texto, fundo]
const PARES = [
  ['ink-2', 'surface'],       // abas inativas do menu, textos secundários
  ['accent-ink', 'surface'],  // rótulos "PRÓXIMA ESCALA", "Criar minha conta"
  ['on-accent', 'accent'],    // contadores sobre coral
  ['on-brand', 'brand'],      // botões primários
  ['on-success', 'success'],  // botão Aprovar
  ['on-danger', 'danger'],    // marcação de urgente
]

describe.each([['claro', CLARO], ['escuro', ESCURO]])('tema %s', (_, t) => {
  it.each(PARES)('%s sobre %s tem contraste ≥ 4,5', (texto, fundo) => {
    expect(t[texto], `token --${texto} existe`).toBeDefined()
    expect(t[fundo], `token --${fundo} existe`).toBeDefined()
    expect(contraste(t[texto], t[fundo])).toBeGreaterThanOrEqual(4.5)
  })
})
