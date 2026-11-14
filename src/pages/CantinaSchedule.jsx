// src/pages/CantinaSchedule.jsx
// Montagem MANUAL da escala da Cantina (1 Caixa + 2 Atendentes).
// Apenas domingos à noite. Sem robô. Só líderes preenchem.
// Rótulo rotativo por domingo: Louvor → Diaconia → Infantil → Mídia (cíclico).

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { useNavigate, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { Coffee, UserPlus, Trash2, CalendarDays, ChevronLeft, ChevronRight, Search, X, Lock, CalendarPlus, Plus, Star } from 'lucide-react'
import { enviarNotificacao } from '../utils/notificacoes'
// Regra da rotação (sequência + âncora) mora em utils/cantinaRotacao.js —
// compartilhada com ScheduleBoard.jsx. Recalibrar só lá.
import { deptResponsavelCantina } from '../utils/cantinaRotacao'

// Funções fixas da cantina
const FUNCOES_CANTINA = ['Caixa', 'Atendente 1', 'Atendente 2']

export default function CantinaSchedule() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast, confirm } = useUI()

  const departamentoId   = location.state?.departamentoId
  const [ehLider, setEhLider] = useState(false)  // admin/líder em QUALQUER departamento

  const [loading,        setLoading]        = useState(true)
  const [mesAtual,       setMesAtual]       = useState(new Date().getMonth())
  const [anoAtual,       setAnoAtual]       = useState(new Date().getFullYear())
  const [domingos,       setDomingos]       = useState([])    // [{ data, escala, dept }]
  const [cultosExtras,   setCultosExtras]   = useState([])    // [{ data, titulo, escala }]
  const [modalExtra,     setModalExtra]     = useState(false) // modal criar culto extra
  const [extraData,      setExtraData]      = useState('')
  const [extraNome,      setExtraNome]      = useState('')
  const [todosUsuarios,  setTodosUsuarios]  = useState([])
  const [modalAberto,    setModalAberto]    = useState(null)  // { data, funcao }
  const [adicionando,    setAdicionando]    = useState(false)  // trava duplo-clique
  const [busca,          setBusca]          = useState('')

  useEffect(() => {
    if (!departamentoId) { navigate('/hub'); return }
    carregarDados()
  }, [mesAtual, anoAtual, departamentoId])

  async function carregarDados() {
    setLoading(true)

    // ✅ Verifica se é admin/líder em QUALQUER departamento → pode montar a Cantina
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: vinculos } = await supabase
        .from('membros_departamentos')
        .select('role')
        .eq('user_id', user.id)
      const podeMontar = vinculos?.some(v => v.role === 'admin' || v.role === 'líder') || false
      setEhLider(podeMontar)
    }

    // Calcula todos os domingos do mês
    const primeiroDia = new Date(anoAtual, mesAtual, 1)
    const ultimoDia   = new Date(anoAtual, mesAtual + 1, 0)
    const listaDomingos = []
    for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) { // domingo
        const dataStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        listaDomingos.push({
          data: dataStr,
          // Rotação contínua entre meses (ver utils/cantinaRotacao.js)
          deptResponsavel: deptResponsavelCantina(d),
        })
      }
    }

    const inicioMes = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-01`
    const fimMes    = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${ultimoDia.getDate()}`

    // Busca escalas da cantina + todos os usuários em paralelo
    // Defesa em profundidade: filtra usuários pela igreja (além do RLS)
    const { data: minhaIgreja } = await supabase.rpc('minha_igreja')

    const [escalasRes, usuariosRes] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, data, turno, status, schedule_roles(id, funcao, user_id, users_profile(nome))')
        .eq('departamento_id', departamentoId)
        .gte('data', inicioMes)
        .lte('data', fimMes),
      supabase.from('users_profile').select('id, nome').eq('igreja_id', minhaIgreja).order('nome'),
    ])

    const escalasPorData = {}
    const extras = []
    if (escalasRes.data) escalasRes.data.forEach(e => {
      if (e.turno === 'Extra') {
        // Culto extra: identificado pelo turno 'Extra'
        extras.push({ data: e.data, titulo: e.titulo || 'Culto Extra', escala: e })
      } else {
        escalasPorData[e.data] = e
      }
    })

    setDomingos(listaDomingos.map(dom => ({ ...dom, escala: escalasPorData[dom.data] || null })))
    setCultosExtras(extras.sort((a, b) => a.data.localeCompare(b.data)))
    if (usuariosRes.data) setTodosUsuarios(usuariosRes.data)
    setLoading(false)
  }

  // Garante que a escala existe (cria se necessário) e retorna o id
  async function garantirEscala(data) {
    // Procura nos domingos E nos cultos extras
    const existente = domingos.find(d => d.data === data)?.escala
      || cultosExtras.find(e => e.data === data)?.escala
    if (existente) return existente.id

    const { data: nova, error } = await supabase
      .from('schedules')
      .insert([{ departamento_id: departamentoId, data, turno: 'Noite', status: 'Publicada', titulo: 'Cantina' }])
      .select('id')
      .single()
    if (error) { (() => { console.error('Erro ao criar escala:', error); toast.error('Não foi possível criar a escala. Tente novamente.') })(); return null }
    return nova.id
  }

  // Cria um culto extra (data avulsa + nome). Só líderes.
  async function criarCultoExtra() {
    if (!extraData) { toast.warning('Escolha a data do culto.'); return }
    if (!extraNome.trim()) { toast.warning('Dê um nome ao culto (ex: Vigília).'); return }

    // Verifica se já existe culto extra nessa data
    if (cultosExtras.some(e => e.data === extraData)) {
      toast.warning('Já existe um culto extra nessa data.'); return
    }

    const { error } = await supabase
      .from('schedules')
      .insert([{ departamento_id: departamentoId, data: extraData, turno: 'Extra', status: 'Publicada', titulo: extraNome.trim() }])
    if (error) { (() => { console.error('Erro ao criar culto:', error); toast.error('Não foi possível criar o culto. Tente novamente.') })(); return }

    toast.success('Culto extra criado!')
    setModalExtra(false); setExtraData(''); setExtraNome('')
    carregarDados()
  }

  // Remove um culto extra inteiro (com confirmação)
  async function removerCultoExtra(escalaId, nome) {
    if (!await confirm({ title: 'Remover culto extra', message: `Remover "${nome}" e toda a sua escala?`, danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })) return
    // Remove os papéis primeiro, depois a escala
    await supabase.from('schedule_roles').delete().eq('schedule_id', escalaId)
    const { error } = await supabase.from('schedules').delete().eq('id', escalaId)
    if (error) { (() => { console.error('Erro ao remover:', error); toast.error('Não foi possível remover. Tente novamente.') })(); return }
    toast.success('Culto extra removido.')
    carregarDados()
  }

  async function adicionarPessoa(usuario) {
    if (!modalAberto) return
    if (adicionando) return  // evita duplo-clique escalando 2x
    setAdicionando(true)
    const { data, funcao } = modalAberto
    // Turno real desta data: 'Extra' se for culto extra, senão 'Noite' (domingo)
    const turnoData = cultosExtras.some(e => e.data === data) ? 'Extra' : 'Noite'

    // ✅ Verifica INDISPONIBILIDADE do membro nesta data (padrão do sistema)
    const { data: indispon } = await supabase
      .from('indisponibilidades')
      .select('turno')
      .eq('user_id', usuario.id)
      .eq('data', data)
    const indisp = indispon?.find(i => i.turno === turnoData || i.turno === 'Integral')
    if (indisp) {
      const turnoAviso = indisp.turno === 'Integral' ? 'o DIA TODO' : 'neste culto'
      if (!await confirm({
        title: '⚠️ Membro indisponível',
        message: `${usuario.nome} marcou indisponibilidade para ${turnoAviso} neste dia. Escalar mesmo assim?`,
        danger: true, labelOk: 'Escalar mesmo assim', labelCancel: 'Cancelar',
      })) { setAdicionando(false); return }
    }

    // ✅ Verifica CONFLITO: já escalado em outro departamento no mesmo dia/turno
    const { data: conflitos } = await supabase
      .from('schedule_roles')
      .select('id, schedules!inner(data, turno, departamentos(nome))')
      .eq('user_id', usuario.id)
      .eq('schedules.data', data)

    const conflito = conflitos?.find(c =>
      (c.schedules.turno === turnoData || c.schedules.turno === 'Integral') &&
      c.schedules.departamentos?.nome !== 'Cantina'
    )
    if (conflito) {
      const ok = await confirm({
        title: '⚠️ Conflito de escala',
        message: `${usuario.nome} já está escalado(a) em "${conflito.schedules.departamentos?.nome}" neste mesmo dia e turno. Escalar mesmo assim?`,
        danger: true, labelOk: 'Escalar mesmo assim', labelCancel: 'Cancelar',
      })
      if (!ok) { setAdicionando(false); return }
    }

    const escalaId = await garantirEscala(data)
    if (!escalaId) { setAdicionando(false); return }

    const { data: novoRole, error } = await supabase
      .from('schedule_roles')
      .insert([{ schedule_id: escalaId, user_id: usuario.id, funcao, status_confirmacao: 'Confirmado' }])
      .select('id, funcao, user_id, users_profile(nome)')
      .single()

    if (!error && novoRole) {
      // Atualiza estado
      setDomingos(prev => prev.map(dom => {
        if (dom.data !== data) return dom
        const escala = dom.escala || { id: escalaId, data, turno: 'Noite', schedule_roles: [] }
        return { ...dom, escala: { ...escala, id: escalaId, schedule_roles: [...(escala.schedule_roles || []), novoRole] } }
      }))
      toast.success(`${usuario.nome.split(' ')[0]} escalado(a) como ${funcao}!`)
      // Notifica
      const ocasiao = turnoData === 'Extra'
        ? `no culto extra (${formatarData(data)})`
        : 'no domingo à noite'
      enviarNotificacao({
        userId: usuario.id,
        titulo: '☕ Escala da Cantina',
        mensagem: `Você foi escalado(a) na Cantina como ${funcao} ${ocasiao}.`,
        tipo: 'escala',
        link: '/hub',
      })
      setModalAberto(null)
      setBusca('')
      // Culto extra: recarrega para refletir
      if (cultosExtras.some(e => e.data === data)) carregarDados()
    } else (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
    setAdicionando(false)
  }

  async function removerPessoa(domData, roleId, nome) {
    const ok = await confirm({ title: 'Remover da cantina?', message: `Remover ${nome} desta escala?`, danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })
    if (!ok) return

    const { error } = await supabase.from('schedule_roles').delete().eq('id', roleId)
    if (!error) {
      if (cultosExtras.some(e => e.data === domData)) {
        carregarDados()
      } else {
        setDomingos(prev => prev.map(dom => {
          if (dom.data !== domData) return dom
          return { ...dom, escala: { ...dom.escala, schedule_roles: dom.escala.schedule_roles.filter(r => r.id !== roleId) } }
        }))
      }
      toast.success('Removido(a) da cantina.')
    }
  }

  function pessoaNaFuncao(escala, funcao) {
    return escala?.schedule_roles?.find(r => r.funcao === funcao) || null
  }

  const nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const mesAnterior = () => { if (mesAtual === 0) { setMesAtual(11); setAnoAtual(a => a-1) } else setMesAtual(m => m-1) }
  const proximoMes  = () => { if (mesAtual === 11) { setMesAtual(0); setAnoAtual(a => a+1) } else setMesAtual(m => m+1) }

  const usuariosFiltrados = todosUsuarios.filter(u =>
    u.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  function formatarData(dataStr) {
    const d = new Date(dataStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Escala da Cantina"
        subtitle="1 Caixa + 2 Atendentes · Domingos à noite"
        icon={<Coffee className="w-5 h-5" />}
        color="bg-amber-500"
      />

      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* Navegação de mês */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <button onClick={mesAnterior} aria-label="Mês anterior" className="p-2 hover:bg-gray-100 rounded-lg transition active:scale-[0.97]"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
          <span className="text-sm font-bold text-gray-800 capitalize">{nomesMeses[mesAtual]} {anoAtual}</span>
          <button onClick={proximoMes} aria-label="Próximo mês" className="p-2 hover:bg-gray-100 rounded-lg transition active:scale-[0.97]"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
        </div>

        {/* Botão Criar Culto Extra (só líderes) */}
        {ehLider && (
          <button
            onClick={() => { setModalExtra(true); setExtraData(''); setExtraNome('') }}
            className="w-full bg-white border-2 border-dashed border-amber-300 text-amber-600 font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-amber-50 transition"
          >
            <CalendarPlus className="w-5 h-5" /> Criar Culto Extra
          </button>
        )}

        {/* Aviso para membros (não líderes) */}
        {!ehLider && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 font-medium">Apenas líderes podem montar a escala. Você pode visualizar.</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-100 h-40 animate-pulse" />)}
          </div>
        ) : domingos.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400">
            <Coffee className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhum domingo neste mês.</p>
          </div>
        ) : (
          <>
          {/* ── CULTOS EXTRAS deste mês ── */}
          {cultosExtras.filter(ex => {
            const [ano, mes] = ex.data.split('-')
            return Number(ano) === anoAtual && Number(mes) === mesAtual + 1
          }).map(extra => (
            <div key={'extra-' + extra.data} className="bg-white rounded-2xl shadow-sm border-2 border-purple-200 overflow-hidden">
              {/* Cabeçalho roxo para distinguir do domingo normal */}
              <div className="bg-purple-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-white" />
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">{extra.titulo}</p>
                    <p className="text-[10px] text-purple-100 leading-tight">Culto Extra · {formatarData(extra.data)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white text-[10px] px-2.5 py-1 rounded-full font-bold">Extra</span>
                  {ehLider && (
                    <button onClick={() => removerCultoExtra(extra.escala.id, extra.titulo)} className="text-purple-200 hover:text-white transition p-1" title="Remover culto extra">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* As 3 funções (mesmas da cantina) */}
              <div className="p-3 space-y-2">
                {FUNCOES_CANTINA.map(funcao => {
                  const pessoa = pessoaNaFuncao(extra.escala, funcao)
                  return (
                    <div key={funcao} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{funcao}</p>
                        {pessoa ? (
                          <p className="text-sm font-semibold text-gray-900 truncate">{pessoa.users_profile?.nome}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Vaga em aberto</p>
                        )}
                      </div>
                      {ehLider && (pessoa ? (
                        <button onClick={() => removerPessoa(extra.data, pessoa.id, pessoa.users_profile?.nome)}
                          className="text-gray-300 hover:text-red-500 transition p-1.5">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => { setModalAberto({ data: extra.data, funcao }); setBusca('') }}
                          className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition">
                          <UserPlus className="w-3.5 h-3.5" /> Escalar
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {domingos.map(dom => (
            <div key={dom.data} className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
              {/* Cabeçalho: dept responsável (em vez de "Domingo Noite") */}
              <div className="bg-amber-500 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-white" />
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">{dom.deptResponsavel}</p>
                    <p className="text-[10px] text-amber-100 leading-tight">Responsável · {formatarData(dom.data)}</p>
                  </div>
                </div>
                <span className="bg-white/20 text-white text-[10px] px-2.5 py-1 rounded-full font-bold">Domingo Noite</span>
              </div>

              {/* As 3 funções */}
              <div className="p-3 space-y-2">
                {FUNCOES_CANTINA.map(funcao => {
                  const pessoa = pessoaNaFuncao(dom.escala, funcao)
                  return (
                    <div key={funcao} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{funcao}</p>
                        {pessoa ? (
                          <p className="text-sm font-semibold text-gray-900 truncate">{pessoa.users_profile?.nome}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Vaga em aberto</p>
                        )}
                      </div>
                      {ehLider && (pessoa ? (
                        <button onClick={() => removerPessoa(dom.data, pessoa.id, pessoa.users_profile?.nome)}
                          className="text-gray-300 hover:text-red-500 transition p-1.5">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => { setModalAberto({ data: dom.data, funcao }); setBusca('') }}
                          className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition">
                          <UserPlus className="w-3.5 h-3.5" /> Escalar
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          </>
        )}
      </div>

      {/* Modal de seleção de pessoa */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center p-4 pt-[8vh] overflow-hidden" onClick={() => setModalAberto(null)}>
          <div className="bg-white w-full max-w-md rounded-3xl flex flex-col" style={{ maxHeight: '70dvh' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Escalar {modalAberto.funcao}</h3>
                  <p className="text-xs text-gray-400">{formatarData(modalAberto.data)}{cultosExtras.some(e => e.data === modalAberto.data) ? '' : ' · Domingo à noite'}</p>
                </div>
                <button onClick={() => setModalAberto(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input autoFocus type="text" placeholder="Buscar pessoa..." value={busca} onChange={e => setBusca(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
            <div className="overflow-y-auto p-3 space-y-1" style={{ minHeight: '120px', WebkitOverflowScrolling: 'touch' }}>
              {usuariosFiltrados.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Ninguém encontrado.</p>
              ) : usuariosFiltrados.map(u => (
                <button key={u.id} onClick={() => adicionarPessoa(u)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-amber-50 transition text-left">
                  <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {u.nome?.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800">{u.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Culto Extra */}
      {modalExtra && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center p-4 pt-[10vh]" onClick={() => setModalExtra(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Star className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Novo Culto Extra</h3>
              </div>
              <button onClick={() => setModalExtra(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <label className="block text-sm font-bold text-gray-700 mb-2">Nome do culto</label>
            <input
              type="text"
              value={extraNome}
              onChange={e => setExtraNome(e.target.value)}
              placeholder="Ex: Vigília, Congresso, Santa Ceia..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 mb-4 text-sm outline-none focus:ring-2 focus:ring-purple-400"
            />

            <label className="block text-sm font-bold text-gray-700 mb-2">Data do culto</label>
            <input
              type="date"
              value={extraData}
              onChange={e => setExtraData(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 mb-6 text-sm outline-none focus:ring-2 focus:ring-purple-400"
            />

            <div className="flex gap-2">
              <button onClick={() => setModalExtra(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold rounded-xl py-3 hover:bg-gray-200 transition">
                Cancelar
              </button>
              <button onClick={criarCultoExtra} className="flex-1 bg-purple-600 text-white font-bold rounded-xl py-3 hover:bg-purple-700 transition active:scale-[0.97] flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}