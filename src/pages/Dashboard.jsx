// src/pages/Dashboard.jsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom' 
import { supabase } from '../supabase'
import { LogOut, Settings, Lock, CalendarDays, Calendar, ChevronLeft, ChevronRight, Users, Music, BellRing, CalendarX, CalendarCheck, ArrowLeft, Baby, Send, BookOpen, ClipboardCheck, AlertCircle, CheckCircle2, UserCheck, BarChart3, RefreshCw, Headphones } from 'lucide-react'
import NoticeBoard from '../components/NoticeBoard'
import ScheduleBoard from '../components/ScheduleBoard'
import { DashboardSkeleton } from '../components/Skeletons'
import { usePullToRefresh, PullIndicator } from '../hooks/usePullToRefresh'
import { useUI } from '../context/UIContext'
import PageHeader from '../components/PageHeader'
import { getDeptTheme } from '../utils/departmentThemes'
import { enviarNotificacaoEmMassa } from '../utils/notificacoes'
import { hojeLocal, dataLocalISO } from '../utils/datas'

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  
  const departamentoId = params.id || location.state?.departamentoId
  
  const [departamentoNome, setDepartamentoNome] = useState(location.state?.departamentoNome || '')
  const [departamentoTipo, setDepartamentoTipo] = useState(location.state?.departamentoTipo || '')
  const [departamentoCor, setDepartamentoCor] = useState(null)
  const [roleNoDepartamento, setRoleNoDepartamento] = useState(location.state?.userRole || '')

  const [nome, setNome] = useState('')
  const [proximoCulto, setProximoCulto] = useState(null)
  const [minhasEscalas, setMinhasEscalas] = useState([]) 
  const [indispBloqueada,  setIndispBloqueada]  = useState(false)
  const [toggling,         setToggling]         = useState(false)

  const dataHoje = new Date()
  const [mesAtual, setMesAtual] = useState(dataHoje.getMonth())
  const [anoAtual, setAnoAtual] = useState(dataHoje.getFullYear())
  const [loading, setLoading] = useState(true)
  const { toast, confirm } = useUI()
  // ✅ useCallback — referência estável passada ao usePullToRefresh
  const buscarDados = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const hojeFormatoDB = hojeLocal()

      // ✅ Perfil, escalas e vínculo (se necessário) rodam em paralelo
      const paralelasBase = [
        supabase.from('users_profile').select('nome').eq('id', user.id).single(),
        supabase.from('schedules')
          .select('id, data, turno, cor_roupa, status, schedule_roles!inner(funcao, user_id)')
          .eq('schedule_roles.user_id', user.id)
          .eq('departamento_id', departamentoId)
          .order('data', { ascending: true }),
      ]

      if (!departamentoNome || !roleNoDepartamento) {
        paralelasBase.push(
          supabase.from('membros_departamentos')
            .select('role, departamentos(nome, cor, icone, tipo)')
            .eq('user_id', user.id)
            .eq('departamento_id', departamentoId)
            .single()
        )
      }

      const [perfilRes, escalasRes, vinculoRes] = await Promise.all(paralelasBase)

      if (perfilRes.data) setNome(perfilRes.data.nome)

      let nomeDeptoAtual = departamentoNome
      if (vinculoRes?.data?.departamentos) {
        nomeDeptoAtual = vinculoRes.data.departamentos.nome
        setDepartamentoCor(vinculoRes.data.departamentos.cor)
        setDepartamentoNome(nomeDeptoAtual)
        setDepartamentoTipo(vinculoRes.data.departamentos.tipo || 'generico')
        setRoleNoDepartamento(vinculoRes.data.role)
      }

      if (escalasRes.data) {
        const escalasVisiveis = escalasRes.data.filter(e => e.status === 'Publicada')
        setMinhasEscalas(escalasVisiveis)
        const escalasFuturas = escalasVisiveis.filter(e => e.data >= hojeFormatoDB)
        if (escalasFuturas.length > 0) setProximoCulto(escalasFuturas[0])
      }

      // Busca estado do bloqueio de indisponibilidades
      const { data: deptConfig } = await supabase
        .from('departamentos')
        .select('indisponibilidades_bloqueadas, cor, icone, tipo')
        .eq('id', departamentoId)
        .single()
      if (deptConfig) {
        setIndispBloqueada(deptConfig.indisponibilidades_bloqueadas ?? false)
        setDepartamentoTipo(deptConfig.tipo || 'generico')
      }

      // ✅ Checklist só precisa do nome do departamento (já resolvido acima)
      const ehMidia = nomeDeptoAtual === 'Mídia' || nomeDeptoAtual === 'Midia'
      if (ehMidia) {
      }
    }
    setLoading(false)
  }, [departamentoId])

  const { isPulling, pullProgress, isRefreshing } = usePullToRefresh(buscarDados)


  // ✅ Tema centralizado via utils/departmentThemes.jsx
  const theme = getDeptTheme(departamentoNome, departamentoCor)
  const pers = theme.personalizado
  const st = theme.styles || {}

  function formatarDataComDia(dataString) {
    if (!dataString) return '';
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const data = new Date(dataString + 'T12:00:00');
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const nomeDia = dias[data.getDay()];
    return `${dia}/${mes} - ${nomeDia}`;
  }

  useEffect(() => {
    if (!departamentoId) {
      navigate('/hub')
      return
    }
    buscarDados()
  }, [departamentoId])



  async function publicarTodosRascunhos() {
    if (!await confirm({ title: 'Publicar todas as escalas?', message: 'Todas as escalas em rascunho deste departamento ficarão visíveis para a equipe.', labelOk: 'Publicar tudo', labelCancel: 'Cancelar' })) return

    const { error } = await supabase
      .from('schedules')
      .update({ status: 'Publicada' })
      .eq('departamento_id', departamentoId)
      .eq('status', 'Rascunho')

    if (!error) {
      toast.success('Todas as escalas foram publicadas!')

      // ✅ Notificar todos os membros das escalas recém publicadas
      const { data: escalasPublicadas } = await supabase
        .from('schedules')
        .select('id, schedule_roles(user_id)')
        .eq('departamento_id', departamentoId)
        .eq('status', 'Publicada')

      if (escalasPublicadas?.length > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        const userIdsUnicos = [...new Set(
          escalasPublicadas.flatMap(e => e.schedule_roles.map(r => r.user_id))
          .filter(id => id !== user?.id)
        )]

        if (userIdsUnicos.length > 0) {
          await enviarNotificacaoEmMassa({
            userIds:       userIdsUnicos,
            departamentoId,
            titulo:        `📅 Escalas publicadas — ${departamentoNome}`,
            mensagem:      'As escalas do mês foram publicadas. Acesse o app para ver os seus cultos.',
            tipo:          'escala',
            link:          `/dashboard/${departamentoId}`,
          })
        }
      }

      await buscarDados()
    } else {
      (() => { console.error('Erro ao publicar:', error); toast.error('Não foi possível publicar. Tente novamente.') })()
    }
  }


  
  const hojeString = dataLocalISO(dataHoje)
  const nomesMeses        = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const diasNoMes        = new Date(anoAtual, mesAtual + 1, 0).getDate()
  const primeiroDiaDoMes = new Date(anoAtual, mesAtual, 1).getDay()
  const espacosEmBranco  = Array.from({ length: primeiroDiaDoMes }, (_, i) => i)
  const dias             = Array.from({ length: diasNoMes }, (_, i) => i + 1)

  async function toggleBloqueioIndisp() {
    setToggling(true)
    const novoEstado = !indispBloqueada
    const { error } = await supabase
      .from('departamentos')
      .update({ indisponibilidades_bloqueadas: novoEstado })
      .eq('id', departamentoId)
    if (!error) {
      setIndispBloqueada(novoEstado)
      toast.success(novoEstado
        ? '🔒 Indisponibilidades bloqueadas.'
        : '🔓 Indisponibilidades liberadas.')
    } else {
      // Erro mais provável: coluna não existe no banco
      if (error.message?.includes('column') || error.code === '42703') {
        toast.error('Execute o SQL no Supabase antes de usar esta função. Veja o console.')
        console.error('Execute no Supabase SQL Editor: ALTER TABLE departamentos ADD COLUMN IF NOT EXISTS indisponibilidades_bloqueadas boolean DEFAULT false;')
      } else {
        (() => { console.error('Erro ao alterar bloqueio:', error); toast.error('Não foi possível alterar o bloqueio. Tente novamente.') })()
      }
    }
    setToggling(false)
  }

  const mesAnterior = () => { if (mesAtual === 0) { setMesAtual(11); setAnoAtual(a => a - 1) } else { setMesAtual(m => m - 1) } }
  const proximoMes  = () => { if (mesAtual === 11) { setMesAtual(0);  setAnoAtual(a => a + 1) } else { setMesAtual(m => m + 1) } }
  const isEscaladoHoje = minhasEscalas.some(e => e.data === hojeString)

  if (loading && !departamentoNome) return <DashboardSkeleton corHeader={pers ? '' : theme.bgPrimary} />

  const isLiderOuAdmin = roleNoDepartamento === 'admin' || roleNoDepartamento === 'líder'
  const mochila = { state: { departamentoId, departamentoNome, userRole: roleNoDepartamento } }

  return (
    <>
    <PullIndicator isPulling={isPulling} progress={pullProgress} isRefreshing={isRefreshing} />
    <div className="min-h-screen bg-gray-50 pb-20">
      
      <PageHeader
        title={departamentoNome}
        subtitle={roleNoDepartamento}
        color={pers ? theme.hexValue : theme.bgPrimary}
        onBack={() => navigate('/hub')}
        maxWidth="max-w-xl"
      />

      <div className="max-w-xl mx-auto px-4 space-y-8">
        
        {proximoCulto && (
          <div onClick={() => navigate(`/escala/${proximoCulto.id}`, mochila)} className={`${pers ? "" : "bg-gradient-to-br " + theme.gradient} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform duration-300`} style={pers ? st.gradientStyle : {}}>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-white/80 font-bold text-xs mb-3 uppercase tracking-wide">
                <CalendarCheck className="w-4 h-4 text-green-300" /> Prepare-se!
              </div>
              <h2 className="text-2xl font-bold mb-2">{formatarDataComDia(proximoCulto.data)}</h2>
              <p className="text-sm text-white/90 mb-6 font-medium">
                {proximoCulto.turno === 'Integral' ? 'Culto Principal' : `Culto da ${proximoCulto.turno}`}{proximoCulto.cor_roupa ? ` • Roupa: ${proximoCulto.cor_roupa}` : ''}
              </p>
              <div className="inline-block bg-white/20 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                Sua Função: {proximoCulto.schedule_roles?.[0]?.funcao || 'Escalado'}
              </div>
            </div>
            {/* ✅ ÍCONE EXCLUSIVO PARA DIACONIA */}
            {departamentoTipo === 'midia' ? <Users className={`w-40 h-40 absolute -right-8 -bottom-8 opacity-10 rotate-12`} /> : 
             departamentoTipo === 'infantil' ? <Baby className={`w-40 h-40 absolute -right-8 -bottom-8 opacity-10 rotate-12`} /> : 
             departamentoNome === 'Diaconia' ? <UserCheck className={`w-40 h-40 absolute -right-8 -bottom-8 opacity-10 rotate-12`} /> : 
             <Music className={`w-40 h-40 absolute -right-8 -bottom-8 opacity-10 rotate-12`} />}
          </div>
        )}

        {/* Estado vazio: quando a pessoa não tem próximo culto agendado */}
        {!proximoCulto && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <CalendarCheck className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-bold text-gray-700 mb-1">Nenhuma escala por enquanto</p>
            <p className="text-sm text-gray-400">Quando você for escalado, seu próximo culto aparece aqui.</p>
          </div>
        )}

        <NoticeBoard departamentoId={departamentoId} />




        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-5">
            <h3 className={`text-sm font-bold uppercase flex items-center gap-2 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}}>
              <Calendar className="w-5 h-5" /> A Minha Agenda
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={mesAnterior} aria-label="Mês anterior" className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-xs font-bold text-gray-800 uppercase min-w-[100px] text-center tracking-wider">{nomesMeses[mesAtual]} {anoAtual}</span>
              <button onClick={proximoMes} aria-label="Próximo mês" className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d,i) => <div key={i} className="text-xs font-bold text-gray-400 uppercase">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-3 text-center">
            {espacosEmBranco.map((_,i) => <div key={`b-${i}`} className="p-2" />)}
            {dias.map(dia => {
              const dataFormatada = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
              const escalasNesteDia = minhasEscalas.filter(e => e.data === dataFormatada)
              const isEscalado = escalasNesteDia.length > 0
              const isHoje = dataFormatada === hojeString
              return (
                <div key={dia} className="flex justify-center">
                  <div
                    onClick={() => isEscalado ? navigate(`/escala/${escalasNesteDia[0].id}`, mochila) : null}
                    className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold transition-all ${isEscalado ? `${pers ? "" : theme.bgPrimary} text-white shadow-md cursor-pointer hover:scale-110` : isHoje ? `border-2 ${pers ? "" : theme.borderLight + " " + theme.textPrimary + " " + theme.bgLight}` : 'text-gray-600 hover:bg-gray-100'}`} style={pers ? (isEscalado ? st.bgPrimary : isHoje ? { ...st.borderLight, ...st.textPrimary, ...st.bgLight } : {}) : {}}>
                    {dia}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className={`text-sm font-bold uppercase mb-4 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}}>Ações</h3>

          <div className="grid grid-cols-4 gap-3">
            <button onClick={() => navigate('/indisponibilidade', mochila)} className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-red-50 transition text-gray-700">
              <CalendarX className="w-6 h-6 mb-2 text-red-500" />
              <span className="text-xs font-bold text-center leading-tight">Dias Off</span>
            </button>

                {isLiderOuAdmin && (
                  <button
                    onClick={toggleBloqueioIndisp}
                    disabled={toggling}
                    title={indispBloqueada ? 'Desbloquear indisponibilidades' : 'Bloquear indisponibilidades do mês'}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl shadow-sm border transition active:scale-[0.97] ${indispBloqueada ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600' : 'bg-white border-gray-100 text-gray-700 hover:bg-amber-50'}`}>
                    <Lock className="w-6 h-6 mb-2" />
                    <span className="text-xs font-bold text-center leading-tight">{indispBloqueada ? 'Desbloq.' : 'Bloquear'}</span>
                  </button>
                )}

            {departamentoTipo === 'infantil' && (
              <>
                <button onClick={() => navigate('/licoes', mochila)} className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-pink-50 transition text-gray-700">
                  <BookOpen className="w-6 h-6 mb-2 text-pink-500" />
                  <span className="text-xs font-bold text-center leading-tight">Lições</span>
                </button>

                <button onClick={() => navigate('/checkin', mochila)} className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-pink-50 transition text-gray-700">
                  <UserCheck className="w-6 h-6 mb-2 text-pink-500" />
                  <span className="text-xs font-bold text-center leading-tight">Check-in</span>
                </button>
              </>
            )}

            {departamentoTipo === 'louvor' && (
              <button onClick={() => navigate('/louvores', mochila)} className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-indigo-50 transition text-gray-700">
                <Music className="w-6 h-6 mb-2 text-indigo-600" />
                <span className="text-xs font-bold text-center leading-tight">Músicas</span>
              </button>
            )}

            {isLiderOuAdmin && (
              <>
                {/* Gerar: Cantina/Ministros abrem tela própria (manual); os demais, geração automática */}
                <button onClick={() => {
                  const destinoGerar = departamentoTipo === 'cantina' ? '/cantina'
                    : departamentoTipo === 'ministros' ? '/ministros'
                    : '/gerar-escala'
                  navigate(destinoGerar, mochila)
                }} className={`flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 ${pers ? '' : theme.bgHover.replace('bg-', 'bg-opacity-10 bg-')} transition text-gray-700`}>
                  <CalendarDays className={`w-6 h-6 mb-2 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}} />
                  <span className="text-xs font-bold text-center leading-tight">Gerar</span>
                </button>

                {departamentoTipo === 'midia' && (
                  <button onClick={() => navigate(`/cabine/${departamentoId}`, mochila)} className="flex flex-col items-center justify-center bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-800 hover:bg-black transition text-gray-100">
                    <Headphones className="w-6 h-6 mb-2 text-purple-400" />
                    <span className="text-xs font-bold text-center leading-tight">Cabine</span>
                  </button>
                )}

                {departamentoTipo === 'midia' && (
                  <button onClick={() => navigate('/checklist-midia', mochila)} className="flex flex-col items-center justify-center bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-200 hover:bg-purple-100 transition text-purple-700">
                    <ClipboardCheck className="w-6 h-6 mb-2 text-purple-600" />
                    <span className="text-xs font-bold text-center leading-tight">Checklist</span>
                  </button>
                )}

                <button onClick={() => navigate('/equipe', mochila)} className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-green-50 transition text-gray-700">
                  <Users className="w-6 h-6 mb-2 text-green-600" />
                  <span className="text-xs font-bold text-center leading-tight">Equipe</span>
                </button>
                
                <button onClick={() => navigate('/frequencia', mochila)} className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-blue-50 transition text-gray-700">
                  <BarChart3 className="w-6 h-6 mb-2 text-blue-600" />
                  <span className="text-xs font-bold text-center leading-tight">Frequência</span>
                </button>

                <button onClick={() => navigate('/trocas', mochila)} className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-orange-50 transition text-gray-700">
                  <RefreshCw className="w-6 h-6 mb-2 text-orange-500" />
                  <span className="text-xs font-bold text-center leading-tight">Trocas</span>
                </button>
                
                <button onClick={() => navigate('/criar-aviso', mochila)} className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-yellow-50 transition text-gray-700">
                  <BellRing className="w-6 h-6 mb-2 text-yellow-500" />
                  <span className="text-xs font-bold text-center leading-tight">Aviso</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-sm font-bold uppercase flex items-center gap-2 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}}>
              <CalendarDays className="w-5 h-5" /> Escalas
            </h3>
            
            {isLiderOuAdmin && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/imprimir-escalas', { state: { departamentoId, departamentoNome, mesAtual, anoAtual } })} 
                  className="text-[10px] font-bold bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-black transition flex items-center gap-1.5 uppercase tracking-wider shadow-sm"
                  title="Gerar PDF deste mês"
                >
                  🖨️ PDF
                </button>
                
                <button 
                  onClick={publicarTodosRascunhos} 
                  className="text-[10px] font-bold bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 transition active:scale-[0.97] flex items-center gap-1.5 uppercase tracking-wider border border-green-200 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" /> Publicar Tudo
                </button>
              </div>
            )}
          </div>

          <ScheduleBoard departamentoId={departamentoId} userRole={roleNoDepartamento} departamentoNome={departamentoNome} departamentoCor={departamentoCor} />
        </div>

      </div>
    </div>
    </>
  )
}