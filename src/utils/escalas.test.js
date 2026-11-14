import { describe, it, expect } from 'vitest'
import { agruparPorMes, dataComDia } from './escalas'

describe('dataComDia', () => {
  it('formata com dia da semana em maiúscula e dd/mm', () => {
    expect(dataComDia('2026-12-06')).toBe('Domingo, 06/12')
  })
  it('não escorrega de dia por fuso', () => {
    expect(dataComDia('2026-12-01')).toBe('Terça-feira, 01/12')
  })
})

describe('agruparPorMes', () => {
  const escalas = [
    { id: 'a', data: '2026-12-03' },
    { id: 'b', data: '2026-11-20' },
    { id: 'c', data: '2026-12-01' },
  ]

  it('cria um grupo por mês, em ordem crescente', () => {
    const grupos = agruparPorMes(escalas)
    expect(grupos.map(g => g.chave)).toEqual(['2026-11', '2026-12'])
  })

  it('ordena os itens de cada mês por data', () => {
    const dez = agruparPorMes(escalas)[1]
    expect(dez.itens.map(i => i.id)).toEqual(['c', 'a'])
  })

  it('usa o nome do mês por extenso em português', () => {
    expect(agruparPorMes(escalas)[1].titulo).toBe('dezembro de 2026')
  })

  it('primeiro dia do mês não escorrega para o mês anterior por fuso', () => {
    const [g] = agruparPorMes([{ id: 'x', data: '2026-12-01' }])
    expect(g.chave).toBe('2026-12')
    expect(g.titulo).toBe('dezembro de 2026')
  })

  it('lista vazia vira lista vazia', () => {
    expect(agruparPorMes([])).toEqual([])
  })
})
