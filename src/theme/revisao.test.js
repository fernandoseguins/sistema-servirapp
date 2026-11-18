// src/theme/revisao.test.js
// Achados da revisão final da fase 3 (checagem no código-fonte).
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ler = (arquivo) => readFileSync(new URL('../' + arquivo, import.meta.url), 'utf8')

it('Gestão: sub-modal de liderança abre por cima da lista de membros', () => {
  const s = ler('pages/GestaoIgreja.jsx')
  const zs = [...s.matchAll(/fixed inset-0 z-\[(\d+)\]/g)].map(m => Number(m[1]))
  expect(zs.length).toBe(2)
  const [lista, lideranca] = zs
  expect(lideranca).toBeGreaterThan(lista)
})

it('Gestão e Detalhes da igreja: Voltar volta para a tela anterior, como antes', () => {
  expect(ler('pages/GestaoIgreja.jsx')).toMatch(/onVoltar=\{\(\) => navigate\(-1\)\}/)
  expect(ler('pages/IgrejaDetalhes.jsx')).toMatch(/onVoltar=\{\(\) => navigate\(-1\)\}/)
})

it('Equipe: o seletor de cargo só muda depois que o banco salvou', () => {
  const s = ler('pages/Team.jsx')
  expect(s).toMatch(/if \(await alterarCargo\(/)
  expect(s).toMatch(/toast\.error\('Erro ao alterar cargo\.'\)\s*\n\s*return false/)
})

it('Dias off: apagar todas as ausências pede confirmação de perigo', () => {
  expect(ler('pages/Unavailability.jsx')).toMatch(/title: 'Apagar todas as suas ausências\?'[^)]*danger: true/)
})
