// src/components/GlobalUserMenu.jsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { caminhoInterno } from '../utils/url'
import { Bell, XCircle, Trash2, User, LogOut, ChevronDown, Crown } from 'lucide-react'

export default function GlobalUserMenu() {
  const navigate = useNavigate()
  const location = useLocation()

  const [userId,        setUserId]        = useState(null)
  const [nomeUsuario,   setNomeUsuario]   = useState('')
  const [notificacoes,  setNotificacoes]  = useState([])
  const [modalAberto,   setModalAberto]   = useState(false)
  const [menuAberto,    setMenuAberto]    = useState(false)
  const [ehSuperAdmin,  setEhSuperAdmin]  = useState(false)
  const [qtdNaoLidas,   setQtdNaoLidas]   = useState(0)
  const [belAnimando,   setBelAnimando]   = useState(false)

  const canalRef  = useRef(null)
  const menuRef   = useRef(null)

  // Iniciais do nome para o avatar
  const iniciais = nomeUsuario
    ? nomeUsuario.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const buscarNotificacoes = useCallback(async (uid) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) {
      setNotificacoes(data)
      setQtdNaoLidas(data.filter(n => !n.lida).length)
    }
  }, [])

  useEffect(() => {
    if (location.pathname === '/') return

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)
      // Super admin (dono do sistema) — só estes emails veem o Painel do Dono
      const { data: ehSuper } = await supabase.rpc('sou_super_admin_flag')
      setEhSuperAdmin(ehSuper === true)
      await buscarNotificacoes(user.id)

      // Busca nome do utilizador
      const { data: perfil } = await supabase
        .from('users_profile')
        .select('nome')
        .eq('id', user.id)
        .single()
      if (perfil?.nome) setNomeUsuario(perfil.nome)

      if (canalRef.current) supabase.removeChannel(canalRef.current)

      canalRef.current = supabase
        .channel(`notifications:${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotificacoes(prev => [payload.new, ...prev].slice(0, 20))
            setQtdNaoLidas(prev => prev + 1)
            setBelAnimando(true)
            setTimeout(() => setBelAnimando(false), 1200)
          }
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotificacoes(prev => prev.map(n => n.id === payload.new.id ? payload.new : n))
            setQtdNaoLidas(prev => Math.max(0, prev + (payload.new.lida && !payload.old.lida ? -1 : 0)))
          }
        )
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotificacoes(prev => prev.filter(n => n.id !== payload.old.id))
            if (!payload.old.lida) setQtdNaoLidas(prev => Math.max(0, prev - 1))
          }
        )
        .subscribe()
    }

    setup()
    return () => {
      if (canalRef.current) { supabase.removeChannel(canalRef.current); canalRef.current = null }
    }
  }, [location.pathname, buscarNotificacoes])

  async function clicarNaNotificacao(notif) {
    if (!notif.lida) await supabase.from('notifications').update({ lida: true }).eq('id', notif.id)
    const destino = caminhoInterno(notif.link_redirecionamento)
    if (destino) { setModalAberto(false); navigate(destino) }
  }

  async function apagarNotificacao(e, id) {
    e.stopPropagation()
    // ✅ Remove da lista imediatamente
    setNotificacoes(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  async function marcarTodasLidas() {
    if (!userId || qtdNaoLidas === 0) return
    await supabase.from('notifications').update({ lida: true }).eq('user_id', userId).eq('lida', false)
  }

  async function handleLogout() {
    if (canalRef.current) supabase.removeChannel(canalRef.current)
    setMenuAberto(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  if (location.pathname === '/') return null

  if (typeof document === "undefined") return null

  return createPortal(
    <>
      <style>{`
        @keyframes belShake {
          0%,100% { transform: rotate(0deg); }
          15%      { transform: rotate(18deg); }
          30%      { transform: rotate(-16deg); }
          45%      { transform: rotate(12deg); }
          60%      { transform: rotate(-8deg); }
          75%      { transform: rotate(4deg); }
        }
        .bel-animando { animation: belShake 0.6s ease-in-out; }
        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .menu-animate { animation: menuFadeIn 0.15s ease; }
      `}</style>

      {/* ── Barra fixa topo direito ── */}
      <div style={{ position: "absolute", top: "16px", right: "16px", zIndex: 9999, display: "flex", alignItems: "center", gap: "8px", opacity: modalAberto ? 0 : 1, pointerEvents: modalAberto ? "none" : "auto", transition: "opacity 0.2s" }}>

        {/* Sino de notificações */}
        <button
          onClick={async () => {
            setModalAberto(true)
            // ✅ Marca todas como lidas ao abrir o painel
            if (userId && qtdNaoLidas > 0) {
              setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
              setQtdNaoLidas(0)
              await supabase.from('notifications').update({ lida: true }).eq('user_id', userId).eq('lida', false)
            }
          }}
          aria-label="Notificações"
          className="relative p-2.5 bg-gray-900/90 backdrop-blur-md hover:bg-gray-800 border border-white/10 rounded-full transition shadow-xl"
        >
          <Bell className={`w-5 h-5 text-yellow-400 ${belAnimando ? 'bel-animando' : ''}`} />
          {qtdNaoLidas > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-gray-900">
              {qtdNaoLidas > 9 ? '9+' : qtdNaoLidas}
            </span>
          )}
        </button>

        {/* Pill com avatar + chevron */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label="Menu do utilizador"
            className="flex items-center gap-2 pl-1 pr-3 py-1 bg-gray-900/90 backdrop-blur-md hover:bg-gray-800 border border-white/10 rounded-full transition shadow-xl"
          >
            {/* Avatar com iniciais */}
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {iniciais}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-200 ${menuAberto ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {menuAberto && (
            <div className="menu-animate absolute right-0 top-[calc(100%+8px)] w-44 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100]">
              {/* Info do utilizador */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-gray-900 truncate">{nomeUsuario || 'Utilizador'}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Conta SerVir</p>
              </div>

              {/* Ações */}
              <div className="p-1.5">
                <button
                  onClick={() => { setMenuAberto(false); navigate('/perfil') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 font-medium hover:bg-gray-100 active:bg-gray-200 transition text-left"
                >
                  <User className="w-4 h-4 text-gray-500" />
                  Meu Perfil
                </button>

                {ehSuperAdmin && (
                  <button
                    onClick={() => { setMenuAberto(false); navigate('/painel-dono') }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-700 font-medium hover:bg-amber-50 active:bg-amber-100 transition text-left"
                  >
                    <Crown className="w-4 h-4 text-amber-500" />
                    Painel do Dono
                  </button>
                )}

                <div className="h-px bg-gray-100 mx-1 my-1" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 font-medium hover:bg-red-50 active:bg-red-100 transition text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Painel lateral de notificações ── */}
      {modalAberto && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[99]" onClick={() => setModalAberto(false)} />
          <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-[100] flex flex-col">

            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
              <Bell className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap">Central de Avisos</h2>
                {qtdNaoLidas > 0 && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                    {qtdNaoLidas} nova{qtdNaoLidas > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {qtdNaoLidas > 0 && (
                <button onClick={marcarTodasLidas} className="text-[11px] text-blue-600 hover:underline font-medium whitespace-nowrap flex-shrink-0">
                  Marcar lidas
                </button>
              )}
              <button onClick={() => setModalAberto(false)} aria-label="Fechar" className="text-gray-400 hover:bg-gray-200 p-1.5 rounded-full transition flex-shrink-0">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notificacoes.length === 0 ? (
                <div className="text-center text-gray-400 py-10">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-bold">Nenhuma notificação por aqui!</p>
                  <p className="text-xs mt-1">Tudo tranquilo e sob controle. 😎</p>
                </div>
              ) : (
                notificacoes.map(notif => (
                  <div key={notif.id} onClick={() => clicarNaNotificacao(notif)}
                    className={`p-4 rounded-2xl border-l-4 cursor-pointer transition shadow-sm relative group
                      ${!notif.lida ? 'bg-blue-50 border-blue-500 hover:bg-blue-100' : 'bg-white border-gray-200 hover:bg-gray-50 border'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm font-bold ${!notif.lida ? 'text-blue-900' : 'text-gray-800'}`}>{notif.titulo}</h4>
                      {!notif.lida && <span className="w-2.5 h-2.5 bg-blue-500 rounded-full shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{notif.mensagem}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                        {new Date(notif.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <button onClick={e => apagarNotificacao(e, notif.id)}
                        aria-label="Apagar notificação"
                        className="text-gray-400 hover:text-red-500 active:text-red-600 transition p-1.5 -m-1.5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  )
}