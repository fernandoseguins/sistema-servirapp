// src/hooks/useNotificacoes.jsx
// Notificações do usuário logado (mesmas consultas do antigo GlobalUserMenu),
// com UM canal realtime compartilhado pelo menu, Início e aba Avisos.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { caminhoInterno } from '../utils/url'

const Ctx = createContext(null)

export function NotificacoesProvider({ userId, children }) {
  const [notificacoes, setNotificacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const canalRef = useRef(null)

  const recarregar = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotificacoes(data)
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    // setState só acontece depois do await (busca no Supabase), não de forma síncrona
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar()
    canalRef.current = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => setNotificacoes(prev => [p.new, ...prev.filter(n => n.id !== p.new.id)].slice(0, 20)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => setNotificacoes(prev => prev.map(n => n.id === p.new.id ? p.new : n)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => setNotificacoes(prev => prev.filter(n => n.id !== p.old.id)))
      .subscribe()
    return () => { if (canalRef.current) { supabase.removeChannel(canalRef.current); canalRef.current = null } }
  }, [userId, recarregar])

  // Marca como lida e devolve o destino interno (ou null)
  const abrir = useCallback(async (notif) => {
    if (!notif.lida) {
      setNotificacoes(prev => prev.map(n => n.id === notif.id ? { ...n, lida: true } : n))
      await supabase.from('notifications').update({ lida: true }).eq('id', notif.id)
    }
    return caminhoInterno(notif.link_redirecionamento) || null
  }, [])

  const apagar = useCallback(async (id) => {
    setNotificacoes(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }, [])

  const marcarTodasLidas = useCallback(async () => {
    if (!userId) return
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
    await supabase.from('notifications').update({ lida: true }).eq('user_id', userId).eq('lida', false)
  }, [userId])

  // Sem usuário (deslogado): lista vazia, sem estado antigo de outra sessão
  const lista = userId ? notificacoes : []
  const naoLidas = lista.filter(n => !n.lida).length

  return (
    <Ctx.Provider value={{ notificacoes: lista, naoLidas, carregando: userId ? carregando : false, abrir, apagar, marcarTodasLidas, recarregar }}>
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotificacoes() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotificacoes deve ser usado dentro de <NotificacoesProvider>')
  return ctx
}
