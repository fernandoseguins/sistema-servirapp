// src/pages/MinistrosSchedule.jsx
// Montagem MANUAL da escala de Ministros. Sem robô.
// Funções variam por dia. Pode escalar ministro cadastrado OU digitar nome de visitante.
// Só admin/líder (em qualquer departamento) pode montar.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { TopBar } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { HandHeart, UserPlus, Trash2, ChevronLeft, ChevronRight, Search, X, Lock, UserCog, CalendarPlus, Plus, Star, Check } from 'lucide-react'
import { enviarNotificacao } from '../utils/notificacoes'

// Funções por tipo de culto
const FUNCOES_POR_DIA = {
  Terça:          ['Condução da Oração'],
  Quinta:         ['Ministro', 'Condução de Culto', 'Oração'],
  'Domingo Manhã': ['Ministro', 'Condução de Culto', 'Oração'],
  'Domingo Noite': ['Ministro', 'Condução de Culto', 'Oração'],
}

// Funções disponíveis para escolher num culto extra
const FUNCOES_DISPONIVEIS = ['Ministro', 'Condução de Culto', 'Condução da Oração', 'Oração', 'Pregação', 'Louvor', 'Intercessão']

export default function MinistrosSchedule() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast, confirm } = useUI()

  const departamentoId = location.state?.departamentoId

  const [ehLider,       setEhLider]       = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [mesAtual,      setMesAtual]      = useState(new Date().getMonth())
  const [anoAtual,      setAnoAtual]      = useState(new Date().getFullYear())
  const [cultos,        setCultos]        = useState([])    // [{ data, tipo, escala }]
  const [cultosExtras,  setCultosExtras]  = useState([])    // [{ data, titulo, funcoes, escala }]
  const [modalExtra,    setModalExtra]    = useState(false)
  const [extraData,     setExtraData]     = useState('')
  const [extraNome,     setExtraNome]     = useState('')
  const [extraFuncoes,  setExtraFuncoes]  = useState([])
  const [todosUsuarios, setTodosUsuarios] = useState([])
  const [modalAberto,   setModalAberto]   = useState(null)  // { data, tipo, funcao }
  const [adicionando,   setAdicionando]   = useState(false)  // trava duplo-clique
  const [busca,         setBusca]         = useState('')
  const [nomeVisitante, setNomeVisitante] = useState('')

  useEffect(() => {
    if (!departamentoId) { navigate('/hub'); return }
    carregarDados()
  }, [mesAtual, anoAtual, departamentoId])

  async function carregarDados() {
    setLoading(true)

    // Verifica se é admin/líder em qualquer departamento
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: vinculos } = await supabase
        .from('membros_departamentos').select('role').eq('user_id', user.id)
      setEhLider(vinculos?.some(v => v.role === 'admin' || v.role === 'líder') || false)
    }

    // Monta a lista de cultos do mês (terça, quinta, domingo manhã + noite)
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0)
    const lista = []
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const d = new Date(anoAtual, mesAtual, dia)
      const dataStr = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
      const diaSemana = d.getDay()
      if (diaSemana === 2) lista.push({ data: dataStr, tipo: 'Terça', turno: 'Noite' })
      if (diaSemana === 4) lista.push({ data: dataStr, tipo: 'Quinta', turno: 'Noite' })
      if (diaSemana === 0) {
        lista.push({ data: dataStr, tipo: 'Domingo Manhã', turno: 'Manhã' })
        lista.push({ data: dataStr, tipo: 'Domingo Noite', turno: 'Noite' })
      }
    }

    const inicioMes = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-01`
    const fimMes    = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${ultimoDia.getDate()}`

    // Defesa em profundidade: filtra usuários pela igreja (além do RLS)
    const { data: minhaIgreja } = await supabase.rpc('minha_igreja')

    const [escalasRes, usuariosRes] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, data, turno, schedule_roles(id, funcao, user_id, nome_externo, users_profile(nome))')
        .eq('departamento_id', departamentoId)
        .gte('data', inicioMes)
        .lte('data', fimMes),
      supabase.from('users_profile').select('id, nome').eq('igreja_id', minhaIgreja).order('nome'),
    ])

    // Agrupa escalas por data+turno; separa os cultos extras (turno 'Extra')
    const escalasPorChave = {}
    const extras = []
    if (escalasRes.data) escalasRes.data.forEach(e => {
      if (e.turno === 'Extra') {
        // Funções do culto extra = funções distintas dos seus papéis
        const funcoes = [...new Set((e.schedule_roles || []).map(r => r.funcao))]
        extras.push({ data: e.data, titulo: e.titulo || 'Culto Extra', funcoes, escala: e })
      } else {
        escalasPorChave[`${e.data}_${e.turno}`] = e
      }
    })

    setCultos(lista.map(c => ({ ...c, escala: escalasPorChave[`${c.data}_${c.turno}`] || null })))
    setCultosExtras(extras.sort((a, b) => a.data.localeCompare(b.data)))
    if (usuariosRes.data) setTodosUsuarios(usuariosRes.data)
    setLoading(false)
  }

  async function garantirEscala(data, turno) {
    // Culto extra: a escala já existe (criada junto com as vagas)
    if (turno === 'Extra') {
      const ex = cultosExtras.find(e => e.data === data)
      if (ex?.escala) return ex.escala.id
    }
    const culto = cultos.find(c => c.data === data && c.turno === turno)
    if (culto?.escala) return culto.escala.id

    const { data: nova, error } = await supabase
      .from('schedules')
      .insert([{ departamento_id: departamentoId, data, turno, status: 'Publicada', titulo: 'Ministros' }])
      .select('id').single()
    if (error) { (() => { console.error('Erro ao criar escala:', error); toast.error('Não foi possível criar a escala. Tente novamente.') })(); return null }
    return nova.id
  }

  // Cria culto extra com as funções escolhidas (cria a escala + vagas vazias)
  async function criarCultoExtra() {
    if (!extraData) { toast.warning('Escolha a data do culto.'); return }
    if (!extraNome.trim()) { toast.warning('Dê um nome ao culto.'); return }
    if (extraFuncoes.length === 0) { toast.warning('Escolha pelo menos uma função.'); return }
    if (cultosExtras.some(e => e.data === extraData)) { toast.warning('Já existe um culto extra nessa data.'); return }

    // Cria a escala do culto extra
    const { data: nova, error } = await supabase
      .from('schedules')
      .insert([{ departamento_id: departamentoId, data: extraData, turno: 'Extra', status: 'Publicada', titulo: extraNome.trim() }])
      .select('id').single()
    if (error) { (() => { console.error('Erro ao criar culto:', error); toast.error('Não foi possível criar o culto. Tente novamente.') })(); return }

    // Cria as vagas (schedule_roles vazios) para cada função escolhida
    const vagas = extraFuncoes.map(f => ({ schedule_id: nova.id, funcao: f, user_id: null }))
    await supabase.from('schedule_roles').insert(vagas)

    toast.success('Culto extra criado!')
    setModalExtra(false); setExtraData(''); setExtraNome(''); setExtraFuncoes([])
    carregarDados()
  }

  async function removerCultoExtra(escalaId, nome) {
    if (!await confirm({ title: 'Remover culto extra', message: `Remover "${nome}" e toda a escala desse culto?`, danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })) return
    await supabase.from('schedule_roles').delete().eq('schedule_id', escalaId)
    const { error } = await supabase.from('schedules').delete().eq('id', escalaId)
    if (error) { (() => { console.error('Erro ao remover:', error); toast.error('Não foi possível remover. Tente novamente.') })(); return }
    toast.success('Culto extra removido.')
    carregarDados()
  }

  function toggleExtraFuncao(f) {
    setExtraFuncoes(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  // Escala uma pessoa CADASTRADA
  async function adicionarPessoa(usuario) {
    if (!modalAberto) return
    const { data, turno, funcao } = modalAberto

    // ✅ Verifica INDISPONIBILIDADE do membro nesta data (padrão do sistema)
    const { data: indispon } = await supabase
      .from('indisponibilidades')
      .select('turno')
      .eq('user_id', usuario.id)
      .eq('data', data)
    const indisp = indispon?.find(i => i.turno === turno || i.turno === 'Integral')
    if (indisp) {
      const turnoAviso = indisp.turno === 'Integral' ? 'o DIA TODO' : `no turno da ${indisp.turno}`
      if (!await confirm({
        title: '⚠️ Membro indisponível',
        message: `${usuario.nome} marcou indisponibilidade para ${turnoAviso} neste dia. Escalar mesmo assim?`,
        danger: true, labelOk: 'Escalar mesmo assim', labelCancel: 'Cancelar',
      })) return
    }

    // ✅ Verifica CONFLITO: já escalado em outro departamento no mesmo dia/turno
    const { data: conflitos } = await supabase
      .from('schedule_roles')
      .select('id, funcao, schedules!inner(data, turno, departamentos(nome))')
      .eq('user_id', usuario.id)
      .eq('schedules.data', data)

    const conflito = conflitos?.find(c =>
      (c.schedules.turno === turno || c.schedules.turno === 'Integral') &&
      c.schedules.departamentos?.nome !== 'Ministros'
    )
    if (conflito) {
      const ok = await confirm({
        title: '⚠️ Conflito de escala',
        message: `${usuario.nome} já está na escala de "${conflito.schedules.departamentos?.nome}" (${conflito.funcao}) neste mesmo dia e turno. Escalar mesmo assim?`,
        danger: true, labelOk: 'Escalar mesmo assim', labelCancel: 'Cancelar',
      })
      if (!ok) return
    }

    await inserirRole({ data, turno, funcao, userId: usuario.id, nome: usuario.nome })
  }

  // Escala ministro de FORA (visitante) — só nome
  async function adicionarVisitante() {
    if (!modalAberto || !nomeVisitante.trim()) return
    const { data, turno, funcao } = modalAberto
    await inserirRole({ data, turno, funcao, userId: null, nomeExterno: nomeVisitante.trim() })
  }

  async function inserirRole({ data, turno, funcao, userId, nome, nomeExterno }) {
    if (adicionando) return  // evita duplo-clique escalando 2x
    setAdicionando(true)
    const escalaId = await garantirEscala(data, turno)
    if (!escalaId) { setAdicionando(false); return }

    const payload = { schedule_id: escalaId, funcao, status_confirmacao: 'Confirmado' }
    if (userId) payload.user_id = userId
    if (nomeExterno) payload.nome_externo = nomeExterno

    const { data: novoRole, error } = await supabase
      .from('schedule_roles')
      .insert([payload])
      .select('id, funcao, user_id, nome_externo, users_profile(nome)')
      .single()

    if (!error && novoRole) {
      setCultos(prev => prev.map(c => {
        if (c.data !== data || c.turno !== turno) return c
        const escala = c.escala || { id: escalaId, data, turno, schedule_roles: [] }
        return { ...c, escala: { ...escala, id: escalaId, schedule_roles: [...(escala.schedule_roles || []), novoRole] } }
      }))
      const nomeExibe = nome || nomeExterno
      toast.success(`${nomeExibe.split(' ')[0]} está na escala como ${funcao}!`)
      if (userId) {
        const dataCurta = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        enviarNotificacao({
          userId, departamentoId,
          titulo: '🙏 Você está na escala de ministros',
          mensagem: `Você está na escala como ${funcao} em ${dataCurta} (${modalAberto.tipo}).`,
          tipo: 'escala', link: '/escalas',
        })
      }
      setModalAberto(null); setBusca(''); setNomeVisitante('')
      // Culto extra: recarrega para refletir nos cultosExtras
      if (turno === 'Extra') carregarDados()
    } else (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
    setAdicionando(false)  // reseta em ambos os casos (sucesso ou erro)
  }

  async function removerPessoa(data, turno, roleId, nome) {
    const ok = await confirm({ title: 'Remover dos ministros?', message: `Remover ${nome} desta escala?`, danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })
    if (!ok) return
    const { error } = await supabase.from('schedule_roles').delete().eq('id', roleId)
    if (!error) {
      if (turno === 'Extra') {
        carregarDados()
      } else {
        setCultos(prev => prev.map(c => {
          if (c.data !== data || c.turno !== turno) return c
          return { ...c, escala: { ...c.escala, schedule_roles: c.escala.schedule_roles.filter(r => r.id !== roleId) } }
        }))
      }
      toast.success('Pessoa removida da escala.')
    }
  }

  function pessoasNaFuncao(escala, funcao) {
    // Filtra vagas realmente preenchidas (ignora as vagas vazias usadas como placeholder do culto extra)
    return escala?.schedule_roles?.filter(r => r.funcao === funcao && (r.user_id || r.nome_externo)) || []
  }

  const nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const mesAnterior = () => { if (mesAtual === 0) { setMesAtual(11); setAnoAtual(a => a-1) } else setMesAtual(m => m-1) }
  const proximoMes  = () => { if (mesAtual === 11) { setMesAtual(0); setAnoAtual(a => a+1) } else setMesAtual(m => m+1) }

  const usuariosFiltrados = todosUsuarios.filter(u => u.nome?.toLowerCase().includes(busca.toLowerCase()))

  function formatarData(dataStr) {
    return new Date(dataStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Escala de ministros"
        subtitulo="Ministros · Montagem manual por culto"
        onVoltar={() => navigate(-1)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept('Ministros').chip}`}>
          <IconeDept nome="Ministros" className="w-5 h-5" />
        </span>}
      />

      <div className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">

        {/* Navegação de mês */}
        <div className="bg-surface p-4 rounded-2xl shadow-sm border border-line flex items-center justify-between">
          <button onClick={mesAnterior} aria-label="Mês anterior" className="p-2 hover:bg-surface-2 rounded-lg transition active:scale-[0.97]"><ChevronLeft className="w-5 h-5 text-ink-2" /></button>
          <span className="text-sm font-bold text-ink capitalize">{nomesMeses[mesAtual]} {anoAtual}</span>
          <button onClick={proximoMes} aria-label="Próximo mês" className="p-2 hover:bg-surface-2 rounded-lg transition active:scale-[0.97]"><ChevronRight className="w-5 h-5 text-ink-2" /></button>
        </div>

        {ehLider && (
          <button
            onClick={() => { setModalExtra(true); setExtraData(''); setExtraNome(''); setExtraFuncoes([]) }}
            className="w-full bg-surface border-2 border-dashed border-brand/30 text-brand font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-brand/10 transition"
          >
            <CalendarPlus className="w-5 h-5" /> Criar Culto Extra
          </button>
        )}

        {!ehLider && (
          <div className="bg-danger-soft border border-danger/30 rounded-xl px-4 py-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-danger flex-shrink-0" />
            <p className="text-xs text-danger font-medium">Apenas líderes montam a escala. Você pode visualizar.</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="bg-surface rounded-2xl border border-line h-40 animate-pulse" />)}
          </div>
        ) : cultos.length === 0 ? (
          <div className="bg-surface p-8 rounded-2xl border border-line text-center text-muted">
            <HandHeart className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhum culto neste mês.</p>
          </div>
        ) : (
          <>
          {/* ── CULTOS EXTRAS deste mês ── */}
          {cultosExtras.filter(ex => {
            const [ano, mes] = ex.data.split('-')
            return Number(ano) === anoAtual && Number(mes) === mesAtual + 1
          }).map(extra => (
            <div key={'extra-' + extra.data} className="bg-surface rounded-2xl shadow-sm border-2 border-brand/30 overflow-hidden">
              <div className="bg-topo px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-white" />
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">{extra.titulo}</p>
                    <p className="text-[10px] text-white/80 leading-tight">Culto Extra · {formatarData(extra.data)}</p>
                  </div>
                </div>
                {ehLider && (
                  <button onClick={() => removerCultoExtra(extra.escala.id, extra.titulo)} className="text-white/80 hover:text-white transition p-1" aria-label="Remover culto extra">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="p-3 space-y-2">
                {extra.funcoes.map(funcao => {
                  const pessoas = pessoasNaFuncao(extra.escala, funcao)
                  return (
                    <div key={funcao} className="rounded-xl bg-surface-2 border border-line p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-bold text-brand uppercase tracking-wider">{funcao}</p>
                        {ehLider && (
                          <button onClick={() => { setModalAberto({ data: extra.data, turno: 'Extra', tipo: extra.titulo, funcao }); setBusca(''); setNomeVisitante('') }}
                            className="flex items-center gap-1 text-[11px] font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-lg hover:bg-brand/10 transition">
                            <UserPlus className="w-3 h-3" /> Escalar
                          </button>
                        )}
                      </div>
                      {pessoas.length === 0 ? (
                        <p className="text-sm text-muted italic">Vaga em aberto</p>
                      ) : (
                        <div className="space-y-1.5">
                          {pessoas.map(p => (
                            <div key={p.id} className="flex items-center gap-2">
                              {p.nome_externo
                                ? <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><UserCog className="w-3.5 h-3.5 text-brand" /> {p.nome_externo} <span className="text-[9px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full font-bold">VISITANTE</span></span>
                                : <span className="text-sm font-semibold text-ink">{p.users_profile?.nome}</span>}
                              {ehLider && (
                                <button onClick={() => removerPessoa(extra.data, 'Extra', p.id, p.nome_externo || p.users_profile?.nome)}
                                  className="ml-auto text-muted hover:text-danger transition">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {cultos.map(culto => {
            const funcoes = FUNCOES_POR_DIA[culto.tipo] || []
            return (
              <div key={`${culto.data}_${culto.turno}`} className="bg-surface rounded-2xl shadow-sm border border-danger/30 overflow-hidden">
                <div className="bg-danger-soft px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HandHeart className="w-4 h-4 text-danger" />
                    <p className="text-sm font-bold text-danger">{culto.tipo}</p>
                  </div>
                  <span className="bg-surface/70 text-danger text-[10px] px-2.5 py-1 rounded-full font-bold">{formatarData(culto.data)}</span>
                </div>

                <div className="p-3 space-y-2">
                  {funcoes.map(funcao => {
                    const pessoas = pessoasNaFuncao(culto.escala, funcao)
                    return (
                      <div key={funcao} className="rounded-xl bg-surface-2 border border-line p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold text-danger uppercase tracking-wider">{funcao}</p>
                          {ehLider && (
                            <button onClick={() => { setModalAberto({ data: culto.data, turno: culto.turno, tipo: culto.tipo, funcao }); setBusca(''); setNomeVisitante('') }}
                              className="flex items-center gap-1 text-[11px] font-bold text-danger bg-danger-soft px-2.5 py-1 rounded-lg hover:bg-danger-soft transition">
                              <UserPlus className="w-3 h-3" /> Escalar
                            </button>
                          )}
                        </div>
                        {pessoas.length === 0 ? (
                          <p className="text-sm text-muted italic">Vaga em aberto</p>
                        ) : (
                          <div className="space-y-1.5">
                            {pessoas.map(p => (
                              <div key={p.id} className="flex items-center gap-2">
                                {p.nome_externo
                                  ? <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><UserCog className="w-3.5 h-3.5 text-danger" /> {p.nome_externo} <span className="text-[9px] bg-danger-soft text-danger px-1.5 py-0.5 rounded-full font-bold">VISITANTE</span></span>
                                  : <span className="text-sm font-semibold text-ink">{p.users_profile?.nome}</span>}
                                {ehLider && (
                                  <button onClick={() => removerPessoa(culto.data, culto.turno, p.id, p.nome_externo || p.users_profile?.nome)}
                                    className="ml-auto text-muted hover:text-danger transition">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          </>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[8vh] overflow-hidden">
          <button type="button" tabIndex={-1} aria-label="Fechar" className="absolute inset-0 bg-black/40 cursor-default" onClick={() => setModalAberto(null)} />
          <div role="dialog" aria-modal="true" className="relative bg-surface w-full max-w-md rounded-3xl flex flex-col" style={{ maxHeight: '70dvh' }}>
            <div className="p-5 border-b border-line">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-ink">Escalar {modalAberto.funcao}</h3>
                  <p className="text-xs text-muted">{modalAberto.tipo} · {formatarData(modalAberto.data)}</p>
                </div>
                <button type="button" onClick={() => setModalAberto(null)} aria-label="Fechar" className="p-2 hover:bg-surface-2 rounded-lg"><X className="w-5 h-5 text-muted" aria-hidden="true" /></button>
              </div>

              {/* Ministro de fora */}
              <div className="bg-danger-soft border border-danger/30 rounded-xl p-3 mb-3">
                <p className="text-[10px] font-bold text-danger uppercase tracking-wider mb-1.5">Ministro de fora (visitante)</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nome do visitante" value={nomeVisitante} onChange={e => setNomeVisitante(e.target.value)}
                    className="flex-1 px-3 py-2 bg-surface border border-danger/30 rounded-lg text-sm outline-none focus:ring-2 focus:ring-danger" />
                  <button onClick={adicionarVisitante} disabled={!nomeVisitante.trim()}
                    className="bg-danger text-on-danger text-xs font-bold px-4 rounded-lg hover:bg-danger transition active:scale-[0.97] disabled:opacity-40">
                    Add
                  </button>
                </div>
              </div>

              {/* Busca cadastrados */}
              <div className="relative">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Ou busque um cadastrado..." value={busca} onChange={e => setBusca(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-2 border border-line rounded-xl text-sm outline-none focus:ring-2 focus:ring-danger" />
              </div>
            </div>

            <div className="overflow-y-auto p-3 space-y-1" style={{ minHeight: '120px', WebkitOverflowScrolling: 'touch' }}>
              {usuariosFiltrados.length === 0 ? (
                <p className="text-center text-muted text-sm py-8">Ninguém encontrado.</p>
              ) : usuariosFiltrados.map(u => (
                <button key={u.id} onClick={() => adicionarPessoa(u)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-danger-soft transition text-left">
                  <div className="w-9 h-9 rounded-full bg-surface-2 text-ink-2 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {u.nome?.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-ink">{u.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Culto Extra (com seleção de funções) */}
      {modalExtra && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[7vh] overflow-hidden">
          <button type="button" tabIndex={-1} aria-label="Fechar" className="absolute inset-0 bg-black/40 cursor-default" onClick={() => setModalExtra(false)} />
          <div role="dialog" aria-modal="true" className="relative bg-surface w-full max-w-md rounded-3xl flex flex-col" style={{ maxHeight: '82dvh' }}>
            <div className="p-5 border-b border-line">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                    <Star className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-ink">Novo Culto Extra</h3>
                </div>
                <button onClick={() => setModalExtra(false)} className="p-2 hover:bg-surface-2 rounded-lg"><X className="w-5 h-5 text-muted" /></button>
              </div>
            </div>

            <div className="overflow-y-auto p-5" style={{ WebkitOverflowScrolling: 'touch' }}>
              <label className="block text-sm font-bold text-ink mb-2">Nome do culto</label>
              <input
                type="text"
                value={extraNome}
                onChange={e => setExtraNome(e.target.value)}
                placeholder="Ex: Vigília, Congresso, Santa Ceia..."
                className="w-full bg-surface-2 border border-line rounded-xl py-3 px-4 mb-4 text-sm outline-none focus:ring-2 focus:ring-brand"
              />

              <label className="block text-sm font-bold text-ink mb-2">Data do culto</label>
              <input
                type="date"
                value={extraData}
                onChange={e => setExtraData(e.target.value)}
                className="w-full bg-surface-2 border border-line rounded-xl py-3 px-4 mb-4 text-sm outline-none focus:ring-2 focus:ring-brand"
              />

              <label className="block text-sm font-bold text-ink mb-2">Funções deste culto</label>
              <div className="space-y-2 mb-2">
                {FUNCOES_DISPONIVEIS.map(f => {
                  const marcada = extraFuncoes.includes(f)
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleExtraFuncao(f)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${marcada ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:border-line'}`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${marcada ? 'bg-brand' : 'bg-surface border-2 border-line'}`}>
                        {marcada && <Check className="w-3.5 h-3.5 text-on-brand" aria-hidden="true" />}
                      </div>
                      <span className={`text-sm font-bold ${marcada ? 'text-brand' : 'text-ink-2'}`}>{f}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="p-5 border-t border-line flex gap-2">
              <button onClick={() => setModalExtra(false)} className="flex-1 bg-surface-2 text-ink-2 font-bold rounded-xl py-3 hover:bg-line transition">
                Cancelar
              </button>
              <button onClick={criarCultoExtra} className="flex-1 bg-brand text-on-brand font-bold rounded-xl py-3 hover:bg-brand transition active:scale-[0.97] flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}