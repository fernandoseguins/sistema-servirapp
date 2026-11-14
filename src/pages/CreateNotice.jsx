// src/pages/CreateNotice.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import PageHeader from '../components/PageHeader'
import { getDeptTheme } from '../utils/departmentThemes'
import { enviarNotificacaoEmMassa } from '../utils/notificacoes'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, BellRing, AlertTriangle, MessageSquare, Send, Trash2 } from 'lucide-react'

export default function CreateNotice() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const { toast, confirm } = useUI()

  const departamentoId   = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const userRole         = location.state?.userRole

  const [avisos,  setAvisos]  = useState([])
  const [titulo,  setTitulo]  = useState('')
  const [conteudo,setConteudo]= useState('')
  const [urgente, setUrgente] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enviando,setEnviando]= useState(false)

  // ✅ Tema centralizado
  const [departamentoCor, setDepartamentoCor] = useState(null)
  const theme  = getDeptTheme(departamentoNome, departamentoCor)
  const pers = theme.personalizado
  const st = theme.styles || {}
  const mochila = { state: { departamentoId, departamentoNome, userRole } }

  useEffect(() => {
    if (!departamentoId) return
    supabase.from('departamentos').select('cor, icone').eq('id', departamentoId).single()
      .then(({ data }) => { if (data) setDepartamentoCor(data.cor) })
  }, [departamentoId])


  useEffect(() => {
    if (!departamentoId) { navigate('/hub'); return }
    buscarAvisos()
  }, [departamentoId])

  async function buscarAvisos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .eq('departamento_id', departamentoId)
      .order('data_criacao', { ascending: false })
    if (!error && data) setAvisos(data)
    setLoading(false)
  }

  async function criarAviso(e) {
    e.preventDefault()
    if (!titulo || !conteudo) return

    setEnviando(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('notices').insert([{
      departamento_id: departamentoId,
      user_id:         user.id,
      titulo,
      conteudo,
      urgente,
      data_criacao:    new Date().toISOString(),
    }])

    if (error) {
      toast.error('Erro ao publicar aviso.')
      setEnviando(false)
      return
    }

    // ✅ Notificar TODOS os membros do departamento (exceto o criador)
    const { data: membros } = await supabase
      .from('membros_departamentos')
      .select('user_id')
      .eq('departamento_id', departamentoId)

    if (membros?.length > 0) {
      const userIdsAlvo = membros.map(m => m.user_id).filter(id => id !== user.id)

      if (userIdsAlvo.length > 0) {
        // Título do aviso truncado para caber no push
        const tituloCurto = titulo.length > 60 ? `${titulo.slice(0, 59).trimEnd()}…` : titulo
        const tituloNotif = urgente ? '🚨 Aviso urgente' : '📢 Novo aviso'
        const mensagemNotif = `${departamentoNome}: "${tituloCurto}". Toque para ler.`

        await enviarNotificacaoEmMassa({
          userIds:       userIdsAlvo,
          departamentoId,
          titulo:        tituloNotif,
          mensagem:      mensagemNotif,
          tipo:          'aviso',
          link:          `/dashboard/${departamentoId}`,
        })
      }
    }

    const qtdNotificados = (membros || []).filter(m => m.user_id !== user.id).length
    toast.success(`Aviso publicado!${qtdNotificados > 0 ? ` ${qtdNotificados} ${qtdNotificados === 1 ? 'membro notificado' : 'membros notificados'}.` : ''}`)
    setTitulo('')
    setConteudo('')
    setUrgente(false)
    buscarAvisos()
    setEnviando(false)
  }

  async function apagarAviso(id) {
    if (!await confirm({
      title:       'Apagar este aviso?',
      message:     'O aviso será removido permanentemente do mural.',
      danger:      true,
      labelOk:     'Apagar',
      labelCancel: 'Cancelar',
    })) return

    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (!error) {
      setAvisos(prev => prev.filter(a => a.id !== id))
      toast.info('Aviso removido.')
    } else {
      toast.error('Erro ao apagar aviso.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      <PageHeader
        title="Criar Aviso"
        subtitle={`Notificar equipe — ${departamentoNome}`}
        icon={<Bell className="w-5 h-5" />}
        color={pers ? theme.hexValue : theme.bgPrimary}
        onBack={() => navigate(-1, mochila)}
      />

      <div className="max-w-md mx-auto px-4 space-y-6">

        {/* FORMULÁRIO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className={`text-sm font-bold uppercase mb-4 flex items-center gap-2 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}}>
            <MessageSquare className="w-4 h-4" /> Novo Aviso
          </h2>

          <form onSubmit={criarAviso} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Título</label>
              <input type="text" required placeholder="Ex: Reunião no sábado"
                value={titulo} onChange={e => setTitulo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Mensagem</label>
              <textarea required placeholder="Escreva os detalhes aqui..." rows="4"
                value={conteudo} onChange={e => setConteudo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 resize-none" />
            </div>

            <label className="flex items-center gap-3 cursor-pointer bg-red-50 p-3 rounded-xl border border-red-100 hover:bg-red-100 transition">
              <input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)}
                className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer" />
              <span className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Marcar como URGENTE
              </span>
            </label>

            {/* Info de quem vai receber */}
            <div style={pers ? st.bgLight : {}} className={`flex items-center gap-2 ${pers ? "" : theme.bgLight} rounded-xl px-4 py-3`}>
              <Bell className={`w-4 h-4 ${pers ? "" : theme.textPrimary} flex-shrink-0`} style={pers ? st.textPrimary : {}} />
              <p className="text-xs text-gray-600">
                Todos os membros de <span className="font-bold">{departamentoNome}</span> vão receber esta notificação no app e no celular.
              </p>
            </div>

            <button type="submit" disabled={enviando || !titulo || !conteudo}
              className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md transition active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-50 ${pers ? "" : theme.bgPrimary + " " + theme.btnHover}`} style={pers ? st.bgPrimary : {}}>
              {enviando
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enviando...</>
                : <><Send className="w-5 h-5" /> Publicar e Notificar</>
              }
            </button>
          </form>
        </div>

        {/* LISTA DE AVISOS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-yellow-500" /> Avisos Ativos ({avisos.length})
          </h2>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4 animate-pulse font-bold">A carregar...</p>
          ) : avisos.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <BellRing className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">O mural está vazio.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {avisos.map(aviso => (
                <div key={aviso.id}
                  className={`p-4 rounded-xl border-l-4 ${aviso.urgente ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-blue-400'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-bold text-sm ${aviso.urgente ? 'text-red-700' : 'text-gray-900'}`}>
                      {aviso.urgente && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 mb-0.5" />}
                      {aviso.titulo}
                    </h3>
                    <button onClick={() => apagarAviso(aviso.id)} aria-label="Apagar aviso"
                      className="text-gray-300 hover:text-red-500 transition p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{aviso.conteudo}</p>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">
                    {new Date(aviso.data_criacao).toLocaleDateString('pt-BR')} às {new Date(aviso.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}