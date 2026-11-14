// src/pages/Unavailability.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { getDeptTheme } from '../utils/departmentThemes'
import { enviarNotificacaoEmMassa } from '../utils/notificacoes'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { ArrowLeft, Lock, CalendarX, ChevronLeft, ChevronRight, Save, AlertTriangle, CheckCircle2, Trash2, Clock, Info } from 'lucide-react'
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
  const [departamentoCor, setDepartamentoCor] = useState(null)

  const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  // Tema dinâmico (suporta departamentos personalizados)
  const theme = getDeptTheme(departamentoNome, departamentoCor)
  const pers = theme.personalizado
  const st = theme.styles || {}

  useEffect(() => {
    if (!departamentoId) {
      navigate('/hub')
      return
    }
    // Busca a cor do departamento (para temas personalizados)
    supabase.from('departamentos').select('cor').eq('id', departamentoId).single()
      .then(({ data }) => { if (data) setDepartamentoCor(data.cor) })
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
    if(!await confirm({ title: 'Deseja remover esta indisponibilidade?', labelOk: 'Confirmar', labelCancel: 'Cancelar' })) return
    await supabase.from('indisponibilidades').delete().eq('id', id)
    carregarDados()
  }

  async function apagarTodasIndisponibilidades() {
    if(!await confirm({ title: '🚨 Tem a certeza que deseja APAGAR TODAS as suas au', labelOk: 'Confirmar', labelCancel: 'Cancelar' })) return
    setLoading(true)
    
    const { error } = await supabase
      .from('indisponibilidades')
      .delete()
      .eq('user_id', meuId)
      .eq('departamento_id', departamentoId)

    if (error) {
      setMensagem('❌ Erro ao apagar todas as indisponibilidades.')
    } else {
      setMensagem('🧹 Todas as ausências foram limpas com sucesso!')
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* CABEÇALHO */}
      <PageHeader
        title="Dias Off"
        subtitle="Comunique as suas ausências"
        icon={<CalendarX className="w-5 h-5" />}
        color={pers ? theme.hexValue : theme.bgPrimary}
      />

      <div className="max-w-md mx-auto px-4 space-y-6">

        {mensagem && (
          <div className="p-3 bg-green-50 text-green-700 font-bold text-sm text-center rounded-xl border border-green-200 shadow-sm">
            {mensagem}
          </div>
        )}

        {indispBloqueada && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 bg-red-100 rounded-xl flex-shrink-0">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Indisponibilidades bloqueadas</p>
              <p className="text-xs text-red-600 mt-1 leading-relaxed">
                O líder bloqueou o registo de novas indisponibilidades para este período.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-bold text-gray-800 uppercase">Selecione as Datas</h3>
            <div className="flex items-center gap-2">
              <button onClick={mesAnterior} aria-label="Mês anterior" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft className="w-5 h-5" /></button>
              <span className={`text-xs font-bold uppercase min-w-[100px] text-center tracking-wider ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}}>{nomesMeses[mesAtual]} {anoAtual}</span>
              <button onClick={proximoMes} aria-label="Próximo mês" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="text-[10px] font-bold text-gray-400 uppercase">{d}</div>)}
          </div>
          
          <div className="grid grid-cols-7 gap-y-2 text-center">
            {espacosEmBranco.map((_, i) => <div key={`blank-${i}`} className="p-2"></div>)}
            {dias.map(dia => {
              const dataFormatada = formatarDataDB(anoAtual, mesAtual, dia)
              const isPassado = dataFormatada < hojeString
              const isSelecionado = datasSelecionadas.some(d => d.data === dataFormatada)
              const isEscalado = minhasEscalas.some(e => e.data === dataFormatada && e.publicada)
              const isTravadoTotal = dataTotalmenteTravada(dataFormatada)
              
              return (
                <div key={dia} className="flex justify-center">
                  <button 
                    disabled={isPassado || isTravadoTotal}
                    onClick={() => alternarData(dataFormatada)}
                    title={isTravadoTotal ? 'Você já está na escala o dia todo nesta data' : ''}
                    className={`w-10 h-10 flex flex-col items-center justify-center rounded-full text-sm font-bold transition-all relative
                      ${isPassado ? 'text-gray-300 cursor-not-allowed' : 
                        isTravadoTotal ? 'text-gray-300 cursor-not-allowed bg-gray-50' :
                        isSelecionado ? 'bg-red-500 text-white shadow-md scale-105' : 
                        'text-gray-700 hover:bg-gray-100'}
                    `}
                  >
                    {dia}
                    {isTravadoTotal && !isPassado && <span className="w-1.5 h-1.5 rounded-full mt-0.5 bg-gray-400"></span>}
                    {isEscalado && !isTravadoTotal && !isSelecionado && !isPassado && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${pers ? "" : theme.bgPrimary}`} style={pers ? st.bgPrimary : {}}></span>}
                  </button>
                </div>
              )
            })}
          </div>

          {datasSelecionadas.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-5 animate-in fade-in">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Detalhes da Ausência
                </h4>
                {!todosMotivosPreenchidos && (
                  <span className="text-[10px] text-red-500 font-bold flex items-center gap-1"><Info className="w-3 h-3"/> Motivos pendentes</span>
                )}
              </div>
              
              <div className="space-y-3 mb-5 max-h-[300px] overflow-y-auto pr-1">
                {datasSelecionadas.map(item => {
                  const isDomingo = new Date(item.data + 'T12:00:00').getDay() === 0
                  const isMotivoVazio = item.motivo.trim() === ''
                  
                  return (
                    <div key={item.data} className={`bg-red-50/30 p-3 rounded-xl border flex flex-col gap-3 transition-colors ${isMotivoVazio ? 'border-red-300' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-800">{formatarDataBR(item.data)}</span>
                        
                        {isDomingo ? (() => {
                          const turnosOcup = turnosEscalados(item.data)
                          const escaladoManha = turnosOcup.includes('Manhã') || turnosOcup.includes('Integral')
                          const escaladoNoite = turnosOcup.includes('Noite') || turnosOcup.includes('Integral')
                          return (
                          <select 
                            value={item.turno} 
                            onChange={(e) => alterarTurno(item.data, e.target.value)}
                            className="text-xs font-bold border border-red-200 rounded-lg py-1.5 px-2 outline-none bg-white text-red-700 cursor-pointer focus:ring-2 focus:ring-red-400 shadow-sm"
                          >
                            {/* "Dia Todo" só se não estiver escalada em nenhum turno */}
                            {!escaladoManha && !escaladoNoite && <option value="Integral">Dia Todo</option>}
                            {!escaladoManha && <option value="Manhã">Falta de Manhã</option>}
                            {!escaladoNoite && <option value="Noite">Falta à Noite</option>}
                          </select>
                          )
                        })() : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded-md shadow-sm border border-gray-200">
                            Dia Todo
                          </span>
                        )}
                      </div>
                      
                      <input 
                        type="text" 
                        placeholder="Motivo (Obrigatório)..."
                        value={item.motivo} 
                        onChange={(e) => alterarMotivo(item.data, e.target.value)} 
                        className={`w-full rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-red-400 outline-none transition-all shadow-sm ${isMotivoVazio ? 'bg-red-50 border border-red-200 placeholder-red-300' : 'bg-white border border-gray-300'}`} 
                      />
                    </div>
                  )
                })}
              </div>

              <button 
                onClick={iniciarSalvamento} 
                disabled={salvando || !todosMotivosPreenchidos}
                className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.97] flex items-center justify-center gap-2 shadow-md mt-4 disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-black"
              >
                <Save className="w-5 h-5" />
                {salvando ? 'Processando...' : `Confirmar ${datasSelecionadas.length} Ausência(s)`}
              </button>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold text-gray-800 uppercase mb-3 flex items-center gap-2">
            Meus Dias Marcados
          </h2>
          {loading ? (
             <p className="text-sm text-gray-400 text-center py-4 font-bold animate-pulse">A carregar...</p>
          ) : minhasIndisponibilidades.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="Sem ausências registadas"
              subtitle="Quando registar uma indisponibilidade, ela aparecerá aqui."
              size="sm"
              variant="success"
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {minhasIndisponibilidades.map(ind => (
                  <div key={ind.id} className="flex justify-between items-start bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400"></div>
                    <div className="pl-2">
                      <p className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-1">
                        <CalendarX className="w-4 h-4 text-red-500" /> {formatarDataBR(ind.data)}
                        {ind.turno !== 'Integral' && (
                          <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Falta: {ind.turno}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 font-medium break-words">{ind.motivo}</p>
                    </div>
                    <button onClick={() => apagarIndisponibilidade(ind.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition" title="Remover e ficar disponível">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-200">
                <button 
                  onClick={apagarTodasIndisponibilidades} 
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3.5 rounded-xl transition active:scale-[0.97] flex items-center justify-center gap-2 shadow-sm"
                >
                  <Trash2 className="w-5 h-5" /> Apagar Todas as Ausências
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 🔴 MODAL: RADAR DE CONFLITOS */}
      {modalConflito.aberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-center text-gray-900 mb-2">Atenção! Conflito de Escala</h2>
            <p className="text-sm text-gray-600 text-center mb-4">
              Você já está na escala nestas datas:
            </p>
            <div className="flex flex-wrap gap-2 justify-center mb-5">
              {modalConflito.datas.map(d => (
                <span key={d} className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                  {formatarDataBR(d)}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-700 text-center font-medium mb-6 bg-yellow-50 p-3 rounded-xl border border-yellow-200">
              Deseja marcar sua ausência assim mesmo e solicitar substituição à liderança?
            </p>

            <div className="flex gap-2">
              <button 
                onClick={() => setModalConflito({ aberto: false, datas: [] })}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={gravarNoBanco}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition active:scale-[0.97]"
              >
                Sim, Solicitar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}