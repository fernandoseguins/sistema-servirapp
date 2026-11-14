import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

const { statusPresenca, tomPresenca, rotuloPresenca, statusAgregado, contarPresenca, resumoPresenca } = await import('./presenca')

describe('statusPresenca', () => {
  it('nulo e desconhecido viram Pendente', () => {
    expect(statusPresenca(null)).toBe('Pendente')
    expect(statusPresenca(undefined)).toBe('Pendente')
    expect(statusPresenca('xyz')).toBe('Pendente')
  })
  it('mantém Confirmado e Recusado', () => {
    expect(statusPresenca('Confirmado')).toBe('Confirmado')
    expect(statusPresenca('Recusado')).toBe('Recusado')
  })
})

describe('tom e rótulo', () => {
  it('tons coerentes', () => {
    expect(tomPresenca('Confirmado')).toBe('sucesso')
    expect(tomPresenca('Recusado')).toBe('perigo')
    expect(tomPresenca('Pendente')).toBe('aviso')
  })
  it('rótulos', () => {
    expect(rotuloPresenca('Recusado')).toBe('Não vai')
    expect(rotuloPresenca(null)).toBe('Pendente')
  })
})

describe('statusAgregado', () => {
  it('Recusado tem prioridade, depois Pendente', () => {
    expect(statusAgregado([{ status_confirmacao: 'Confirmado' }, { status_confirmacao: 'Recusado' }])).toBe('Recusado')
    expect(statusAgregado([{ status_confirmacao: 'Confirmado' }, { status_confirmacao: null }])).toBe('Pendente')
    expect(statusAgregado([{ status_confirmacao: 'Confirmado' }])).toBe('Confirmado')
    expect(statusAgregado([])).toBe('Pendente')
  })
})

describe('resumoPresenca', () => {
  const papeis = [
    ...Array(5).fill({ status_confirmacao: 'Confirmado' }),
    ...Array(2).fill({ status_confirmacao: 'Pendente' }),
    { status_confirmacao: 'Recusado' },
  ]
  it('conta por status', () => expect(contarPresenca(papeis)).toEqual({ confirmados: 5, pendentes: 2, recusados: 1 }))
  it('monta o texto', () => expect(resumoPresenca(papeis)).toBe('5 confirmados · 2 pendentes · 1 recusou'))
  it('singular e omite zeros', () => expect(resumoPresenca([{ status_confirmacao: 'Confirmado' }])).toBe('1 confirmado'))
  it('lista vazia', () => expect(resumoPresenca([])).toBe(''))
})
