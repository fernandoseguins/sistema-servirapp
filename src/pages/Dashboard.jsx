// src/pages/Dashboard.jsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom' 
import { supabase } from '../supabase'
import { Lock, ChevronRight, Users, Music, BellRing, CalendarX, CalendarCheck, Send, BookOpen, ClipboardCheck, AlertCircle, UserCheck, BarChart3, RefreshCw, Headphones, Wand2, MoreHorizontal, Printer } from 'lucide-react'
import NoticeBoard from '../components/NoticeBoard'
import ScheduleBoard from '../components/ScheduleBoard'
import { usePullToRefresh, PullIndicator } from '../hooks/usePullToRefresh'
import { useUI } from '../context/UIContext'
import { TopBar, Button, Card, Pill, ListRow, Select, Sheet } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { dataComDia } from '../utils/escalas'
import { enviarNotificacaoEmMassa } from '../utils/notificacoes'
import { hojeLocal } from '../utils/datas'

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  
  const departamentoId = params.id || location.state?.departamentoId
  
  const [departamentoNome, setDepartamentoNome] = useState(location.state?.departamentoNome || '')
  const [departamentoTipo, setDepartamentoTipo] = useState(location.state?.departamentoTipo || '')
  const [roleNoDepartamento, setRoleNoDepartamento] = useState(location.state?.userRole || '')

  const [proximoCulto, setProximoCulto] = useState(null)
  const [indispBloqueada,  setIndispBloqueada]  = useState(false)
  const [toggling,         setToggling]         = useState(false)

  const [maisAberto, setMaisAberto] = useState(false)
  const [trocasPendentes, setTrocasPendentes] = useState(0)
  const [mesPdf, setMesPdf] = useState(`${new Date().getFullYear()}-${new Date().getMonth()}`)
  const [loading, setLoading] = useState(true)
  const { toast, confirm } = useUI()
  // ✅ useCallback — referência estável passada ao usePullToRefresh
  const buscarDados = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const hojeFormatoDB = hojeLocal()

      // ✅ Escalas e vínculo (se necessário) rodam em paralelo
      const paralelasBase = [
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

      const [escalasRes, vinculoRes] = await Promise.all(paralelasBase)


      let nomeDeptoAtual = departamentoNome
      if (vinculoRes?.data?.departamentos) {
        nomeDeptoAtual = vinculoRes.data.departamentos.nome
        setDepartamentoNome(nomeDeptoAtual)
        setDepartamentoTipo(vinculoRes.data.departamentos.tipo || 'generico')
        setRoleNoDepartamento(vinculoRes.data.role)
      }

      if (escalasRes.data) {
        const escalasVisiveis = escalasRes.data.filter(e => e.status === 'Publicada')
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

      // Pedidos de troca pendentes do departamento (alerta para líderes)
      const { count } = await supabase
        .from('swap_requests')
        .select('id, schedules!inner(departamento_id)', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .eq('schedules.departamento_id', departamentoId)
      setTrocasPendentes(count || 0)
    }
    setLoading(false)
  }, [departamentoId])

  const { isPulling, pullProgress, isRefreshing } = usePullToRefresh(buscarDados)


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


  if (loading && !departamentoNome) {
    return (
      <div className="min-h-screen bg-bg px-4 pt-6 space-y-4 max-w-[720px] mx-auto">
        <div className="h-10 w-48 rounded-ctl bg-surface-2 animate-pulse" />
        <div className="h-11 rounded-ctl bg-surface-2 animate-pulse" />
        <div className="h-40 rounded-card bg-surface-2 animate-pulse" />
      </div>
    )
  }

  const isLiderOuAdmin = roleNoDepartamento === 'admin' || roleNoDepartamento === 'líder'
  const mochila = { state: { departamentoId, departamentoNome, departamentoTipo, userRole: roleNoDepartamento } }
  const ir = (rota) => { setMaisAberto(false); navigate(rota, mochila) }
  const destinoGerar = departamentoTipo === 'cantina' ? '/cantina' : departamentoTipo === 'ministros' ? '/ministros' : '/gerar-escala'
  const papel = roleNoDepartamento === 'admin' ? 'Você é admin' : roleNoDepartamento === 'líder' ? 'Você é líder' : 'Membro'
  const ic = (icone) => { const I = icone; return <I className="w-5 h-5 text-brand" aria-hidden="true" /> }

  // Ações por tipo de departamento (mesmas regras de visibilidade de antes)
  const acoesEspecificas = [
    departamentoTipo === 'louvor'   && { rotulo: 'Músicas',  icone: Music,     rota: '/louvores' },
    departamentoTipo === 'infantil' && { rotulo: 'Lições',   icone: BookOpen,  rota: '/licoes' },
    departamentoTipo === 'infantil' && { rotulo: 'Check-in', icone: UserCheck, rota: '/checkin' },
  ].filter(Boolean)

  const opcoesMes = [0, 1, 2].map(i => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + i, 1)
    return { value: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) }
  })

  return (
    <>
    <PullIndicator isPulling={isPulling} progress={pullProgress} isRefreshing={isRefreshing} />
    <div className="min-h-screen bg-bg">
      <TopBar titulo={departamentoNome} subtitulo={papel} onVoltar={() => navigate('/hub')}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome).chip}`}>
          <IconeDept nome={departamentoNome} className="w-5 h-5" />
        </span>} />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-5">

        {/* AÇÕES */}
        <div className="flex gap-2">
          {isLiderOuAdmin ? (
            <>
              <Button className="flex-1" onClick={() => ir(destinoGerar)} icon={<Wand2 className="w-4 h-4" aria-hidden="true" />}>Gerar mês</Button>
              <Button className="flex-1" variant="secundario" onClick={() => ir('/equipe')} icon={<Users className="w-4 h-4" aria-hidden="true" />}>Equipe</Button>
            </>
          ) : (
            <>
              <Button className="flex-1" variant="secundario" onClick={() => ir('/indisponibilidade')} icon={<CalendarX className="w-4 h-4" aria-hidden="true" />}>Dias off</Button>
              {acoesEspecificas.slice(0, 1).map(a => (
                <Button key={a.rota} className="flex-1" variant="secundario" onClick={() => ir(a.rota)} icon={<a.icone className="w-4 h-4" aria-hidden="true" />}>{a.rotulo}</Button>
              ))}
            </>
          )}
          {(isLiderOuAdmin || acoesEspecificas.length > 1) && (
            <Button variant="secundario" aria-label="Mais ações" onClick={() => setMaisAberto(true)}
              icon={<MoreHorizontal className="w-5 h-5" aria-hidden="true" />} />
          )}
        </div>

        {/* PEDIDOS DE TROCA (líder) */}
        {isLiderOuAdmin && trocasPendentes > 0 && (
          <button type="button" onClick={() => ir('/trocas')}
            className="w-full flex items-center gap-2 rounded-ctl bg-danger-soft text-danger px-3 py-2.5 text-sm font-semibold text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">{trocasPendentes} {trocasPendentes === 1 ? 'pedido de troca aguardando' : 'pedidos de troca aguardando'}</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        {/* MINHA PRÓXIMA ESCALA NESTE DEPARTAMENTO */}
        {proximoCulto && (
          <Card as="button" onClick={() => navigate(`/escala/${proximoCulto.id}`, mochila)}
            className="w-full text-left flex items-center gap-3 hover:bg-surface-2/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <CalendarCheck className="w-5 h-5 text-accent-ink flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold text-accent-ink">SUA PRÓXIMA ESCALA</span>
              <span className="block text-sm font-semibold text-ink truncate">{dataComDia(proximoCulto.data)} · {proximoCulto.turno}</span>
              <span className="block text-xs text-ink-2 truncate">{proximoCulto.schedule_roles?.map(r => r.funcao).join(' + ')}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
          </Card>
        )}

        {/* ESCALAS */}
        <section aria-labelledby="titulo-escalas">
          <h2 id="titulo-escalas" className="text-sm font-bold text-ink mb-3">Escalas</h2>
          <ScheduleBoard departamentoId={departamentoId} userRole={roleNoDepartamento} departamentoNome={departamentoNome} />
        </section>

        {/* MURAL */}
        <NoticeBoard departamentoId={departamentoId} />
      </main>

      {/* MAIS AÇÕES */}
      <Sheet aberto={maisAberto} onFechar={() => setMaisAberto(false)} titulo="Mais ações">
        <div className="-mx-1">
          {isLiderOuAdmin && <ListRow titulo="Dias off" onClick={() => ir('/indisponibilidade')} icon={ic(CalendarX)} />}
          {(isLiderOuAdmin ? acoesEspecificas : acoesEspecificas.slice(1)).map(a => (
            <ListRow key={a.rota} titulo={a.rotulo} onClick={() => ir(a.rota)} icon={ic(a.icone)} />
          ))}
          {isLiderOuAdmin && (
            <>
              {departamentoTipo === 'midia' && <ListRow titulo="Cabine" onClick={() => ir(`/cabine/${departamentoId}`)} icon={ic(Headphones)} />}
              {departamentoTipo === 'midia' && <ListRow titulo="Checklist" onClick={() => ir('/checklist-midia')} icon={ic(ClipboardCheck)} />}
              <ListRow titulo="Frequência" onClick={() => ir('/frequencia')} icon={ic(BarChart3)} />
              <ListRow titulo="Pedidos de troca" onClick={() => ir('/trocas')} icon={ic(RefreshCw)}
                direita={trocasPendentes > 0 && <Pill tom="perigo">{trocasPendentes}</Pill>} />
              <ListRow titulo="Enviar aviso" onClick={() => ir('/criar-aviso')} icon={ic(BellRing)} />
              <ListRow titulo={indispBloqueada ? 'Liberar dias off' : 'Bloquear dias off'}
                subtitulo={indispBloqueada ? 'Hoje a equipe não pode marcar ausências' : 'Impede novas ausências da equipe'}
                onClick={() => { if (!toggling) toggleBloqueioIndisp() }} icon={ic(Lock)} />
              <ListRow titulo="Publicar todos os rascunhos" onClick={() => { setMaisAberto(false); publicarTodosRascunhos() }} icon={ic(Send)} />
              <div className="flex items-end gap-2 pt-3">
                <Select className="flex-1" label="Imprimir (PDF)" value={mesPdf} onChange={e => setMesPdf(e.target.value)} options={opcoesMes} />
                <Button variant="secundario" icon={<Printer className="w-4 h-4" aria-hidden="true" />}
                  onClick={() => {
                    const [ano, mes] = mesPdf.split('-').map(Number)
                    setMaisAberto(false)
                    navigate('/imprimir-escalas', { state: { departamentoId, departamentoNome, mesAtual: mes, anoAtual: ano } })
                  }}>Gerar</Button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    </div>
    </>
  )
}
