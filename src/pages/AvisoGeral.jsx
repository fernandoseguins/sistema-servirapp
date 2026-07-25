// src/pages/AvisoGeral.jsx
// Envio de aviso da GESTÃO DA IGREJA para múltiplos departamentos de uma vez.
// Cria uma cópia do aviso no mural de cada departamento selecionado (marcado da_gestao=true)
// e notifica todos os membros desses departamentos.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { getDeptTheme, getDeptIcones } from '../utils/departmentThemes'
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
      .select('id, nome, cor, icone')
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
            ? `🚨 Aviso URGENTE da Gestão da Igreja`
            : `📢 Aviso da Gestão da Igreja`
          await enviarNotificacaoEmMassa({
            userIds:   userIdsAlvo,
            titulo:    tituloNotif,
            mensagem:  `"${titulo}" — abra o app para ver os detalhes.`,
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!autorizado) return null

  const todosSelecionados = selecionados.length === departamentos.length && departamentos.length > 0

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Aviso Geral"
        subtitle="Enviar para departamentos da igreja"
        icon={<Megaphone className="w-5 h-5" />}
        color="bg-gray-900"
        onBack={() => navigate('/gestao-igreja')}
      />

      <div className="max-w-md mx-auto px-4">
        <form onSubmit={enviarAviso} className="space-y-5">

          {/* ── Seleção de departamentos ── */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" /> Departamentos
              </h2>
              <button type="button" onClick={toggleTodos}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition active:scale-[0.97]">
                {todosSelecionados ? 'Limpar' : 'Selecionar todos'}
              </button>
            </div>

            <div className="space-y-2">
              {departamentos.map(dept => {
                const theme = getDeptTheme(dept.nome, dept.cor)
                const icones = getDeptIcones(dept.nome, dept.icone)
                const ativo = selecionados.includes(dept.id)
                const pers = theme.personalizado
                const st = theme.styles || {}
                return (
                  <button key={dept.id} type="button" onClick={() => toggleDept(dept.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      ativo ? `${pers ? 'border-current' : theme.bgLight + ' border-current ' + theme.textPrimary}` : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                    style={ativo && pers ? { ...st.bgLight, ...st.textPrimary } : {}}>
                    <div className={`p-2 rounded-lg ${ativo ? (pers ? 'text-white' : theme.bgPrimary + ' text-white') : 'bg-white text-gray-400'}`}
                      style={ativo && pers ? st.bgPrimary : {}}>
                      {icones.Pequeno}
                    </div>
                    <span className={`flex-1 text-sm font-bold ${ativo ? (pers ? '' : theme.textPrimary) : 'text-gray-600'}`}
                      style={ativo && pers ? st.textPrimary : {}}>
                      {dept.nome}
                    </span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                      ativo ? (pers ? 'text-white' : `${theme.bgPrimary} text-white`) : 'bg-white border-2 border-gray-200'
                    }`}
                    style={ativo && pers ? st.bgPrimary : {}}>
                      {ativo && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                  </button>
                )
              })}
            </div>

            {selecionados.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-3 text-center font-medium">
                {selecionados.length} departamento(s) selecionado(s)
              </p>
            )}
          </div>

          {/* ── Conteúdo do aviso ── */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Título</label>
              <input type="text" required placeholder="Ex: Reunião geral de líderes"
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
          </div>

          {/* ── Info ── */}
          <div className="flex items-start gap-2 bg-gray-100 rounded-xl px-4 py-3">
            <Megaphone className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              O aviso aparecerá no mural de cada departamento selecionado, marcado como <span className="font-bold">"Gestão da Igreja"</span>, e todos os membros serão notificados no app e no celular.
            </p>
          </div>

          <button type="submit" disabled={enviando || !titulo || !conteudo || selecionados.length === 0}
            className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl shadow-md transition active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-black">
            {enviando
              ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enviando...</>
              : <><Send className="w-5 h-5" /> Enviar Aviso</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}