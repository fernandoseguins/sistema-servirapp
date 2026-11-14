import { describe, it, expect } from 'vitest'
import { CHAVE_APARENCIA, lerPreferencia, salvarPreferencia, resolverTema } from './aparencia'

function storageFalso(inicial = {}) {
  const dados = { ...inicial }
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v) },
    dados,
  }
}

const storageQuebrado = {
  getItem: () => { throw new Error('bloqueado') },
  setItem: () => { throw new Error('bloqueado') },
}

describe('lerPreferencia', () => {
  it('retorna auto quando não há nada salvo', () => {
    expect(lerPreferencia(storageFalso())).toBe('auto')
  })
  it('retorna o valor salvo', () => {
    expect(lerPreferencia(storageFalso({ [CHAVE_APARENCIA]: 'escuro' }))).toBe('escuro')
  })
  it('retorna auto para valor inválido', () => {
    expect(lerPreferencia(storageFalso({ [CHAVE_APARENCIA]: 'azul' }))).toBe('auto')
  })
  it('retorna auto quando o storage lança erro', () => {
    expect(lerPreferencia(storageQuebrado)).toBe('auto')
  })
})

describe('salvarPreferencia', () => {
  it('grava na chave servir.aparencia', () => {
    const s = storageFalso()
    salvarPreferencia('claro', s)
    expect(s.dados['servir.aparencia']).toBe('claro')
  })
  it('não lança quando o storage lança erro', () => {
    expect(() => salvarPreferencia('escuro', storageQuebrado)).not.toThrow()
  })
})

describe('resolverTema', () => {
  it('auto segue o sistema escuro', () => expect(resolverTema('auto', true)).toBe('escuro'))
  it('auto segue o sistema claro', () => expect(resolverTema('auto', false)).toBe('claro'))
  it('claro ignora o sistema', () => expect(resolverTema('claro', true)).toBe('claro'))
  it('escuro ignora o sistema', () => expect(resolverTema('escuro', false)).toBe('escuro'))
})
