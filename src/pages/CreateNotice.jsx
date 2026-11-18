// src/pages/CreateNotice.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { TopBar, Button, Card, Pill, Input, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
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

  const mochila = { state: { departamentoId, departamentoNome, userRole } }


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
    toast.success(`Aviso publicado.${qtdNotificados > 0 ? ` ${qtdNotificados} ${qtdNotificados === 1 ? 'membro notificado' : 'membros notificados'}.` : ''}`)
    setTitulo('')
    setConteudo('')
    setUrgente(false)
    buscarAvisos()
    setEnviando(false)
  }

  async function apagarAviso(id) {
    if (!await confirm({
      title:       'Apagar este aviso?',
      message:     'O aviso sai do mural e não pode ser recuperado.',
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
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Criar aviso"
        subtitulo={departamentoNome}
        onVoltar={() => navigate(-1, mochila)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome).chip}`}>
          <IconeDept nome={departamentoNome} className="w-5 h-5" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-5">

        <Card>
          <h2 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand" aria-hidden="true" /> Novo aviso
          </h2>

          <form onSubmit={criarAviso} className="space-y-4">
            <Input label="Título" required placeholder="Ex: Reunião no sábado"
              value={titulo} onChange={e => setTitulo(e.target.value)} />

            <div>
              <label htmlFor="aviso-mensagem" className="block text-xs font-semibold text-ink-2 mb-1.5">Mensagem</label>
              <textarea id="aviso-mensagem" required placeholder="Escreva os detalhes" rows="4"
                value={conteudo} onChange={e => setConteudo(e.target.value)}
                className="w-full rounded-ctl bg-surface border border-line p-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-none" />
            </div>

            <label className="flex items-center gap-3 cursor-pointer bg-danger-soft p-3 rounded-ctl focus-within:ring-2 focus-within:ring-brand">
              <input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer accent-[rgb(var(--danger))]" />
              <span className="text-sm font-bold text-danger flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Marcar como urgente
              </span>
            </label>

            <p className="flex items-center gap-2 bg-surface-2 rounded-ctl px-3 py-2.5 text-xs text-ink-2">
              <Bell className="w-4 h-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span>Todos de <strong className="text-ink">{departamentoNome}</strong> recebem o aviso no app e no celular.</span>
            </p>

            <Button type="submit" full loading={enviando} disabled={!titulo || !conteudo}
              icon={<Send className="w-4 h-4" aria-hidden="true" />}>
              {enviando ? 'Enviando...' : 'Publicar e avisar'}
            </Button>
          </form>
        </Card>

        <section>
          <h2 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-warning" aria-hidden="true" /> Avisos no mural <Pill>{avisos.length}</Pill>
          </h2>

          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {[1, 2].map(i => <div key={i} className="h-20 bg-surface-2 rounded-card animate-pulse" />)}
            </div>
          ) : avisos.length === 0 ? (
            <Card>
              <EmptyState icon={<BellRing className="w-6 h-6" aria-hidden="true" />} titulo="O mural está vazio" texto="Os avisos publicados aparecem aqui." />
            </Card>
          ) : (
            <ul className="space-y-3">
              {avisos.map(aviso => (
                <li key={aviso.id}>
                  <Card className={`border-l-4 ${aviso.urgente ? '!border-l-danger' : '!border-l-brand'}`}>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className={`font-bold text-sm ${aviso.urgente ? 'text-danger' : 'text-ink'}`}>
                        {aviso.urgente && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 mb-0.5" aria-label="Urgente" />}
                        {aviso.titulo}
                      </h3>
                      <button type="button" onClick={() => apagarAviso(aviso.id)} aria-label={`Apagar aviso ${aviso.titulo}`}
                        className="p-1.5 -mr-1 rounded-ctl text-muted hover:text-danger hover:bg-danger-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="text-xs text-ink-2 whitespace-pre-wrap leading-relaxed">{aviso.conteudo}</p>
                    <p className="text-[11px] text-muted mt-2">
                      {new Date(aviso.data_criacao).toLocaleDateString('pt-BR')} às {new Date(aviso.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
