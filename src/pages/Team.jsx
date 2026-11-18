// src/pages/Team.jsx
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { enviarNotificacao } from '../utils/notificacoes'
import { TopBar, Button, Card, Pill, ListRow, Input, Select, Sheet, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { Users, Shield, ShieldAlert, Trash2, Mic, Mic2, Settings2, Music, Monitor, Camera, PenTool, Baby, Smile, HeartHandshake, Edit2, Save, Star, UserPlus, Plus, CalendarX, Calendar, CalendarCheck, ChevronLeft, ChevronRight, MoreHorizontal, Search } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

// Rótulo legível do cargo para notificações
const ROTULO_CARGO = { membro: 'Membro', 'líder': 'Líder', admin: 'Administrador' }

export default function Equipa() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const [departamentoTipo, setDepartamentoTipo] = useState(location.state?.departamentoTipo || '')
  
  const [equipa, setEquipa] = useState([])
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState([])
  const [novoMembroId, setNovoMembroId] = useState('')
  const [adicionando, setAdicionando] = useState(false)

  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [membroAcoes, setMembroAcoes] = useState(null)
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

  useEffect(() => {
    if (departamentoId) {
      supabase.from('departamentos').select('tipo').eq('id', departamentoId).single()
        .then(({ data }) => { if (data) setDepartamentoTipo(data.tipo || 'generico') })
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
      toast.success('Pessoa adicionada e avisada.')
      setNovoMembroId('')
      buscarEquipa()
    }
    setAdicionando(false)
  }

  async function alterarCargo(vinculoId, novoCargo, userId, nomeMembro) {
    const { error } = await supabase.from('membros_departamentos').update({ role: novoCargo }).eq('id', vinculoId)
    if (error) {
      toast.error('Erro ao alterar cargo.')
      return false
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

      toast.success('Nível de acesso atualizado.')
      buscarEquipa()
      return true
    }
  }

  async function removerMembro(vinculoId, nomeMembro, userIdRemovido) {
    if (!await confirm({ title: `Remover ${nomeMembro}?`, message: 'Esta pessoa será removida do departamento.', danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })) return false
    
    const { error } = await supabase.from('membros_departamentos').delete().eq('id', vinculoId)
    
    if (error) {
      toast.error('Erro ao remover membro.')
      return false
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
      return true
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
      if (perfil.infantil_auxiliar) tags.push({ icon: <Smile className="w-3 h-3" />, label: 'Auxiliar' }) 
    }
    else if (departamentoNome === 'Diaconia') {
      if (perfil.diaconia) tags.push({ icon: <Shield className="w-3 h-3" />, label: 'Diaconia' }) 
    }

    if (tags.length === 0) {
      return <p className="text-xs text-muted mt-1">Nenhuma função definida.</p>
    }

  return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {tags.map((tag, idx) => (
          <Pill key={idx} tom="dept" dept={departamentoNome}>{tag.icon} {tag.label}</Pill>
        ))}
      </div>
    )
  }

  const OptionCheckbox = ({ icon, label, checked, field }) => (
    <label className={`flex items-center gap-2 p-3 rounded-ctl border-2 cursor-pointer transition flex-1
      focus-within:ring-2 focus-within:ring-brand
      ${checked ? 'bg-brand/10 border-brand text-brand' : 'border-line text-ink-2 hover:bg-surface-2'}`}>
      <input
        type="checkbox" className="sr-only"
        checked={!!checked}
        onChange={(e) => setPerfilEditando({...perfilEditando, [field]: e.target.checked})}
      />
      {icon}
      <span className="text-xs font-semibold">{label}</span>
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

  const termo = busca.trim().toLowerCase()
  const membrosVisiveis = termo
    ? membrosOrdenados.filter(m => (m.users_profile?.nome || '').toLowerCase().includes(termo))
    : membrosOrdenados

  const RotuloCargo = ({ role }) => role === 'admin'
    ? <Pill tom="aviso"><ShieldAlert className="w-3 h-3" aria-hidden="true" /> Admin</Pill>
    : role === 'líder'
      ? <Pill tom="brand"><Shield className="w-3 h-3" aria-hidden="true" /> Líder</Pill>
      : null

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Equipe"
        subtitulo={departamentoNome}
        onVoltar={() => navigate(-1)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome).chip}`}>
          <IconeDept nome={departamentoNome} className="w-5 h-5" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">

        <Card>
          <h2 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand" aria-hidden="true" /> Adicionar à equipe
          </h2>
          <form onSubmit={adicionarNovoMembro} className="flex gap-2 items-end">
            <Select
              className="flex-1"
              aria-label="Pessoa da igreja"
              value={novoMembroId}
              onChange={(e) => setNovoMembroId(e.target.value)}
              options={[{ value: '', label: 'Escolha uma pessoa' }, ...usuariosDisponiveis.map(u => ({ value: u.id, label: u.nome }))]}
            />
            <Button type="submit" disabled={!novoMembroId} loading={adicionando} aria-label="Adicionar à equipe"
              icon={<Plus className="w-5 h-5" aria-hidden="true" />} />
          </form>
        </Card>

        {!loading && equipa.length > 0 && (
          <Input
            type="search"
            aria-label="Buscar membro"
            placeholder="Buscar pelo nome"
            icon={<Search className="w-4 h-4" aria-hidden="true" />}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        )}

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-2 rounded-card animate-pulse" />)}
          </div>
        ) : equipa.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="w-6 h-6" aria-hidden="true" />}
              titulo="Ninguém na equipe ainda"
              texto="Adicione pessoas da igreja pelo campo acima."
            />
          </Card>
        ) : membrosVisiveis.length === 0 ? (
          <Card>
            <EmptyState icon={<Search className="w-6 h-6" aria-hidden="true" />} titulo="Ninguém com esse nome" texto="Confira a busca." />
          </Card>
        ) : (
          <Card padded={false} className="px-4">
            {membrosVisiveis.map((membro) => {
              const nome = membro.users_profile?.nome || 'Membro'
              return (
                <div key={membro.id} className="flex items-start gap-3 py-3 border-b border-line last:border-b-0">
                  <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm flex-shrink-0" aria-hidden="true">
                    {nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-ink text-sm break-words">{nome}</p>
                      <RotuloCargo role={membro.role} />
                    </div>
                    {renderizarFuncoes(membro.users_profile)}
                  </div>
                  <button type="button" onClick={() => setMembroAcoes(membro)} aria-label={`Ações de ${nome}`}
                    className="p-2 -mr-2 rounded-ctl text-ink-2 hover:bg-surface-2 transition flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                    <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </Card>
        )}
      </main>

      {/* AÇÕES DO MEMBRO */}
      <Sheet aberto={!!membroAcoes} onFechar={() => setMembroAcoes(null)} titulo={membroAcoes?.users_profile?.nome || 'Membro'}>
        {membroAcoes && (
          <div className="space-y-4">
            <Select
              label="Nível de acesso"
              value={membroAcoes.role}
              onChange={async (e) => {
                const novo = e.target.value
                const m = membroAcoes
                if (await alterarCargo(m.id, novo, m.user_id, m.users_profile?.nome || 'Membro')) {
                  setMembroAcoes(atual => atual && atual.id === m.id ? { ...atual, role: novo } : atual)
                }
              }}
              options={[
                { value: 'membro', label: 'Membro' },
                { value: 'líder', label: 'Líder (gera escalas)' },
                { value: 'admin', label: 'Administrador' },
              ]}
            />
            <div>
              <ListRow
                icon={<Edit2 className="w-5 h-5 text-brand" aria-hidden="true" />}
                titulo="Editar funções"
                onClick={() => { const m = membroAcoes; setMembroAcoes(null); abrirModal(m.users_profile) }}
              />
              <ListRow
                icon={<Calendar className="w-5 h-5 text-brand" aria-hidden="true" />}
                titulo="Ver agenda"
                subtitulo="Escalas em outros departamentos e dias off"
                onClick={() => { const m = membroAcoes; setMembroAcoes(null); abrirModalIndisponibilidade(m.users_profile?.id, m.users_profile?.nome) }}
              />
            </div>
            <Button variant="perigo" full icon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
              onClick={() => removerMembro(membroAcoes.id, membroAcoes.users_profile?.nome || 'Membro', membroAcoes.user_id).then(removido => { if (removido) setMembroAcoes(null) })}>
              Remover da equipe
            </Button>
          </div>
        )}
      </Sheet>

      {/* EDIÇÃO DE FUNÇÕES */}
      <Sheet aberto={modalAberto && !!perfilEditando} onFechar={() => setModalAberto(false)} titulo={`Funções de ${perfilEditando?.nome || ''}`}>
        {perfilEditando && (
          <form onSubmit={salvarNovasFuncoes} className="space-y-4">

            {departamentoNome === 'Louvor' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <OptionCheckbox icon={<Star className="w-4 h-4" aria-hidden="true" />} label="Condução" checked={perfilEditando.conducao} field="conducao" />
                  <OptionCheckbox icon={<Mic className="w-4 h-4" aria-hidden="true" />} label="Voz principal" checked={perfilEditando.voz} field="voz" />
                  <OptionCheckbox icon={<Mic2 className="w-4 h-4" aria-hidden="true" />} label="Backing vocal" checked={perfilEditando.backing_vocal} field="backing_vocal" />
                  <OptionCheckbox icon={<Settings2 className="w-4 h-4" aria-hidden="true" />} label="Mesa de som" checked={perfilEditando.sonoplastia} field="sonoplastia" />
                </div>

                <fieldset className="border-t border-line pt-3">
                  <legend className="text-xs font-semibold text-ink-2 mb-2 flex items-center gap-1">
                    <Music className="w-4 h-4 text-brand" aria-hidden="true" /> Instrumentos
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {listaInstrumentos.map(inst => {
                      const isSelecionado = perfilEditando.instrumentosSelecionados?.includes(inst)
                      return (
                        <button
                          key={inst}
                          type="button"
                          aria-pressed={!!isSelecionado}
                          onClick={() => toggleInstrumentoModal(inst)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                            ${isSelecionado ? 'bg-brand text-on-brand border-brand' : 'bg-surface text-ink-2 border-line hover:bg-surface-2'}`}
                        >
                          {inst}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              </>
            )}

            {departamentoNome === 'Mídia' && (
              <div className="flex flex-col gap-2">
                <OptionCheckbox icon={<Monitor className="w-4 h-4" aria-hidden="true" />} label="Computador/projeção" checked={perfilEditando.midia_computador} field="midia_computador" />
                <OptionCheckbox icon={<Camera className="w-4 h-4" aria-hidden="true" />} label="Fotos e vídeos" checked={perfilEditando.midia_fotografia} field="midia_fotografia" />
                <OptionCheckbox icon={<PenTool className="w-4 h-4" aria-hidden="true" />} label="Redação/redes sociais" checked={perfilEditando.midia_redacao} field="midia_redacao" />
              </div>
            )}

            {departamentoNome === 'Infantil' && (
              <div className="grid grid-cols-2 gap-2">
                <OptionCheckbox icon={<Baby className="w-4 h-4" aria-hidden="true" />} label="Berçário" checked={perfilEditando.infantil_bercario} field="infantil_bercario" />
                <OptionCheckbox icon={<Smile className="w-4 h-4" aria-hidden="true" />} label="Sala 03-08" checked={perfilEditando.infantil_sala3_8} field="infantil_sala3_8" />
                <OptionCheckbox icon={<Smile className="w-4 h-4" aria-hidden="true" />} label="Sala 09-11" checked={perfilEditando.infantil_sala9_11} field="infantil_sala9_11" />
                <OptionCheckbox icon={<HeartHandshake className="w-4 h-4" aria-hidden="true" />} label="Acolhimento" checked={perfilEditando.infantil_acolhimento} field="infantil_acolhimento" />
                <OptionCheckbox icon={<HeartHandshake className="w-4 h-4" aria-hidden="true" />} label="Auxiliar" checked={perfilEditando.infantil_auxiliar} field="infantil_auxiliar" />
              </div>
            )}

            {departamentoNome === 'Diaconia' && (
              <div className="flex gap-2">
                <OptionCheckbox icon={<Shield className="w-4 h-4" aria-hidden="true" />} label="Atuar na Diaconia" checked={perfilEditando.diaconia} field="diaconia" />
              </div>
            )}

            <Button type="submit" full loading={salvandoFuncoes} icon={<Save className="w-4 h-4" aria-hidden="true" />}>
              {salvandoFuncoes ? 'Salvando...' : 'Salvar funções'}
            </Button>
          </form>
        )}
      </Sheet>

      {/* AGENDA DO MEMBRO EM TODOS OS DEPARTAMENTOS */}
      <Sheet aberto={modalIndispAberto && !!membroIndisp} onFechar={() => setModalIndispAberto(false)} titulo={`Agenda de ${membroIndisp?.nome || ''}`}>
        {membroIndisp && (
          <div>
            <div className="flex items-center justify-between bg-surface-2 p-2 rounded-ctl mb-4">
              <span className="text-sm font-bold text-ink pl-2" aria-live="polite">{nomesMeses[mesModal]} {anoModal}</span>
              <div className="flex gap-1">
                <button type="button" onClick={mesAnteriorModal} aria-label="Mês anterior"
                  className="p-1.5 rounded-ctl text-ink-2 hover:bg-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={proximoMesModal} aria-label="Próximo mês"
                  className="p-1.5 rounded-ctl text-ink-2 hover:bg-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {loadingIndisp ? (
              <div className="space-y-2" aria-busy="true">
                {[1, 2].map(i => <div key={i} className="h-16 bg-surface-2 rounded-ctl animate-pulse" />)}
              </div>
            ) : listaIndisp.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck className="w-6 h-6" aria-hidden="true" />}
                titulo="Livre neste mês"
                texto="Sem escalas em outros departamentos nem dias off."
              />
            ) : (
              <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {listaIndisp.map(item => {
                  const off = item.tipo === 'OFF'
                  return (
                    <li key={item.id} className={`p-3 rounded-ctl flex justify-between items-start gap-2 ${off ? 'bg-danger-soft' : 'bg-brand/10'}`}>
                      <div className="min-w-0">
                        <p className="font-bold text-sm flex items-center gap-1.5 mb-0.5 text-ink">
                          {off ? <CalendarX className="w-3.5 h-3.5 text-danger" aria-hidden="true" /> : <CalendarCheck className="w-3.5 h-3.5 text-brand" aria-hidden="true" />}
                          {formatarDataBR(item.data)}
                        </p>
                        <p className={`text-xs font-semibold ${off ? 'text-danger' : 'text-brand'}`}>
                          {item.tipo === 'ESCALA' ? `Escalado: ${item.departamento}` : `Dia off: ${item.departamento}`}
                        </p>
                        <p className="text-xs text-ink-2 mt-0.5">{item.motivo}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Pill tom={off ? 'perigo' : 'brand'}>{item.turno === 'Integral' ? 'Dia todo' : item.turno}</Pill>
                        {item.tipo === 'ESCALA' && item.statusEscala === 'Rascunho' && <Pill tom="aviso">Rascunho</Pill>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
