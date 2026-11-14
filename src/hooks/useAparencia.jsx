// src/hooks/useAparencia.jsx
// Estado da aparência (auto/claro/escuro) compartilhado pelo app inteiro.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { lerPreferencia, salvarPreferencia, resolverTema, aplicarTema } from '../theme/aparencia'

const Ctx = createContext(null)
const consultaEscuro = () => window.matchMedia?.('(prefers-color-scheme: dark)')

export function AparenciaProvider({ children }) {
  const [preferencia, setPref] = useState(() => lerPreferencia())
  const [sistemaEscuro, setSistemaEscuro] = useState(() => !!consultaEscuro()?.matches)

  useEffect(() => {
    const mq = consultaEscuro()
    if (!mq) return
    const onChange = (e) => setSistemaEscuro(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const tema = resolverTema(preferencia, sistemaEscuro)
  useEffect(() => { aplicarTema(tema) }, [tema])

  const setPreferencia = useCallback((pref) => {
    salvarPreferencia(pref)
    setPref(pref)
  }, [])

  return <Ctx.Provider value={{ preferencia, tema, setPreferencia }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAparencia() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAparencia deve ser usado dentro de <AparenciaProvider>')
  return ctx
}
