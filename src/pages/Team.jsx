// src/pages/Team.jsx
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { getDeptTheme } from '../utils/departmentThemes'
import { useUI } from '../context/UIContext'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { enviarNotificacao } from '../utils/notificacoes'
import { ArrowLeft, Users, Shield, ShieldAlert, Trash2, User, Mic, Mic2, Settings2, Music, Monitor, Camera, PenTool, Baby, Smile, HeartHandshake, Edit2, XCircle, Save, Star, UserPlus, Plus, CalendarX, Calendar, CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

// Rótulo legível do cargo para notificações
const ROTULO_CARGO = { membro: 'Membro', 'líder': 'Líder', admin: 'Administrador' }

export default function Equipa() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const [departamentoTipo, setDepartamentoTipo] = useState(location.state?.departamentoTipo || '')
  const [departamentoCor, setDepartamentoCor] = useState(null)
  
  const [equipa, setEquipa] = useState([])
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState([])
  const [novoMembroId, setNovoMembroId] = useState('')
  const [adicionando, setAdicionando] = useState(false)

  const [loading, setLoading] = useState(true)
  const { toast, confirm } = useUI()

  // Controladores do Modal de Edição de Funções
  const [modalAberto, setModalAberto] = useState(false)
  const [perfilEditando, setPerfilEditando] = useState(null)
  const [salvandoFuncoes, setSalvandoFuncoes] = useState(false)

  // Controladores do Modal de Agenda Global
  const [modalIndispAberto, setModalIndispAberto] = useState(false)
  const [membroIndisp, setMembroIndisp] = useState(null)
  const [listaIndisp, setListaIndisp] = useState([])
  const [loadingIndisp, setLoadingIndisp] = useState(false)
  
  // ✅ NOVOS ESTADOS PARA O FILTRO DE MÊS DA AGENDA
  const hoje = new Date()
  const [mesModal, setMesModal] = useState(hoje.getMonth())
  const [anoModal, setAnoAtualModal] = useState(hoje.getFullYear())
  const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  const listaInstrumentos = ['Violão', 'Guitarra', 'Teclado', 'Bateria', 'Baixo', 'Percussão']

  const getTheme = (nomeDept) => {
    if (nomeDept === 'Mídia') return { 
      bgPrimary: 'bg-purple-600', textPrimary: 'text-purple-600', 
      tagBg: 'bg-purple-100', tagText: 'text-purple-700', border: 'border-purple-200', btnHover: 'hover:bg-purple-700'
    }
    if (nomeDept === 'Infantil') return { 
      bgPrimary: 'bg-pink-500', textPrimary: 'text-pink-500', 
      tagBg: 'bg-pink-100', tagText: 'text-pink-700', border: 'border-pink-200', btnHover: 'hover:bg-pink-600' 
    }
    if (nomeDept === 'Diaconia') return { 
      bgPrimary: 'bg-gray-900', textPrimary: 'text-gray-900', 
      tagBg: 'bg-gray-200', tagText: 'text-gray-800', border: 'border-gray-300', btnHover: 'hover:bg-black' 
    }
    return { 
      bgPrimary: 'bg-blue-600', textPrimary: 'text-blue-600', 
      tagBg: 'bg-blue-100', tagText: 'text-blue-700', border: 'border-blue-200', btnHover: 'hover:bg-blue-700' 
    }
  }

  const deptThemeCustom = getDeptTheme(departamentoNome, departamentoCor)
  const pers = deptThemeCustom.personalizado
  const st = deptThemeCustom.styles || {}
  const theme = getTheme(departamentoNome)  // estrutura de classes para departamentos padrão

  useEffect(() => {
    if (departamentoId) {
      supabase.from('departamentos').select('tipo, cor').eq('id', departamentoId).single()
        .then(({ data }) => { if (data) { setDepartamentoTipo(data.tipo || 'generico'); setDepartamentoCor(data.cor) } })
    }
    if (!departamentoId) {
      navigate('/hub')
      return
    }
    buscarEquipa()
  }, [departamentoId])

  // ✅ NOVO USE EFFECT PARA RECARREGAR A AGENDA QUANDO MUDAR O MÊS
  useEffect(() => {
    if (modalIndispAberto && membroIndisp) {
      buscarAgendaMembro()
    }
  }, [mesModal, anoModal, modalIndispAberto, membroIndisp])

  async function buscarEquipa() {
    setLoading(true)

    // Defesa em profundidade: filtra usuários pela igreja do usuário (além do RLS)
    const { data: minhaIgreja } = await supabase.rpc('minha_igreja')

    // ✅ Promise.all — equipa + todos os usuários em paralelo
    const [{ data: dataEquipa, error }, { data: todosUsuarios }] = await Promise.all([
      supabase
        .from('membros_departamentos')
        .select(`
          id, role, user_id,
          users_profile ( 
            id, nome, 
            voz, conducao, backing_vocal, sonoplastia,
            midia_computador, midia_fotografia, midia_redacao,
            infantil_bercario, infantil_sala3_8, infantil_sala9_11, infantil_acolhimento, infantil_auxiliar,
            diaconia,
            user_instruments ( instrumento ) 
          )
        `)
        .eq('departamento_id', departamentoId)
        .order('role', { ascending: true }),
      supabase.from('users_profile').select('id, nome').eq('igreja_id', minhaIgreja).order('nome'),
    ])

    if (!error && dataEquipa) {
      const equipaLimpa = dataEquipa.filter(m => m.users_profile !== null)
      setEquipa(equipaLimpa)

      if (todosUsuarios) {
        const idsNaEquipa = equipaLimpa.map(m => m.user_id)
        const foraDaEquipa = todosUsuarios.filter(u => !idsNaEquipa.includes(u.id))
        setUsuariosDisponiveis(foraDaEquipa)
      }
    }
    setLoading(false)
  }

  async function adicionarNovoMembro(e) {
    e.preventDefault()
    if (!novoMembroId) return
    setAdicionando(true)

    const { error } = await supabase.from('membros_departamentos').insert([
      { user_id: novoMembroId, departamento_id: departamentoId, role: 'membro' }
    ])

    if (error) {
      (() => { console.error('Erro ao adicionar membro:', error); toast.error('Erro ao adicionar membro. Tente novamente.') })()
    } else {
      // ✅ Notificar o novo membro
      await enviarNotificacao({
        userId:         novoMembroId,
        departamentoId,
        titulo:         '👋 Boas-vindas à equipe!',
        mensagem:       `Boas-vindas à equipe de ${departamentoNome}! Abra o app para ver suas escalas.`,
        tipo:           'admin',
        link:           `/dashboard/${departamentoId}`,
      })
      toast.success('Novo membro recrutado e notificado!')
      setNovoMembroId('')
      buscarEquipa()
    }
    setAdicionando(false)
  }

  async function alterarCargo(vinculoId, novoCargo, userId, nomeMembro) {
    const { error } = await supabase.from('membros_departamentos').update({ role: novoCargo }).eq('id', vinculoId)
    if (error) {
      toast.error('Erro ao alterar cargo.')
    } else {
      // ✅ Push + in-app via utilitário centralizado
      await enviarNotificacao({
        userId,
        departamentoId,
        titulo: '👤 Seu cargo mudou',
        mensagem: `Seu cargo em ${departamentoNome} agora é ${ROTULO_CARGO[novoCargo] || novoCargo}.`,
        tipo: 'admin',
        link: `/dashboard/${departamentoId}`,
      })

      toast.success('Cargo atualizado com sucesso!')
      buscarEquipa()
    }
  }

  async function removerMembro(vinculoId, nomeMembro, userIdRemovido) {
    if (!await confirm({ title: `Remover ${nomeMembro}?`, message: 'Esta pessoa será removida do departamento.', danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })) return
    
    const { error } = await supabase.from('membros_departamentos').delete().eq('id', vinculoId)
    
    if (error) {
      toast.error('Erro ao remover membro.')
    } else {
      // ✅ Notificar o membro removido (pelo user_id do vínculo — nunca pelo nome, que pode repetir)
      if (userIdRemovido) {
        await enviarNotificacao({
          userId:    userIdRemovido,
          departamentoId,
          titulo:    '❌ Você saiu de uma equipe',
          mensagem:  `Você não faz mais parte da equipe de ${departamentoNome}. Dúvidas? Fale com um líder.`,
          tipo:      'admin',
          link:      '/hub',
        })
      }
      toast.info(`${nomeMembro} não faz mais parte da equipe.`)
      buscarEquipa()
    }
  }

  function abrirModal(perfil) {
    const instrumentosAtuais = perfil.user_instruments ? perfil.user_instruments.map(i => i.instrumento) : []
    setPerfilEditando({ ...perfil, instrumentosSelecionados: instrumentosAtuais })
    setModalAberto(true)
  }

  function toggleInstrumentoModal(inst) {
    const atuais = perfilEditando.instrumentosSelecionados || []
    if (atuais.includes(inst)) {
      setPerfilEditando({ ...perfilEditando, instrumentosSelecionados: atuais.filter(i => i !== inst) })
    } else {
      setPerfilEditando({ ...perfilEditando, instrumentosSelecionados: [...atuais, inst] })
    }
  }

  async function salvarNovasFuncoes(e) {
    e.preventDefault()
    if (!perfilEditando) return
    
    setSalvandoFuncoes(true)

    const updates = {}
    if (departamentoTipo === 'louvor') {
      updates.voz = perfilEditando.voz
      updates.conducao = perfilEditando.conducao
      updates.backing_vocal = perfilEditando.backing_vocal
      updates.sonoplastia = perfilEditando.sonoplastia
      
      await supabase.from('user_instruments').delete().eq('user_id', perfilEditando.id)
      
      if (perfilEditando.instrumentosSelecionados && perfilEditando.instrumentosSelecionados.length > 0) {
        const instsToInsert = perfilEditando.instrumentosSelecionados.map(inst => ({
          user_id: perfilEditando.id,
          instrumento: inst
        }))
        await supabase.from('user_instruments').insert(instsToInsert)
      }

    } else if (departamentoTipo === 'midia') {
      updates.midia_computador = perfilEditando.midia_computador
      updates.midia_fotografia = perfilEditando.midia_fotografia
      updates.midia_redacao = perfilEditando.midia_redacao
    } else if (departamentoTipo === 'infantil') {
      updates.infantil_bercario = perfilEditando.infantil_bercario
      updates.infantil_sala3_8 = perfilEditando.infantil_sala3_8
      updates.infantil_sala9_11 = perfilEditando.infantil_sala9_11
      updates.infantil_acolhimento = perfilEditando.infantil_acolhimento
      updates.infantil_auxiliar = perfilEditando.infantil_auxiliar 
    } else if (departamentoNome === 'Diaconia') {
      updates.diaconia = perfilEditando.diaconia 
    }

    const { error } = await supabase.from('users_profile').update(updates).eq('id', perfilEditando.id)

    if (error) {
      (() => { console.error('Erro ao salvar as funções:', error); toast.error('Não foi possível salvar as funções. Tente novamente.') })()
    } else {
      setModalAberto(false)
      buscarEquipa() 
    }
    setSalvandoFuncoes(false)
  }

  // ✅ FUNÇÃO REDESENHADA PARA ABRIR O MODAL E SETAR O MÊS ATUAL
  function abrirModalIndisponibilidade(id, nome) {
    setMembroIndisp({ id, nome })
    setMesModal(hoje.getMonth())
    setAnoAtualModal(hoje.getFullYear())
    setModalIndispAberto(true)
  }

  // ✅ FUNÇÃO QUE BUSCA A AGENDA BASEADA NO MÊS SELECIONADO
  async function buscarAgendaMembro() {
    setLoadingIndisp(true)

    const mesFormatado = String(mesModal + 1).padStart(2, '0')
    const dataInicio = `${anoModal}-${mesFormatado}-01`
    const ultimoDia = new Date(anoModal, mesModal + 1, 0).getDate()
    const dataFim = `${anoModal}-${mesFormatado}-${String(ultimoDia).padStart(2, '0')}`

    // ✅ Promise.all — depts + indisponibilidades + escalas em paralelo
    const [{ data: depts }, { data: indispData }, { data: escalasData }] = await Promise.all([
      supabase.from('departamentos').select('id, nome'),
      supabase
        .from('indisponibilidades')
        .select('*')
        .eq('user_id', membroIndisp.id)
        .gte('data', dataInicio)
        .lte('data', dataFim),
      supabase
        .from('schedule_roles')
        .select(`
          id, funcao,
          schedules!inner ( data, turno, departamento_id, status )
        `)
        .eq('user_id', membroIndisp.id)
        .gte('schedules.data', dataInicio)
        .lte('schedules.data', dataFim),
    ])
    const deptsMap = {}
    if (depts) depts.forEach(d => deptsMap[d.id] = d.nome)

    let listaUnificada = []

    if (indispData) {
      indispData.forEach(i => {
        listaUnificada.push({
          id: `ind-${i.id}`,
          data: i.data,
          turno: i.turno,
          motivo: i.motivo || 'Nenhum motivo informado',
          departamento: deptsMap[i.departamento_id] || 'Geral',
          tipo: 'OFF'
        })
      })
    }

    if (escalasData) {
      escalasData.forEach(e => {
        // ✅ BLINDAGEM: Oculta escalas que são do próprio departamento atual
        if (e.schedules.departamento_id !== departamentoId) {
          listaUnificada.push({
            id: `esc-${e.id}`,
            data: e.schedules.data,
            turno: e.schedules.turno,
            motivo: `Função: ${e.funcao}`,
            departamento: deptsMap[e.schedules.departamento_id] || 'Desconhecido',
            statusEscala: e.schedules.status,
            tipo: 'ESCALA'
          })
        }
      })
    }

    listaUnificada.sort((a, b) => new Date(a.data) - new Date(b.data))
    setListaIndisp(listaUnificada)
    setLoadingIndisp(false)
  }

  // ✅ NAVEGAÇÃO DO MÊS NO MODAL
  const mesAnteriorModal = () => { 
    if (mesModal === 0) { setMesModal(11); setAnoAtualModal(anoModal - 1) } 
    else { setMesModal(mesModal - 1) } 
  }
  const proximoMesModal = () => { 
    if (mesModal === 11) { setMesModal(0); setAnoAtualModal(anoModal + 1) } 
    else { setMesModal(mesModal + 1) } 
  }

  const formatarDataBR = (dataString) => dataString.split('-').reverse().join('/')

  const renderizarFuncoes = (perfil) => {
    let tags = []

    if (departamentoTipo === 'louvor') {
      if (perfil.conducao) tags.push({ icon: <Star className="w-3 h-3" />, label: 'Condução' })
      if (perfil.voz) tags.push({ icon: <Mic className="w-3 h-3" />, label: 'Voz Principal' })
      if (perfil.backing_vocal) tags.push({ icon: <Mic2 className="w-3 h-3" />, label: 'Backing Vocal' })
      if (perfil.sonoplastia) tags.push({ icon: <Settings2 className="w-3 h-3" />, label: 'Sonoplastia' })
      if (perfil.user_instruments) {
        perfil.user_instruments.forEach(inst => tags.push({ icon: <Music className="w-3 h-3" />, label: inst.instrumento }))
      }
    } 
    else if (departamentoNome === 'Mídia') {
      if (perfil.midia_computador) tags.push({ icon: <Monitor className="w-3 h-3" />, label: 'Computador' })
      if (perfil.midia_fotografia) tags.push({ icon: <Camera className="w-3 h-3" />, label: 'Fotografia' })
      if (perfil.midia_redacao) tags.push({ icon: <PenTool className="w-3 h-3" />, label: 'Redação' })
    } 
    else if (departamentoNome === 'Infantil') {
      if (perfil.infantil_bercario) tags.push({ icon: <Baby className="w-3 h-3" />, label: 'Berçário' })
      if (perfil.infantil_sala3_8) tags.push({ icon: <Smile className="w-3 h-3" />, label: 'Sala 03-08' })
      if (perfil.infantil_sala9_11) tags.push({ icon: <Smile className="w-3 h-3" />, label: 'Sala 09-11' })
      if (perfil.infantil_acolhimento) tags.push({ icon: <HeartHandshake className="w-3 h-3" />, label: 'Acolhimento' })
      if (perfil.infantil_auxiliar) tags.push({ icon: <Smile className="w-3 h-3 text-blue-500" />, label: 'Auxiliar' }) 
    }
    else if (departamentoNome === 'Diaconia') {
      if (perfil.diaconia) tags.push({ icon: <Shield className="w-3 h-3" />, label: 'Diaconia' }) 
    }

    if (tags.length === 0) {
      return <span className="text-[10px] text-gray-400 italic font-medium">Nenhuma função definida.</span>
    }

  return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {tags.map((tag, idx) => (
          <span key={idx} style={pers ? { ...st.tagBg, ...st.tagText, ...st.tagBorder } : {}} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${pers ? "" : theme.tagBg + " " + theme.tagText + " " + theme.border}`}>
            {tag.icon} {tag.label}
          </span>
        ))}
      </div>
    )
  }

  const OptionCheckbox = ({ icon, label, checked, field, colorClass }) => (
    <label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition flex-1 ${checked ? `bg-gray-50 border-gray-400 ${colorClass}` : 'border-gray-100 hover:bg-gray-50 text-gray-500'}`}>
      <input 
        type="checkbox" className="hidden" 
        checked={checked} 
        onChange={(e) => setPerfilEditando({...perfilEditando, [field]: e.target.checked})} 
      />
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
    </label>
  )

  // ✅ useMemo — lista de membros ordenada alfabeticamente
  // Só recalcula quando 'equipa' muda, não em cada render
  const membrosOrdenados = useMemo(() =>
    [...equipa].sort((a, b) =>
      (a.users_profile?.nome || '').localeCompare(b.users_profile?.nome || '')
    ),
    [equipa]
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      <PageHeader
        title={departamentoNome}
        subtitle="Gestão de membros e cargos"
        icon={<Users className="w-5 h-5" />}
        color={pers ? deptThemeCustom.hexValue : theme.bgPrimary}
      />

      <div className="max-w-xl mx-auto px-4 space-y-4">

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <h2 className={`text-sm font-bold uppercase mb-3 flex items-center gap-2 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}}>
            <UserPlus className="w-5 h-5" /> Adicionar à Equipe
          </h2>
          <form onSubmit={adicionarNovoMembro} className="flex gap-2">
            <select 
              value={novoMembroId} 
              onChange={(e) => setNovoMembroId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-xl p-2.5 text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500 text-gray-700"
            >
              <option value="">Selecione um membro da igreja...</option>
              {usuariosDisponiveis.map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
            <button 
              type="submit" 
              disabled={!novoMembroId || adicionando}
              style={pers ? st.bgPrimary : {}} className={`text-white px-4 rounded-xl font-bold transition active:scale-[0.97] flex items-center justify-center shadow-sm disabled:opacity-50 ${pers ? "" : theme.bgPrimary + " " + theme.btnHover}`}
              title="Recrutar para o departamento"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>
        </div>

        {loading ? (
          <div className="text-center p-10 text-gray-500 font-bold animate-pulse">A carregar equipe...</div>
        ) : equipa.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="Departamento sem membros"
            subtitle="Adicione membros para começar a gerir este departamento."
          />
        ) : (
          <div className="space-y-3">
            {equipa.map((membro) => (
              <div key={membro.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
                
                <div className="flex justify-between items-start mb-2 gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-full mt-1 flex-shrink-0 ${membro.role === 'admin' || membro.role === 'líder' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                      {membro.role === 'admin' ? <ShieldAlert className="w-5 h-5" /> : membro.role === 'líder' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Nome em sua própria linha (pode quebrar sem empurrar os ícones) */}
                      <h3 className="font-bold text-gray-900 text-lg leading-tight break-words">
                        {membro.users_profile?.nome || 'Membro'}
                      </h3>
                      {/* Ícones de ação numa linha separada — nunca colam na lixeira */}
                      <div className="flex items-center gap-3 mt-1">
                        <button onClick={() => abrirModal(membro.users_profile)} className="text-gray-300 hover:text-blue-600 transition" title="Editar Funções do Membro">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => abrirModalIndisponibilidade(membro.users_profile?.id, membro.users_profile?.nome)} className="text-gray-300 hover:text-blue-500 transition" title="Ver Agenda Global">
                          <Calendar className="w-4 h-4" />
                        </button>
                      </div>
                      {renderizarFuncoes(membro.users_profile)}
                    </div>
                  </div>

                  {/* Lixeira protegida: não encolhe e mantém distância dos outros ícones */}
                  <button 
                    onClick={() => removerMembro(membro.id, membro.users_profile?.nome || 'Membro', membro.user_id)}
                    className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0 ml-2"
                    title="Remover Membro"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nível de Acesso:</span>
                  <select 
                    value={membro.role} 
                    onChange={(e) => alterarCargo(membro.id, e.target.value, membro.user_id, membro.users_profile?.nome || 'Membro')}
                    className="text-sm border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 font-medium cursor-pointer"
                  >
                    <option value="membro">Membro Comum</option>
                    <option value="líder">Líder (Gera Escalas)</option>
                    <option value="admin">Administrador Geral</option>
                  </select>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE EDIÇÃO DE FUNÇÕES */}
      {modalAberto && perfilEditando && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-xl animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Settings2 className={`w-5 h-5 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}} /> Ajustar Funções
                </h2>
                <p className="text-xs text-gray-500 font-medium mt-1">A editar: <strong className="text-gray-800">{perfilEditando.nome}</strong></p>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={salvarNovasFuncoes} className="space-y-4">
              
              {departamentoNome === 'Louvor' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <OptionCheckbox icon={<Star className="w-4 h-4"/>} label="Condução" checked={perfilEditando.conducao} field="conducao" colorClass="text-yellow-600" />
                    <OptionCheckbox icon={<Mic className="w-4 h-4"/>} label="Voz Principal" checked={perfilEditando.voz} field="voz" colorClass="text-blue-600" />
                    <OptionCheckbox icon={<Mic2 className="w-4 h-4"/>} label="Backing Vocal" checked={perfilEditando.backing_vocal} field="backing_vocal" colorClass="text-purple-600" />
                    <OptionCheckbox icon={<Settings2 className="w-4 h-4"/>} label="Mesa de Som" checked={perfilEditando.sonoplastia} field="sonoplastia" colorClass="text-gray-800" />
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Music className="w-4 h-4 text-indigo-500"/> Instrumentos
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {listaInstrumentos.map(inst => {
                        const isSelecionado = perfilEditando.instrumentosSelecionados?.includes(inst)
                        return (
                          <button 
                            key={inst} 
                            type="button" 
                            onClick={() => toggleInstrumentoModal(inst)} 
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${isSelecionado ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                          >
                            {inst}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {departamentoNome === 'Mídia' && (
                <div className="flex flex-col gap-2">
                  <OptionCheckbox icon={<Monitor className="w-4 h-4"/>} label="Computador/Projeção" checked={perfilEditando.midia_computador} field="midia_computador" colorClass="text-indigo-600" />
                  <OptionCheckbox icon={<Camera className="w-4 h-4"/>} label="Fotos e Vídeos" checked={perfilEditando.midia_fotografia} field="midia_fotografia" colorClass="text-pink-600" />
                  <OptionCheckbox icon={<PenTool className="w-4 h-4"/>} label="Redação/Social" checked={perfilEditando.midia_redacao} field="midia_redacao" colorClass="text-orange-600" />
                </div>
              )}

              {departamentoNome === 'Infantil' && (
                <div className="grid grid-cols-2 gap-2">
                  <OptionCheckbox icon={<Baby className="w-4 h-4"/>} label="Berçário" checked={perfilEditando.infantil_bercario} field="infantil_bercario" colorClass="text-pink-600" />
                  <OptionCheckbox icon={<Smile className="w-4 h-4"/>} label="Sala 03-08" checked={perfilEditando.infantil_sala3_8} field="infantil_sala3_8" colorClass="text-yellow-600" />
                  <OptionCheckbox icon={<Smile className="w-4 h-4"/>} label="Sala 09-11" checked={perfilEditando.infantil_sala9_11} field="infantil_sala9_11" colorClass="text-green-600" />
                  <OptionCheckbox icon={<HeartHandshake className="w-4 h-4"/>} label="Acolhimento" checked={perfilEditando.infantil_acolhimento} field="infantil_acolhimento" colorClass="text-red-600" />
                  <OptionCheckbox icon={<HeartHandshake className="w-4 h-4 text-blue-400"/>} label="Auxiliar" checked={perfilEditando.infantil_auxiliar} field="infantil_auxiliar" colorClass="text-blue-600" />
                </div>
              )}

              {departamentoNome === 'Diaconia' && (
                <div className="flex gap-2">
                  <OptionCheckbox icon={<Shield className="w-4 h-4"/>} label="Atuar na Diaconia" checked={perfilEditando.diaconia} field="diaconia" colorClass="text-gray-900" />
                </div>
              )}

              <button type="submit" disabled={salvandoFuncoes} style={pers ? st.bgPrimary : {}} className={`w-full text-white font-bold py-3.5 rounded-xl transition active:scale-[0.97] flex items-center justify-center gap-2 mt-4 shadow-md ${pers ? "" : theme.bgPrimary + " " + theme.btnHover}`}>
                <Save className="w-5 h-5" />
                {salvandoFuncoes ? 'Salvando...' : 'Salvar Funções do Membro'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RADAR GLOBAL */}
      {modalIndispAberto && membroIndisp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" /> Agenda Global
                </h2>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Radar de: <strong className="text-gray-800">{membroIndisp.nome}</strong>
                </p>
              </div>
              <button onClick={() => setModalIndispAberto(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition"><XCircle className="w-6 h-6" /></button>
            </div>

            {/* ✅ SELETOR DE MÊS DENTRO DA GAVETA */}
            <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200 mb-4">
              <span className="text-sm font-bold text-gray-800 uppercase tracking-wider pl-2">
                {nomesMeses[mesModal]} {anoModal}
              </span>
              <div className="flex gap-1">
                <button onClick={mesAnteriorModal} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition active:scale-[0.97]"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={proximoMesModal} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition active:scale-[0.97]"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            {loadingIndisp ? (
              <p className="text-center py-6 text-sm font-bold text-gray-400 animate-pulse">A procurar agenda...</p>
            ) : listaIndisp.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck className="w-6 h-6" />}
                title="Sem conflitos este mês"
                subtitle="Pode escalar este membro à vontade!"
                size="sm"
                variant="success"
              />
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 customized-scrollbar">
                {listaIndisp.map(item => (
                  <div key={item.id} className={`p-3.5 rounded-xl border relative overflow-hidden ${item.tipo === 'OFF' ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.tipo === 'OFF' ? 'bg-red-400' : 'bg-blue-400'}`}></div>
                    
                    <div className="pl-2 flex justify-between items-start">
                      <div className="pr-2">
                        <p className={`font-bold text-sm flex items-center gap-1.5 mb-1 ${item.tipo === 'OFF' ? 'text-red-900' : 'text-blue-900'}`}>
                          {item.tipo === 'OFF' ? <CalendarX className="w-3.5 h-3.5 text-red-500" /> : <CalendarCheck className="w-3.5 h-3.5 text-blue-500" />}
                          {formatarDataBR(item.data)}
                        </p>
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${item.tipo === 'OFF' ? 'text-red-600' : 'text-blue-600'}`}>
                          {item.tipo === 'ESCALA' ? `Escalado: ${item.departamento}` : `Folga: ${item.departamento}`}
                        </p>
                        <p className="text-xs text-gray-600 font-medium mt-1 leading-snug">{item.motivo}</p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider font-bold ${item.tipo === 'OFF' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {item.turno === 'Integral' ? 'Dia Todo' : item.turno}
                        </span>
                        {item.tipo === 'ESCALA' && item.statusEscala === 'Rascunho' && (
                          <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md uppercase font-bold border border-orange-200">Rascunho</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button onClick={() => setModalIndispAberto(false)} className="w-full mt-4 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition">
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}