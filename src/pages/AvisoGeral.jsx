// src/pages/AvisoGeral.jsx
// Envio de aviso da GESTÃO DA IGREJA para múltiplos departamentos de uma vez.
// Cria uma cópia do aviso no mural de cada departamento selecionado (marcado da_gestao=true)
// e notifica todos os membros desses departamentos.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { useNavigate } from 'react-router-dom'
import { TopBar, Button, Card, Input } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { enviarNotificacaoEmMassa } from '../utils/notificacoes'
import { Megaphone, AlertTriangle, Send, CheckCircle2, Building2 } from 'lucide-react'


export default function AvisoGeral() {
  const navigate = useNavigate()
  const { toast } = useUI()

  const [autorizado,    setAutorizado]    = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [departamentos, setDepartamentos] = useState([])
  const [selecionados,  setSelecionados]  = useState([])  // array de ids
  const [titulo,        setTitulo]        = useState('')
  const [conteudo,      setConteudo]      = useState('')
  const [urgente,       setUrgente]       = useState(false)
  const [enviando,      setEnviando]      = useState(false)

  useEffect(() => {
    verificarECarregar()
  }, [])

  async function verificarECarregar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }

    // ✅ Mesma lógica da Gestão: master admin OU qualquer admin
    const { data: vinculos } = await supabase
      .from('membros_departamentos')
      .select('role')
      .eq('user_id', user.id)

    const { data: ehMaster } = await supabase.rpc('sou_super_admin_flag')
    const ehAdmin  = vinculos ? vinculos.some(v => v.role === 'admin') : false

    if (!ehMaster && !ehAdmin) {
      navigate('/hub')
      return
    }
    setAutorizado(true)

    const { data: depts } = await supabase
      .from('departamentos')
      .select('id, nome')
      .order('nome')
    if (depts) setDepartamentos(depts)
    setLoading(false)
  }

  function toggleDept(id) {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  function toggleTodos() {
    if (selecionados.length === departamentos.length) {
      setSelecionados([])
    } else {
      setSelecionados(departamentos.map(d => d.id))
    }
  }

  async function enviarAviso(e) {
    e.preventDefault()
    if (!titulo || !conteudo || selecionados.length === 0) return

    setEnviando(true)
    const { data: { user } } = await supabase.auth.getUser()
    const agora = new Date().toISOString()

    try {
      // 1. Cria uma cópia do aviso em cada departamento selecionado
      const linhas = selecionados.map(deptId => ({
        departamento_id: deptId,
        user_id:         user.id,
        titulo,
        conteudo,
        urgente,
        da_gestao:       true,
        data_criacao:    agora,
      }))

      const { error } = await supabase.from('notices').insert(linhas)
      if (error) throw error

      // 2. Notifica os membros de cada departamento selecionado
      const { data: membros } = await supabase
        .from('membros_departamentos')
        .select('user_id, departamento_id')
        .in('departamento_id', selecionados)

      if (membros?.length > 0) {
        // IDs únicos (quem está em vários depts selecionados recebe 1 notificação)
        const userIdsAlvo = [...new Set(membros.map(m => m.user_id))].filter(id => id !== user.id)

        if (userIdsAlvo.length > 0) {
          const tituloNotif = urgente
            ? '🚨 Aviso urgente da gestão'
            : '📢 Aviso da gestão da igreja'
          // Título do aviso truncado para caber no push
          const tituloCurto = titulo.length > 60 ? `${titulo.slice(0, 59).trimEnd()}…` : titulo
          await enviarNotificacaoEmMassa({
            userIds:   userIdsAlvo,
            titulo:    tituloNotif,
            mensagem:  `"${tituloCurto}". Toque para ler.`,
            tipo:      'aviso',
            link:      '/hub',
          })
        }
      }

      const nomesSelecionados = departamentos
        .filter(d => selecionados.includes(d.id))
        .map(d => d.nome)
        .join(', ')

      toast.success(`Aviso enviado para: ${nomesSelecionados}`)
      setTitulo('')
      setConteudo('')
      setUrgente(false)
      setSelecionados([])
    } catch (err) {
      (() => { console.error('Erro ao enviar:', err); toast.error('Não foi possível enviar. Tente novamente.') })()
    }
    setEnviando(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center" aria-busy="true">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!autorizado) return null

  const todosSelecionados = selecionados.length === departamentos.length && departamentos.length > 0

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Aviso da gestão"
        subtitulo="Enviar para vários departamentos"
        onVoltar={() => navigate('/gestao-igreja')}
        icone={<span className="w-10 h-10 rounded-ctl flex items-center justify-center bg-brand/10 text-brand">
          <Megaphone className="w-5 h-5" aria-hidden="true" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6">
        <form onSubmit={enviarAviso} className="space-y-4">

          <Card>
            <fieldset>
              <div className="flex items-center justify-between mb-3">
                <legend className="text-sm font-bold text-ink flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand" aria-hidden="true" /> Departamentos
                </legend>
                <button type="button" onClick={toggleTodos}
                  className="text-xs font-semibold text-brand hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  {todosSelecionados ? 'Limpar' : 'Selecionar todos'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {departamentos.map(dept => {
                  const ativo = selecionados.includes(dept.id)
                  return (
                    <button key={dept.id} type="button" onClick={() => toggleDept(dept.id)} aria-pressed={ativo}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold border-2 transition
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                        ${ativo ? `${classesDept(dept.nome).chip} border-current` : 'bg-surface text-ink-2 border-line hover:bg-surface-2'}`}>
                      {ativo ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <IconeDept nome={dept.nome} className="w-4 h-4" />}
                      {dept.nome}
                    </button>
                  )
                })}
              </div>

              {selecionados.length > 0 && (
                <p className="text-xs text-ink-2 mt-3" aria-live="polite">
                  {selecionados.length} {selecionados.length === 1 ? 'departamento selecionado' : 'departamentos selecionados'}
                </p>
              )}
            </fieldset>
          </Card>

          <Card className="space-y-4">
            <Input label="Título" required placeholder="Ex: Reunião geral de líderes"
              value={titulo} onChange={e => setTitulo(e.target.value)} />

            <div>
              <label htmlFor="aviso-geral-mensagem" className="block text-xs font-semibold text-ink-2 mb-1.5">Mensagem</label>
              <textarea id="aviso-geral-mensagem" required placeholder="Escreva os detalhes" rows="4"
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
          </Card>

          <p className="flex items-start gap-2 bg-surface-2 rounded-ctl px-3 py-2.5 text-xs text-ink-2">
            <Megaphone className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>O aviso aparece no mural de cada departamento escolhido, marcado como <strong className="text-ink">Gestão da Igreja</strong>, e todos recebem no app e no celular.</span>
          </p>

          <Button type="submit" full loading={enviando} disabled={!titulo || !conteudo || selecionados.length === 0}
            icon={<Send className="w-4 h-4" aria-hidden="true" />}>
            {enviando ? 'Enviando...' : 'Enviar aviso'}
          </Button>
        </form>
      </main>
    </div>
  )
}
