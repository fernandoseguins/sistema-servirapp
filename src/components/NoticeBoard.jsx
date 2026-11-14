// src/components/NoticeBoard.jsx
// ✅ Realtime — novos avisos aparecem instantaneamente para todos os membros
// sem precisar recarregar a página.
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { BellRing, AlertTriangle, CalendarDays, Edit2, Trash2, XCircle, Save, CheckSquare, Building2 } from 'lucide-react'


export default function NoticeBoard({ departamentoId }) {
  const { toast, confirm } = useUI()

  const [avisos,     setAvisos]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [isLider,    setIsLider]    = useState(false)

  // Modal de edição
  const [modalAberto, setModalAberto] = useState(false)
  const [idEditando,  setIdEditando]  = useState(null)
  const [titulo,      setTitulo]      = useState('')
  const [conteudo,    setConteudo]    = useState('')
  const [urgente,     setUrgente]     = useState(false)
  const [salvando,    setSalvando]    = useState(false)

  const canalRef = useRef(null)

  useEffect(() => {
    if (!departamentoId) return

    async function carregarDados() {
      setLoading(true)

      // ✅ Carrega avisos + verifica permissão em paralelo
      const [avisosRes, userRes] = await Promise.all([
        supabase
          .from('notices')
          .select('*')
          .eq('departamento_id', departamentoId)
          .order('data_criacao', { ascending: false })
          .limit(10),
        supabase.auth.getUser(),
      ])

      if (avisosRes.data) setAvisos(avisosRes.data)

      const user = userRes.data?.user
      if (user) {
        const { data: ehMaster } = await supabase.rpc('sou_super_admin_flag')

        if (ehMaster) {
          // ✅ Master admin pode editar avisos de qualquer departamento
          setIsLider(true)
        } else if (departamentoId) {
          // ✅ Verifica se é líder/admin NESTE departamento específico
          const { data: dept } = await supabase
            .from('membros_departamentos')
            .select('role')
            .eq('user_id', user.id)
            .eq('departamento_id', departamentoId)
            .maybeSingle()

          if (dept?.role === 'admin' || dept?.role === 'líder') {
            setIsLider(true)
          }
        }
      }

      setLoading(false)
    }

    carregarDados()

    // ✅ Supabase Realtime — escuta novos avisos, edições e remoções
    if (canalRef.current) supabase.removeChannel(canalRef.current)

    canalRef.current = supabase
      .channel(`notices:${departamentoId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notices', filter: `departamento_id=eq.${departamentoId}` },
        (payload) => {
          // Novo aviso aparece no topo instantaneamente
          setAvisos(prev => [payload.new, ...prev].slice(0, 10))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notices', filter: `departamento_id=eq.${departamentoId}` },
        (payload) => {
          setAvisos(prev => prev.map(a => a.id === payload.new.id ? payload.new : a))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notices', filter: `departamento_id=eq.${departamentoId}` },
        (payload) => {
          setAvisos(prev => prev.filter(a => a.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      if (canalRef.current) {
        supabase.removeChannel(canalRef.current)
        canalRef.current = null
      }
    }
  }, [departamentoId])

  async function excluirAviso(id) {
    if (!await confirm({
      title:       'Apagar este aviso?',
      message:     'O aviso será removido do mural permanentemente.',
      danger:      true,
      labelOk:     'Apagar',
      labelCancel: 'Cancelar',
    })) return

    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (error) toast.error('Erro ao apagar aviso.')
    // O Realtime cuida de remover da lista automaticamente
  }

  function abrirModalEdicao(aviso) {
    setIdEditando(aviso.id)
    setTitulo(aviso.titulo)
    setConteudo(aviso.conteudo)
    setUrgente(aviso.urgente)
    setModalAberto(true)
  }

  async function salvarEdicao(e) {
    e.preventDefault()
    setSalvando(true)

    const { error } = await supabase
      .from('notices')
      .update({ titulo, conteudo, urgente })
      .eq('id', idEditando)

    if (error) {
      toast.error('Erro ao salvar alterações.')
    } else {
      setModalAberto(false)
      toast.success('Aviso atualizado!')
      // O Realtime cuida de atualizar a lista automaticamente
    }
    setSalvando(false)
  }

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-card border border-line animate-pulse">
        <div className="h-4 bg-line rounded w-32 mb-3" />
        <div className="h-16 bg-surface-2 rounded-xl" />
      </div>
    )
  }

  if (avisos.length === 0) {
    return (
      <div className="bg-surface p-5 rounded-card border border-line flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-ink uppercase flex items-center gap-2 mb-1">
            <BellRing className="w-4 h-4 text-muted" /> Mural de Avisos
          </h3>
          <p className="text-xs text-ink-2 font-medium">Nenhum recado novo no momento.</p>
        </div>
        <BellRing className="w-8 h-8 text-line flex-shrink-0" />
      </div>
    )
  }

  return (
    <>
      <div className="bg-surface p-5 rounded-card border border-line">
        <h3 className="text-sm font-bold text-ink uppercase flex items-center gap-2 mb-4">
          <BellRing className="w-4 h-4 text-warning" /> Mural de Avisos
        </h3>

        <div className="space-y-3 max-h-[350px] overflow-y-auto customized-scrollbar pr-1">
          {avisos.map(aviso => (
            <div key={aviso.id}
              className={`p-4 rounded-xl border-l-4 group transition-all
                ${aviso.urgente
                  ? 'bg-danger-soft border-danger border border-danger'
                  : 'bg-surface-2 border-brand border border-line'
                }`}>
              <div className="flex justify-between items-start mb-1.5">
                <div className="flex items-center gap-2 pr-2 min-w-0">
                  {aviso.urgente && <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />}
                  <h4 className={`text-sm font-bold truncate ${aviso.urgente ? 'text-danger' : 'text-ink'}`}>
                    {aviso.titulo}
                  </h4>
                  {aviso.da_gestao && (
                    <span className="flex items-center gap-1 text-[9px] font-bold bg-ink text-bg px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider">
                      <Building2 className="w-2.5 h-2.5" /> Gestão
                    </span>
                  )}
                </div>
                {isLider && (
                  <div className="flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                    <button onClick={() => abrirModalEdicao(aviso)} aria-label="Editar aviso"
                      className="p-1.5 text-muted hover:text-brand hover:bg-brand/10 rounded-lg transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => excluirAviso(aviso.id)} aria-label="Apagar aviso"
                      className="p-1.5 text-muted hover:text-danger hover:bg-danger-soft rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-ink-2 whitespace-pre-wrap leading-relaxed">{aviso.conteudo}</p>

              <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-muted font-bold uppercase tracking-wider">
                <CalendarDays className="w-3 h-3" />
                {new Date(aviso.data_criacao).toLocaleDateString('pt-BR')} às {new Date(aviso.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de edição */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-card p-6 shadow-2xl border border-line">
            <div className="flex justify-between items-center mb-5 border-b border-line pb-3">
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand" /> Editar Aviso
              </h2>
              <button onClick={() => setModalAberto(false)} aria-label="Fechar modal"
                className="text-muted hover:bg-surface-2 p-2 rounded-full transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarEdicao} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-2 mb-1">Título</label>
                <input type="text" required value={titulo} onChange={e => setTitulo(e.target.value)}
                  className="w-full border border-line rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand outline-none bg-surface-2" />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-2 mb-1">Mensagem</label>
                <textarea required value={conteudo} onChange={e => setConteudo(e.target.value)}
                  className="w-full border border-line rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand outline-none bg-surface-2 h-32 resize-none" />
              </div>

              <label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition
                ${urgente ? 'bg-danger-soft border-danger' : 'border-line bg-surface-2 hover:bg-surface-2'}`}>
                <input type="checkbox" className="hidden" checked={urgente} onChange={e => setUrgente(e.target.checked)} />
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
                  ${urgente ? 'bg-danger border-danger text-on-danger' : 'bg-surface border-line'}`}>
                  {urgente && <CheckSquare className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider ${urgente ? 'text-danger' : 'text-ink-2'}`}>
                  Marcar como Urgente
                </span>
              </label>

              <button type="submit" disabled={salvando}
                className="w-full bg-brand text-on-brand font-bold py-3.5 rounded-ctl hover:opacity-90 transition active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-50">
                <Save className="w-5 h-5" />
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}