// src/context/IgrejaContext.jsx
// Contexto global da IGREJA do usuário logado (multi-tenant).
//
// Busca o igreja_id do usuário UMA VEZ ao logar e disponibiliza para todo o app.
// Assim as queries podem filtrar por igreja sem cada página ter que descobrir isso sozinha.
//
// USO:
//   const { igrejaId, igreja, loadingIgreja } = useIgreja()
//
//   // Em queries:
//   supabase.from('departamentos').select('*').eq('igreja_id', igrejaId)
//
// IMPORTANTE: enquanto loadingIgreja for true, ainda estamos descobrindo a igreja.
// Páginas que dependem de igrejaId devem esperar loadingIgreja === false.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { concluirCadastroPendente } from '../utils/concluirCadastro'

const IgrejaContext = createContext(null)

export function IgrejaProvider({ children }) {
  const [igrejaId,      setIgrejaId]      = useState(null)
  const [igreja,        setIgreja]        = useState(null)   // { id, nome, logo_url, cor_primaria, plano }
  const [loadingIgreja, setLoadingIgreja] = useState(true)

  // Busca a igreja do usuário logado
  const carregarIgreja = useCallback(async () => {
    setLoadingIgreja(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIgrejaId(null); setIgreja(null); setLoadingIgreja(false)
        return
      }

      // ✅ Cobre quem entrou pelo link de confirmação de e-mail (sem passar pelo login):
      // grava igreja/departamentos/instrumentos pendentes antes de ler o perfil
      await concluirCadastroPendente(user)

      // Pega o igreja_id do perfil do usuário
      const { data: perfil } = await supabase
        .from('users_profile')
        .select('igreja_id')
        .eq('id', user.id)
        .maybeSingle()

      const id = perfil?.igreja_id || null
      setIgrejaId(id)

      // Busca os dados da igreja (nome, logo, cor) para uso no app
      if (id) {
        const { data: dadosIgreja } = await supabase
          .from('igrejas')
          .select('id, nome, slug, logo_url, cor_primaria, plano')
          .eq('id', id)
          .maybeSingle()
        setIgreja(dadosIgreja || null)
      }
    } catch (err) {
      console.warn('Erro ao carregar igreja:', err.message)
    }
    setLoadingIgreja(false)
  }, [])

  useEffect(() => {
    carregarIgreja()

    // Recarrega quando o usuário faz login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        carregarIgreja()
      }
    })
    return () => subscription?.unsubscribe()
  }, [carregarIgreja])

  return (
    <IgrejaContext.Provider value={{ igrejaId, igreja, loadingIgreja, recarregarIgreja: carregarIgreja }}>
      {children}
    </IgrejaContext.Provider>
  )
}

export function useIgreja() {
  const ctx = useContext(IgrejaContext)
  if (!ctx) throw new Error('useIgreja deve ser usado dentro de <IgrejaProvider>')
  return ctx
}