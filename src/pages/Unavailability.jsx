// src/pages/Unavailability.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { enviarNotificacaoEmMassa } from '../utils/notificacoes'
import { TopBar, Button, Card, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { Lock, CalendarX, ChevronLeft, ChevronRight, Save, AlertTriangle, CheckCircle2, Trash2, Clock, Info } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { hojeLocal } from '../utils/datas'

export default function Unavailability() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome

  const [meuId, setMeuId] = useState(null)
  const [minhasEscalas, setMinhasEscalas] = useState([])
  const [minhasIndisponibilidades, setMinhasIndisponibilidades] = useState([])
  
  const [datasSelecionadas, setDatasSelecionadas] = useState([])
  
  // Controle do Calendário
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(hoje.getMonth())
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear())
  
  // Controle de Interface e Conflitos
  const [loading,        setLoading]        = useState(true)
  const [indispBloqueada, setIndispBloqueada] = useState(false)
  const { toast, confirm } = useUI()
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [modalConflito, setModalConflito] = useState({ aberto: false, datas: [] })

  const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  useEffect(() => {
    if (!departamentoId) {
      navigate('/hub')
      return
    }
    carregarDados()
  }, [departamentoId])

  async function carregarDados() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setMeuId(user.id)
      
      const hojeFormatoDB = hojeLocal()
      
      // ✅ ATUALIZADO: Adicionado .eq('status', 'Publicada') para evitar spoilers de rascunhos!
      // Busca escalas em TODOS os departamentos (não só o atual) com o turno,
      // para travar datas onde a pessoa já vai servir no mesmo turno.
      // Inclui rascunhos também — para travar a data — MAS sem revelar detalhes
      // (a pessoa só vê que a data está travada, não qual escala/departamento).
      const { data: escalas } = await supabase
        .from('schedules')
        .select(`id, data, turno, status, schedule_roles!inner(user_id)`)
        .eq('schedule_roles.user_id', user.id)
        .gte('data', hojeFormatoDB) 
      
      // Guarda data + turno de cada escala (para travar o mesmo turno)
      if (escalas) setMinhasEscalas(escalas.map(e => ({ data: e.data, turno: e.turno, publicada: e.status === 'Publicada' })))

      // Verifica se o líder bloqueou as indisponibilidades
    const { data: deptConfig, error: deptErr } = await supabase
      .from('departamentos')
      .select('indisponibilidades_bloqueadas')
      .eq('id', departamentoId)
      .single()
    if (deptErr) {
      console.warn('⚠️ Coluna indisponibilidades_bloqueadas não existe ainda. Execute: ALTER TABLE departamentos ADD COLUMN IF NOT EXISTS indisponibilidades_bloqueadas boolean DEFAULT false;')
    }
    if (deptConfig) setIndispBloqueada(deptConfig.indisponibilidades_bloqueadas ?? false)

    const { data: indisponibilidades } = await supabase
        .from('indisponibilidades')
        .select('*')
        .eq('user_id', user.id)
        .eq('departamento_id', departamentoId)
        .gte('data', hojeFormatoDB)
        .order('data', { ascending: true })

      if (indisponibilidades) setMinhasIndisponibilidades(indisponibilidades)
    }
    setLoading(false)
  }

  const formatarDataDB = (ano, mes, dia) => `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  const formatarDataBR = (dataString) => dataString.split('-').reverse().join('/')

  // Retorna os turnos em que a pessoa JÁ está escalada nesta data
  function turnosEscalados(dataDbFormat) {
    return minhasEscalas.filter(e => e.data === dataDbFormat).map(e => e.turno)
  }

  // A data está totalmente travada? (escalada em turno Integral, ou em todos os turnos)
  function dataTotalmenteTravada(dataDbFormat) {
    const turnos = turnosEscalados(dataDbFormat)
    // Se está escalada como Integral, trava o dia todo
    return turnos.includes('Integral')
  }

  function alternarData(dataDbFormat) {
    // Bloqueia se a pessoa já está escalada o dia todo (Integral) nessa data
    if (dataTotalmenteTravada(dataDbFormat)) {
      toast.warning('Você já está na escala o dia todo nesta data. Não é possível marcar indisponibilidade.')
      return
    }
    if (datasSelecionadas.some(d => d.data === dataDbFormat)) {
      setDatasSelecionadas(datasSelecionadas.filter(d => d.data !== dataDbFormat))
    } else {
      setDatasSelecionadas([...datasSelecionadas, { data: dataDbFormat, turno: 'Integral', motivo: '' }])
    }
  }

  function alterarTurno(dataDbFormat, novoTurno) {
    setDatasSelecionadas(datasSelecionadas.map(d => 
      d.data === dataDbFormat ? { ...d, turno: novoTurno } : d
    ))
  }

  function alterarMotivo(dataDbFormat, novoMotivo) {
    setDatasSelecionadas(datasSelecionadas.map(d => 
      d.data === dataDbFormat ? { ...d, motivo: novoMotivo } : d
    ))
  }

  const todosMotivosPreenchidos = datasSelecionadas.every(d => d.motivo.trim() !== '')

  function iniciarSalvamento() {
    if (datasSelecionadas.length === 0) return
    if (!todosMotivosPreenchidos) return 

    const datasApenas = datasSelecionadas.map(d => d.data)
    // Bloqueia se alguma data+turno selecionada conflita com uma escala no MESMO turno
    const conflitoTurno = datasSelecionadas.find(sel => {
      const turnosOcup = turnosEscalados(sel.data)
      if (turnosOcup.includes('Integral')) return true
      if (sel.turno === 'Integral' && turnosOcup.length > 0) return true
      return turnosOcup.includes(sel.turno)
    })
    if (conflitoTurno) {
      toast.error('Você já está na escala em ' + formatarDataBR(conflitoTurno.data) + ' neste turno. Remova essa data para continuar.')
      return
    }

    const conflitos = datasApenas.filter(data => minhasEscalas.some(e => e.data === data))

    if (conflitos.length > 0) {
      setModalConflito({ aberto: true, datas: conflitos })
    } else {
      gravarNoBanco()
    }
  }

  async function gravarNoBanco() {
    if (indispBloqueada) { toast.warning('Indisponibilidades bloqueadas pelo líder.'); return }
    setModalConflito({ aberto: false, datas: [] })
    setSalvando(true)

    const payload = datasSelecionadas.map(item => ({
      user_id: meuId,
      departamento_id: departamentoId,
      data: item.data,
      turno: item.turno,
      motivo: item.motivo.trim() 
    }))

    const { error } = await supabase.from('indisponibilidades').insert(payload)

    if (error) {
      toast.error('Erro ao registrar datas.')
    } else {
      // ✅ Notificar líderes do departamento
      const { data: { user } } = await supabase.auth.getUser()
      const { data: lideres } = await supabase
        .from('membros_departamentos')
        .select('user_id')
        .eq('departamento_id', departamentoId)
        .in('role', ['líder', 'admin'])

      if (lideres?.length > 0) {
        const liderIds = lideres.map(l => l.user_id).filter(id => id !== user?.id)
        if (liderIds.length > 0) {
          const { data: perfil } = await supabase
            .from('users_profile').select('nome').eq('id', user.id).single()
          const primeiroNome = perfil?.nome?.split(' ')[0] || 'Um membro'
          const qtd = datasSelecionadas.length
          await enviarNotificacaoEmMassa({
            userIds:       liderIds,
            departamentoId,
            titulo:        '⚠️ Nova indisponibilidade',
            mensagem:      `${primeiroNome} registrou ${qtd} data${qtd > 1 ? 's' : ''} de indisponibilidade em ${departamentoNome}. Confira as escalas.`,
            tipo:          'aviso',
            link:          `/equipe`,
          })
        }
      }
      toast.success('Indisponibilidades registradas! Líderes notificados.')
      setDatasSelecionadas([])
      carregarDados()
    }
    setSalvando(false)
  }

  async function apagarIndisponibilidade(id) {
    if(!await confirm({ title: 'Remover esta ausência?', labelOk: 'Remover', labelCancel: 'Cancelar' })) return
    await supabase.from('indisponibilidades').delete().eq('id', id)
    carregarDados()
  }

  async function apagarTodasIndisponibilidades() {
    if(!await confirm({ title: 'Apagar todas as suas ausências?', message: 'Você volta a ficar disponível em todas as datas deste departamento.', labelOk: 'Apagar tudo', labelCancel: 'Cancelar' })) return
    setLoading(true)
    
    const { error } = await supabase
      .from('indisponibilidades')
      .delete()
      .eq('user_id', meuId)
      .eq('departamento_id', departamentoId)

    if (error) {
      setMensagem('Erro ao apagar as ausências.')
    } else {
      setMensagem('Ausências apagadas.')
      carregarDados()
      setTimeout(() => setMensagem(''), 3000)
    }
    setLoading(false)
  }

  const mesAnterior = () => { if (mesAtual === 0) { setMesAtual(11); setAnoAtual(anoAtual - 1) } else { setMesAtual(mesAtual - 1) } }
  const proximoMes = () => { if (mesAtual === 11) { setMesAtual(0); setAnoAtual(anoAtual + 1) } else { setMesAtual(mesAtual + 1) } }

  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate()
  const primeiroDiaDoMes = new Date(anoAtual, mesAtual, 1).getDay()
  const espacosEmBranco = Array.from({ length: primeiroDiaDoMes }, (_, i) => i)
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1)
  const hojeString = formatarDataDB(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())

  const chip = classesDept(departamentoNome).chip

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Dias off"
        subtitulo={departamentoNome ? `${departamentoNome} · comunique suas ausências` : 'Comunique suas ausências'}
        onVoltar={() => navigate(-1)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${chip}`}>
          <IconeDept nome={departamentoNome} className="w-5 h-5" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-5">

        {mensagem && (
          <p role="status" className="p-3 bg-success-soft text-success font-semibold text-sm text-center rounded-ctl">
            {mensagem}
          </p>
        )}

        {indispBloqueada && (
          <div className="flex items-start gap-3 p-4 rounded-card bg-danger-soft">
            <Lock className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-danger">Dias off bloqueados</p>
              <p className="text-xs text-ink-2 mt-1">O líder bloqueou novas ausências para este período.</p>
            </div>
          </div>
        )}

        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-ink">Selecione as datas</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={mesAnterior} aria-label="Mês anterior"
                className="p-1.5 rounded-ctl text-ink-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <span className="text-xs font-bold min-w-[110px] text-center text-brand" aria-live="polite">{nomesMeses[mesAtual]} {anoAtual}</span>
              <button type="button" onClick={proximoMes} aria-label="Próximo mês"
                className="p-1.5 rounded-ctl text-ink-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2" aria-hidden="true">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="text-[10px] font-bold text-muted uppercase">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center">
            {espacosEmBranco.map((_, i) => <div key={`blank-${i}`} className="p-2"></div>)}
            {dias.map(dia => {
              const dataFormatada = formatarDataDB(anoAtual, mesAtual, dia)
              const isPassado = dataFormatada < hojeString
              const isHoje = dataFormatada === hojeString
              const isSelecionado = datasSelecionadas.some(d => d.data === dataFormatada)
              const isEscalado = minhasEscalas.some(e => e.data === dataFormatada && e.publicada)
              const isTravadoTotal = dataTotalmenteTravada(dataFormatada)

              return (
                <div key={dia} className="flex justify-center">
                  <button
                    type="button"
                    disabled={isPassado || isTravadoTotal}
                    onClick={() => alternarData(dataFormatada)}
                    aria-pressed={isSelecionado}
                    aria-label={`${dia} de ${nomesMeses[mesAtual]}${isTravadoTotal ? ', você já está na escala o dia todo' : isEscalado ? ', você está escalado' : ''}`}
                    title={isTravadoTotal ? 'Você já está na escala o dia todo nesta data' : undefined}
                    className={`w-10 h-10 flex flex-col items-center justify-center rounded-full text-sm font-bold transition
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                      ${isPassado ? 'text-muted/60 cursor-not-allowed' :
                        isTravadoTotal ? 'text-muted cursor-not-allowed bg-surface-2' :
                        isSelecionado ? 'bg-brand text-on-brand shadow-md' :
                        `text-ink hover:bg-surface-2 ${isHoje ? 'ring-2 ring-brand' : ''}`}`}
                  >
                    {dia}
                    {isTravadoTotal && !isPassado && <span className="w-1.5 h-1.5 rounded-full mt-0.5 bg-muted" aria-hidden="true"></span>}
                    {isEscalado && !isTravadoTotal && !isSelecionado && !isPassado && <span className="w-1.5 h-1.5 rounded-full mt-0.5 bg-accent" aria-hidden="true"></span>}
                  </button>
                </div>
              )
            })}
          </div>

          {datasSelecionadas.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-ink-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" aria-hidden="true" /> Detalhes da ausência
                </h3>
                {!todosMotivosPreenchidos && (
                  <span className="text-[11px] text-danger font-semibold flex items-center gap-1"><Info className="w-3 h-3" aria-hidden="true" /> Falta o motivo</span>
                )}
              </div>

              <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-1">
                {datasSelecionadas.map(item => {
                  const isDomingo = new Date(item.data + 'T12:00:00').getDay() === 0
                  const isMotivoVazio = item.motivo.trim() === ''

                  return (
                    <div key={item.data} className={`bg-surface-2 p-3 rounded-ctl border flex flex-col gap-3 ${isMotivoVazio ? 'border-danger/50' : 'border-line'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink">{formatarDataBR(item.data)}</span>

                        {isDomingo ? (() => {
                          const turnosOcup = turnosEscalados(item.data)
                          const escaladoManha = turnosOcup.includes('Manhã') || turnosOcup.includes('Integral')
                          const escaladoNoite = turnosOcup.includes('Noite') || turnosOcup.includes('Integral')
                          return (
                          <select
                            value={item.turno}
                            onChange={(e) => alterarTurno(item.data, e.target.value)}
                            aria-label={`Turno da ausência em ${formatarDataBR(item.data)}`}
                            className="text-xs font-semibold border border-line rounded-ctl h-9 px-2 bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
                          >
                            {/* "Dia todo" só se não estiver escalada em nenhum turno */}
                            {!escaladoManha && !escaladoNoite && <option value="Integral">Dia todo</option>}
                            {!escaladoManha && <option value="Manhã">Falta de manhã</option>}
                            {!escaladoNoite && <option value="Noite">Falta à noite</option>}
                          </select>
                          )
                        })() : (
                          <span className="text-[11px] font-semibold text-ink-2 bg-surface px-2 py-1 rounded-full border border-line">
                            Dia todo
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Motivo (obrigatório)"
                        aria-label={`Motivo da ausência em ${formatarDataBR(item.data)}`}
                        aria-invalid={isMotivoVazio || undefined}
                        value={item.motivo}
                        onChange={(e) => alterarMotivo(item.data, e.target.value)}
                        className={`w-full h-10 rounded-ctl px-3 text-sm bg-surface text-ink placeholder:text-muted border focus:outline-none focus:ring-2 focus:ring-brand/40 ${isMotivoVazio ? 'border-danger/50' : 'border-line'}`}
                      />
                    </div>
                  )
                })}
              </div>

              <Button full onClick={iniciarSalvamento} loading={salvando}
                disabled={!todosMotivosPreenchidos} icon={<Save className="w-4 h-4" aria-hidden="true" />}>
                {salvando ? 'Salvando...' : `Confirmar ${datasSelecionadas.length} ${datasSelecionadas.length > 1 ? 'ausências' : 'ausência'}`}
              </Button>
            </div>
          )}
        </Card>

        <section>
          <h2 className="text-sm font-bold text-ink mb-2">Meus dias marcados</h2>
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {[1, 2].map(i => <div key={i} className="h-16 bg-surface-2 rounded-card animate-pulse" />)}
            </div>
          ) : minhasIndisponibilidades.length === 0 ? (
            <Card>
              <EmptyState
                icon={<CheckCircle2 className="w-6 h-6" aria-hidden="true" />}
                titulo="Nenhuma ausência marcada"
                texto="Quando você marcar um dia off, ele aparece aqui."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              <Card padded={false} className="px-4">
                {minhasIndisponibilidades.map(ind => (
                  <div key={ind.id} className="flex justify-between items-start gap-3 py-3 border-b border-line last:border-b-0">
                    <div className="min-w-0">
                      <p className="font-bold text-ink text-sm flex items-center gap-2 mb-0.5">
                        <CalendarX className="w-4 h-4 text-danger" aria-hidden="true" /> {formatarDataBR(ind.data)}
                        {ind.turno !== 'Integral' && (
                          <span className="text-[10px] bg-danger-soft text-danger px-2 py-0.5 rounded-full font-semibold">
                            Falta: {ind.turno}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-2 break-words">{ind.motivo}</p>
                    </div>
                    <button type="button" onClick={() => apagarIndisponibilidade(ind.id)}
                      aria-label={`Remover ausência de ${formatarDataBR(ind.data)}`}
                      className="p-2 text-muted hover:text-danger hover:bg-danger-soft rounded-ctl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                      <Trash2 className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </Card>

              <Button variant="perigo" full onClick={apagarTodasIndisponibilidades} icon={<Trash2 className="w-4 h-4" aria-hidden="true" />}>
                Apagar todas as ausências
              </Button>
            </div>
          )}
        </section>

      </main>

      {/* MODAL: conflito com escala */}
      {modalConflito.aberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-conflito" className="bg-surface border border-line w-full max-w-sm rounded-card p-6 shadow-2xl">
            <div className="w-12 h-12 bg-danger-soft text-danger rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 id="titulo-conflito" className="text-lg font-bold text-center text-ink mb-2">Você já está na escala</h2>
            <p className="text-sm text-ink-2 text-center mb-3">Nestas datas:</p>
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {modalConflito.datas.map(d => (
                <span key={d} className="bg-danger-soft text-danger text-xs font-bold px-2.5 py-1 rounded-full">
                  {formatarDataBR(d)}
                </span>
              ))}
            </div>
            <p className="text-sm text-ink text-center mb-5 bg-warning-soft p-3 rounded-ctl">
              Marcar a ausência assim mesmo e pedir substituição à liderança?
            </p>
            <div className="flex gap-2">
              <Button variant="secundario" className="flex-1" onClick={() => setModalConflito({ aberto: false, datas: [] })}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={gravarNoBanco}>
                Sim, pedir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
