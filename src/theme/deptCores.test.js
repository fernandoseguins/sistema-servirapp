import { describe, it, expect } from 'vitest'
import { slugDept, classesDept } from './deptCores'

describe('slugDept', () => {
  it('remove acento', () => expect(slugDept('Mídia')).toBe('midia'))
  it('aceita a grafia sem acento', () => expect(slugDept('Midia')).toBe('midia'))
  it('ignora maiúsculas', () => expect(slugDept('LOUVOR')).toBe('louvor'))
  it('reconhece os seis departamentos conhecidos', () => {
    expect(['Louvor', 'Mídia', 'Infantil', 'Diaconia', 'Cantina', 'Ministros'].map(slugDept))
      .toEqual(['louvor', 'midia', 'infantil', 'diaconia', 'cantina', 'ministros'])
  })
  it('departamento desconhecido vira outro', () => expect(slugDept('Recepção')).toBe('outro'))
  it('texto vazio vira outro', () => expect(slugDept('')).toBe('outro'))
  it('undefined vira outro', () => expect(slugDept(undefined)).toBe('outro'))
})

describe('classesDept', () => {
  it('monta as classes do chip e do ícone', () => {
    expect(classesDept('Louvor')).toEqual({
      chip: 'bg-dept-louvor-bg text-dept-louvor-fg',
      icone: 'text-dept-louvor-fg',
    })
  })
  it('usa outro para departamento personalizado', () => {
    expect(classesDept('Recepção').chip).toBe('bg-dept-outro-bg text-dept-outro-fg')
  })
})
