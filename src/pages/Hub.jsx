// src/pages/Hub.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import { Settings, Music, Camera, Baby, LayoutGrid, CalendarCheck, CalendarDays, FileText, ArrowRight, Calendar, ChevronLeft, ChevronRight, XCircle, Shield, Printer, BarChart2, Megaphone, Users2, Cake, ClipboardCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { HubSkeleton } from '../components/Skeletons'
import { usePullToRefresh, PullIndicator } from '../hooks/usePullToRefresh'
import { getDeptTheme, getDeptIcones } from '../utils/departmentThemes'
import { dataLocalISO } from '../utils/datas'

export default function Hub() {
  
  const [meuId, setMeuId] = useState(null)
  const [nome, setNome] = useState('')
  const [meusDepartamentos, setMeusDepartamentos] = useState([])
  const [proximosCompromissos, setProximosCompromissos] = useState([])
  const [todasMinhasEscalas, setTodasMinhasEscalas] = useState([]) 
  const [isMasterUser, setIsMasterUser] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const dataHoje = new Date()
  const [mesAtual, setMesAtual] = useState(dataHoje.getMonth())
  const [anoAtual, setAnoAtual] = useState(dataHoje.getFullYear())
  const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const hojeString = dataLocalISO(dataHoje)

  const [modalMultiplasEscalas, setModalMultiplasEscalas] = useState(false)
  const [escalasParaEscolher, setEscalasParaEscolher]   = useState([])

  const [escalasProxMes,     setEscalasProxMes]            = useState({})
  const [isLider,            setIsLider]                   = useState(false)

  // ✅ Pull-to-refresh — puxar para baixo no topo da página atualiza os dados
  // ✅ useCallback — referência estável passada ao usePullToRefresh
  const buscarDados = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setMeuId(user.id)
      const { data: perfil } = await supabase.from('users_profile').select('nome, role, super_admin, igreja_id').eq('id', user.id).single()
      if (perfil) setNome(perfil.nome)

      const { data: depts } = await supabase
        .from('membros_departamentos')
        .select('role, departamentos ( id, nome, cor, icone, tipo )')
        .eq('user_id', user.id)

      const ehSuperAdmin = perfil?.super_admin === true
      // Role geral do perfil (para quem é admin/líder da igreja sem estar em departamento — ex: pastor, auxiliar)
      const roleGeral = perfil?.role
      const ehAdminGeral = roleGeral === 'admin'
      const ehLiderGeral = roleGeral === 'admin' || roleGeral === 'líder'
      const ehAdminAlgumLugar = (depts ? depts.some(d => d.role === 'admin') : false) || ehAdminGeral
      const ehLiderAlgumLugar = (depts ? depts.some(d => d.role === 'líder' || d.role === 'admin') : false) || ehLiderGeral
      const master = ehAdminAlgumLugar || ehSuperAdmin

      setIsMasterUser(master)
      setIsLider(ehLiderAlgumLugar || master)
      if (ehLiderAlgumLugar || master) buscarStatusProximoMes()

      // ✅ Verifica escalas do próximo mês para indicador de líderes
      if (ehLiderAlgumLugar || master) {
        const hoje = new Date()
        const proxMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
        const fimProxMes = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0)
        const inicio = dataLocalISO(proxMes)
        const fim    = dataLocalISO(fimProxMes)

        const { data: publicadas } = await supabase
          .from('schedules')
          .select('departamentos(nome)')
          .eq('status', 'Publicada')
          .gte('data', inicio)
          .lte('data', fim)

        if (publicadas) {
          const status = {}
          publicadas.forEach(e => { if (e.departamentos?.nome) status[e.departamentos.nome] = true })
          setEscalasProxMes(status)
        }
      }

      if (master) {
        const { data: todosDepts } = await supabase.from('departamentos').select('id, nome, cor, icone, tipo').eq('igreja_id', perfil?.igreja_id).order('nome')
        if (todosDepts) {
          const deptsMaster = todosDepts.map(d => ({ role: 'admin', departamentos: { id: d.id, nome: d.nome, cor: d.cor, icone: d.icone } }))
          setMeusDepartamentos(deptsMaster.filter(v => v.departamentos))
        }
      } else {
        let listaDepts = depts || []
        // Líderes/admins veem a Cantina mesmo sem vínculo (ninguém se inscreve nela).
        // Ministros virou normal: só quem tem vínculo vê (não é adicionado aqui).
        if (ehLiderAlgumLugar) {
          const jaTenho = new Set(listaDepts.map(d => d.departamentos?.id))
          const { data: especiais } = await supabase
            .from('departamentos')
            .select('id, nome, cor, icone, tipo')
            .eq('tipo', 'cantina')
            .eq('igreja_id', perfil?.igreja_id)
          if (especiais) {
            especiais.forEach(d => {
              if (!jaTenho.has(d.id)) {
                // Entra com o mesmo papel de liderança que a pessoa já tem
                listaDepts.push({ role: 'líder', departamentos: { id: d.id, nome: d.nome, cor: d.cor, icone: d.icone, tipo: d.tipo } })
              }
            })
          }
        }
        // Defesa: remove vínculos órfãos (departamento apagado mas o vínculo ficou).
        // Sem isso, uma pessoa com dado inconsistente trava a tela inteira.
        setMeusDepartamentos(listaDepts.filter(v => v.departamentos))
      }

      const { data: minhasEscalas } = await supabase
        .from('schedules')
        .select('id, data, turno, status, departamento_id, cor_roupa, departamentos(nome, tipo), schedule_roles!inner(funcao, user_id)')
        .eq('schedule_roles.user_id', user.id)
        .neq('status', 'Rascunho')
        .order('data', { ascending: true })

      if (minhasEscalas) {
        setTodasMinhasEscalas(minhasEscalas) 
        const escalasFuturas = minhasEscalas.filter(e => e.data >= hojeString).slice(0, 3)
        setProximosCompromissos(escalasFuturas)
      }
    }
    setLoading(false)
  }, [])

  const { isPulling, pullProgress, isRefreshing } = usePullToRefresh(buscarDados)

  const navigate = useNavigate()

  useEffect(() => {
    buscarDados()
  }, [buscarDados])

  function formatarDataComDia(dataString) {
    if (!dataString) return '';
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const data = new Date(dataString + 'T12:00:00');
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const nomeDia = dias[data.getDay()];
    return `${dia}/${mes} - ${nomeDia}`;
  }


  // ✅ Substituído pela função centralizada em utils/departmentThemes.jsx
  const getEstiloDepartamento = (nomeDept, cor = null, icone = null) => {
    const t = getDeptTheme(nomeDept, cor)
    const i = getDeptIcones(nomeDept, icone)
    return {
      icone: i.Grande, iconePequeno: i.Pequeno,
      cor: t.bgPrimary, dotCor: t.dotCor, hex: t.hex || t.hexValue,
      corTexto: t.textPrimary, bgLight: t.bgLight,
      borderHover: t.borderHover, shadowHover: t.shadowHover,
      // tema completo para acesso a styles inline (departamentos personalizados)
      tema: t,
    }
  }

  const mesAnterior = () => { if (mesAtual === 0) { setMesAtual(11); setAnoAtual(anoAtual - 1) } else { setMesAtual(mesAtual - 1) } }
  const proximoMes = () => { if (mesAtual === 11) { setMesAtual(0); setAnoAtual(anoAtual + 1) } else { setMesAtual(mesAtual + 1) } }

  // Todas as escalas (inclusive Cantina/Ministros) abrem a escala detalhada normal
  const destinoDaEscala = (escala) => {
    return `/escala/${escala.id}`
  }

  const handleDiaClick = (escalasNesteDia) => {
    if (escalasNesteDia.length === 1) {
      const esc = escalasNesteDia[0]
      navigate(destinoDaEscala(esc), { state: { departamentoId: esc.departamento_id, departamentoNome: esc.departamentos?.nome, departamentoTipo: esc.departamentos?.tipo, userRole: isMasterUser ? 'admin' : 'membro' } })
    } else if (escalasNesteDia.length > 1) {
      setEscalasParaEscolher(escalasNesteDia)
      setModalMultiplasEscalas(true)
    }
  }

  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate()
  const primeiroDiaDoMes = new Date(anoAtual, mesAtual, 1).getDay()
  const espacosEmBranco = Array.from({ length: primeiroDiaDoMes }, (_, i) => i)
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1)

  if (loading) return <HubSkeleton />

  // ── Dados da seção Gestão da Igreja ──────────────────────────────────────
  // ── Status de escalas do próximo mês (para o indicador) ──────────────────
  async function buscarStatusProximoMes() {
    const hoje = new Date()
    const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
    const fimProximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0)
    const inicioStr = dataLocalISO(proximoMes)
    const fimStr    = dataLocalISO(fimProximoMes)

    const { data: escalasProx } = await supabase
      .from('schedules')
      .select('departamentos(nome)')
      .eq('status', 'Publicada')
      .gte('data', inicioStr)
      .lte('data', fimStr)

    if (escalasProx) {
      const status = {}
      escalasProx.forEach(e => {
        const nome = e.departamentos?.nome
        if (nome) status[nome] = (status[nome] || 0) + 1
      })
      setEscalasProxMes(status)
    }
  }



  // Visível para líderes, admins e master admin
  const ehLiderOuAdmin = isMasterUser || meusDepartamentos.some(d => d.role === 'líder' || d.role === 'admin')

  const ORDEM_DEPTS = [
    { nome: 'Louvor',   cor: '#2563eb' },
    { nome: 'Infantil', cor: '#ec4899' },
    { nome: 'Diaconia', cor: '#111827' },
    { nome: 'Mídia',    cor: '#9333ea' },
  ]
  const nomeProxMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <>
    <PullIndicator isPulling={isPulling} progress={pullProgress} isRefreshing={isRefreshing} />
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      
      <div className="bg-gray-900 pt-10 pb-8 rounded-b-3xl shadow-md text-white">
        <div className="max-w-5xl mx-auto px-5">
          {/* Agora o cabeçalho fica limpo, pois os botões estão flutuando via GlobalUserMenu! */}
          <div>
            <p className="text-gray-400 text-sm font-medium">Olá, graça e paz!</p>
            <h1 className="text-3xl font-bold">{nome.split(' ')[0]}</h1>
            {isMasterUser && <span className="bg-white/10 text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase mt-2 inline-block border border-white/20">Master Admin</span>}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8 space-y-10">

        {/* --- CARDS PESSOAIS DE COMPROMISSOS --- */}
        {proximosCompromissos.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-800 uppercase mb-4 px-1 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-green-600" /> Minha Agenda Global
            </h2>
            <div className="flex overflow-x-auto gap-3 pb-3 snap-x">
              {proximosCompromissos.map((comp) => {
                const estilo = getEstiloDepartamento(comp.departamentos?.nome, comp.departamentos?.cor, comp.departamentos?.icone)
                const persA = estilo.tema?.personalizado
                const stA = estilo.tema?.styles || {}
                return (
                  <div key={comp.id} className={`${persA ? '' : estilo.cor} min-w-[210px] md:min-w-[230px] p-4 rounded-xl text-white shadow-md snap-center relative overflow-hidden flex-shrink-0 hover:-translate-y-1 transition-transform duration-300 cursor-pointer`} style={persA ? stA.bgPrimary : {}} onClick={() => navigate(destinoDaEscala(comp), { state: { departamentoId: comp.departamento_id, departamentoNome: comp.departamentos?.nome, departamentoTipo: comp.departamentos?.tipo, userRole: isMasterUser ? 'admin' : 'membro' } })}>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">{comp.departamentos?.nome}</span>
                        <span className="bg-white/20 text-[9px] px-2 py-0.5 rounded-full font-bold">{comp.turno}</span>
                      </div>
                      <h3 className="text-base font-bold mb-0.5">{formatarDataComDia(comp.data)}</h3>
                      <p className="text-xs opacity-90 font-medium truncate mb-3">{comp.schedule_roles?.[0]?.funcao || 'Escalado'}</p>
                      <button className="bg-white text-gray-900 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-100 transition active:scale-[0.97]">Ver Detalhes</button>
                    </div>
                    <div className={`absolute -right-5 -bottom-5 opacity-20 rotate-12 text-white scale-75`}>{estilo.icone}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* --- CALENDÁRIO PESSOAL COLORIDO --- */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-5">
            <h3 className={`text-sm font-bold text-gray-800 uppercase flex items-center gap-2`}><Calendar className="w-5 h-5 text-gray-400" /> Meu Calendário</h3>
            <div className="flex items-center gap-2">
              <button onClick={mesAnterior} aria-label="Mês anterior" className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-xs font-bold text-gray-800 uppercase min-w-[100px] text-center tracking-wider">{nomesMeses[mesAtual]} {anoAtual}</span>
              <button onClick={proximoMes} aria-label="Próximo mês" className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => <div key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-4 text-center">
            {espacosEmBranco.map((_, i) => <div key={`blank-${i}`} className="p-2"></div>)}
            {dias.map(dia => {
              const dataFormatada = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
              const escalasNesteDia = todasMinhasEscalas.filter(e => e.data === dataFormatada)
              const isHoje = dataFormatada === hojeString
              let bgColor = 'text-gray-600 hover:bg-gray-100'; let textColor = ''; let customStyle = {};
              
              if (escalasNesteDia.length === 1) {
                const estiloCores = getEstiloDepartamento(escalasNesteDia[0].departamentos?.nome, escalasNesteDia[0].departamentos?.cor, escalasNesteDia[0].departamentos?.icone)
                if (estiloCores.tema?.personalizado) {
                  bgColor = `shadow-md hover:scale-110 cursor-pointer`; textColor = 'text-white'; customStyle = { backgroundColor: estiloCores.hex }
                } else {
                  bgColor = `${estiloCores.dotCor} shadow-md hover:scale-110 cursor-pointer`; textColor = 'text-white'
                }
              } else if (escalasNesteDia.length > 1) {
                const cor1 = getEstiloDepartamento(escalasNesteDia[0].departamentos?.nome, escalasNesteDia[0].departamentos?.cor, escalasNesteDia[0].departamentos?.icone).hex; const cor2 = getEstiloDepartamento(escalasNesteDia[1].departamentos?.nome, escalasNesteDia[1].departamentos?.cor, escalasNesteDia[1].departamentos?.icone).hex
                bgColor = `shadow-md hover:scale-110 cursor-pointer`; textColor = 'text-white'; customStyle = { background: `linear-gradient(135deg, ${cor1} 50%, ${cor2} 50%)` }
              } else if (isHoje) { bgColor = 'border-2 border-gray-300 text-gray-800 bg-gray-50' }

              return (
                <div key={dia} className="flex justify-center relative group">
                  <div style={customStyle} onClick={() => handleDiaClick(escalasNesteDia)} className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold transition-all ${bgColor} ${textColor}`}>{dia}</div>
                </div>
              )
            })}
          </div>
        </div>



        {/* --- DEPARTAMENTOS --- */}
        <div>
          {/* ── Indicador de escalas do próximo mês — só aparece após 1º dept gerar ── */}
          {isLider && Object.keys(escalasProxMes).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-2">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600 flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                  Escalas {new Date(new Date().getFullYear(), new Date().getMonth()+1, 1).toLocaleString('pt-BR',{month:'long'})}
                </p>
                <p className="text-[10px] text-gray-400">próximo mês</p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-gray-100">
                {[
                  { nome: 'Louvor',   cor: '#2563eb' },
                  { nome: 'Infantil', cor: '#ec4899' },
                  { nome: 'Diaconia', cor: '#111827' },
                  { nome: 'Mídia',    cor: '#9333ea' },
                ].map(dept => {
                  const publicado = !!escalasProxMes[dept.nome]
                  return (
                    <div key={dept.nome} className="bg-white px-4 py-3 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dept.cor }} />
                      <p className="text-xs font-semibold text-gray-700 flex-1">{dept.nome}</p>
                      {publicado
                        ? <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ OK</span>
                        : <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Pendente</span>
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <h2 className="text-sm font-bold text-gray-800 uppercase mb-4 px-1">{isMasterUser ? "Departamentos da Igreja" : "Meus Departamentos"}</h2>
          {meusDepartamentos.length === 0 ? (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center"><p className="text-gray-500 text-sm">Nenhum departamento disponível.</p></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
              {meusDepartamentos
                .filter(vinculo => {
                  // Cantina e Ministros só aparecem na grade para líderes/admin
                  // (membros acessam pelo calendário/agenda do Hub)
                  // Só a Cantina fica restrita a líderes/admin (ninguém se inscreve nela).
                  // Ministros virou departamento normal: quem tem vínculo vê (membro ou líder).
                  const soLideranca = vinculo.departamentos?.tipo === 'cantina' || vinculo.departamentos?.nome === 'Cantina'
                  if (!soLideranca) return true
                  return isMasterUser || vinculo.role === 'líder' || vinculo.role === 'admin'
                })
                .map((vinculo) => {
                const estilo = getEstiloDepartamento(vinculo.departamentos?.nome, vinculo.departamentos?.cor, vinculo.departamentos?.icone)
                const pers = estilo.tema?.personalizado
                const st = estilo.tema?.styles || {}
                return (
                  <div key={vinculo.departamentos?.id} onClick={() => navigate('/dashboard', { state: { departamentoId: vinculo.departamentos?.id, departamentoNome: vinculo.departamentos?.nome, departamentoTipo: vinculo.departamentos?.tipo, userRole: vinculo.role } })} className={`bg-white p-4 md:p-7 rounded-2xl shadow-sm border-2 border-transparent ${pers ? '' : estilo.borderHover + ' ' + estilo.shadowHover} hover:shadow-lg active:scale-95 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center gap-2 md:gap-4 group`}>
                    <div className={`p-3 md:p-4 rounded-full ${pers ? '' : estilo.bgLight + ' ' + estilo.corTexto} group-hover:scale-110 transition-all duration-300`} style={pers ? { ...st.bgLight, ...st.textPrimary } : {}}>{estilo.icone}</div>
                    <div>
                      <h3 className="text-base md:text-xl font-bold text-gray-900 mb-1.5">{vinculo.departamentos?.nome}</h3>
                      <span className={`text-[10px] md:text-xs font-bold px-2.5 py-0.5 md:px-3 md:py-1 rounded-full uppercase tracking-wider ${pers ? '' : estilo.cor} text-white inline-block shadow-sm`} style={pers ? st.bgPrimary : {}}>{vinculo.role}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {isMasterUser && (
          <div className="border-t border-gray-200 pt-8 animate-in fade-in duration-500">
            <h2 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2 mb-4 px-1">
              <Settings className="w-4 h-4" /> Administração
            </h2>
            <div onClick={() => navigate('/gestao-igreja')}
              className="bg-gradient-to-br from-gray-900 to-gray-700 p-5 rounded-2xl shadow-md cursor-pointer hover:-translate-y-1 transition-transform duration-300 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 p-3 rounded-xl text-white border border-white/10">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Gestão da Igreja</p>
                  <p className="text-xs text-gray-300 mt-0.5">Membros, escalas, relatórios e comunicação</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
            </div>
          </div>
        )}
      </div>

      {/* ── Modal seleção de departamento ── */}
      {modalMultiplasEscalas && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-blue-500" /> Agenda do Dia</h2>
              </div>
              <button onClick={() => setModalMultiplasEscalas(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition"><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="space-y-3">
              {escalasParaEscolher.map((escala) => {
                const estilo = getEstiloDepartamento(escala.departamentos?.nome, escala.departamentos?.cor, escala.departamentos?.icone)
                const persM = estilo.tema?.personalizado
                const stM = estilo.tema?.styles || {}
                return (
                  <div key={escala.id} onClick={() => { setModalMultiplasEscalas(false); navigate(destinoDaEscala(escala), { state: { departamentoId: escala.departamento_id, departamentoNome: escala.departamentos?.nome, departamentoTipo: escala.departamentos?.tipo, userRole: isMasterUser ? 'admin' : 'membro' } }) }} className={`p-4 rounded-2xl border-2 border-transparent ${persM ? '' : estilo.borderHover} cursor-pointer hover:shadow-md transition bg-gray-50 flex items-center justify-between group`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full text-white shadow-sm ${persM ? '' : estilo.cor}`} style={persM ? stM.bgPrimary : {}}>{estilo.iconePequeno}</div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-base leading-tight">{escala.departamentos?.nome}</h3>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full inline-block ${persM ? '' : estilo.bgLight + ' ' + estilo.corTexto}`} style={persM ? { ...stM.bgLight, ...stM.textPrimary } : {}}>{escala.turno}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-gray-700 transition" />
                  </div>
                )
              })}
            </div>
            <button onClick={() => setModalMultiplasEscalas(false)} className="w-full mt-4 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition">Cancelar</button>
          </div>
        </div>
      )}

      {/* A Scrollbar Customizada que ficava aqui foi movida pro index.css globalmente, ou você pode deixar aqui se preferir. */}
      {/* ✅ Scrollbar movida para src/index.css */}
    </div>
    </>
  )
}