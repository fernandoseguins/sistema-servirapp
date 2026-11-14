// src/theme/aparencia.js
// Preferência de aparência (claro / escuro / automático) e aplicação no documento.
// A mesma lógica é replicada inline no index.html para aplicar o tema antes da
// primeira pintura (evita piscar branco no modo escuro).

export const CHAVE_APARENCIA = 'servir.aparencia'
const VALIDAS = ['auto', 'claro', 'escuro']
const COR_BARRA = { claro: '#5B3FD9', escuro: '#0F1115' }

export function lerPreferencia(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(CHAVE_APARENCIA)
    return VALIDAS.includes(v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function salvarPreferencia(pref, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CHAVE_APARENCIA, pref)
  } catch {
    // storage bloqueado (aba anônima, iOS): a preferência vale só nesta sessão
  }
}

export function resolverTema(pref, sistemaEscuro) {
  if (pref === 'claro' || pref === 'escuro') return pref
  return sistemaEscuro ? 'escuro' : 'claro'
}

export function aplicarTema(tema, doc = document) {
  doc.documentElement.classList.toggle('dark', tema === 'escuro')
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema] ?? COR_BARRA.claro)
}
