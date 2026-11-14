// src/pages/Hub.jsx — Início
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, CalendarX2, LayoutGrid, Settings, ArrowRight } from 'lucide-react'
import { supabase } from '../supabase'
import { usePullToRefresh, PullIndicator } from '../hooks/usePullToRefresh'
import { useNotificacoes } from '../hooks/useNotificacoes'
import { dataLocalISO } from '../utils/datas'
import { Card, Pill, ListRow, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'

// "2026-12-06" → "Domingo, 06/12"
function dataComDia(iso) {
  const d = new Date(iso + 'T12:00:00')
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long' })
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function InicioSkeleton() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-topo px-4 pt-10 pb-14"><div className="max-w-[720px] mx-auto space-y-2">
        <div className="h-3 w-24 bg-white/20 rounded" /><div className="h-6 w-40 bg-white/30 rounded" />
      </div></div>
      <div className="max-w-[720px] mx-auto px-4 -mt-8 space-y-4">
        <div className="h-32 bg-surface border border-line rounded-card animate-pulse" />
        <div className="grid grid-cols-2 gap-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-surface-2 rounded-card animate-pulse" />)}</div>
      </div>
    </div>
  )
}

export default function Hub() {
  const navigate = useNavigate()
  const { naoLidas } = useNotificacoes()

  const [nome, setNome] = useState('')
  const [meusDepartamentos, setMeusDepartamentos] = useState([])
  const [proximas, setProximas] = useState([])
  const [isMasterUser, setIsMasterUser] = useState(false)
  const [isLider, setIsLider] = useState(false)
  const [escalasProxMes, setEscalasProxMes] = useState({})
  const [loading, setLoading] = useState(true)

  // ── Status das escalas publicadas no próximo mês (indicador para líderes) ──
  async function buscarStatusProximoMes() {
    const hoje = new Date()
    const inicio = dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1))
    const fim    = dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0))
    const { data } = await supabase
      .from('schedules')
      .select('departamentos(nome)')
      .eq('status', 'Publicada')
      .gte('data', inicio)
      .lte('data', fim)
    if (data) {
      const status = {}
      data.forEach(e => { const n = e.departamentos?.nome; if (n) status[n] = (status[n] || 0) + 1 })
      setEscalasProxMes(status)
    }
  }

  // loading começa true; no "puxar para atualizar" a tela atual continua visível
  const buscarDados = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: perfil } = await supabase.from('users_profile').select('nome, role, super_admin, igreja_id').eq('id', user.id).single()
      if (perfil) setNome(perfil.nome)

      const { data: depts } = await supabase
        .from('membros_departamentos')
        .select('role, departamentos ( id, nome, cor, icone, tipo )')
        .eq('user_id', user.id)

      const ehSuperAdmin = perfil?.super_admin === true
      // Role geral do perfil (admin/líder da igreja sem estar em departamento — ex: pastor)
      const roleGeral = perfil?.role
      const ehAdminAlgumLugar = (depts ? depts.some(d => d.role === 'admin') : false) || roleGeral === 'admin'
      const ehLiderAlgumLugar = (depts ? depts.some(d => d.role === 'líder' || d.role === 'admin') : false) || roleGeral === 'admin' || roleGeral === 'líder'
      const master = ehAdminAlgumLugar || ehSuperAdmin

      setIsMasterUser(master)
      setIsLider(ehLiderAlgumLugar || master)
      if (ehLiderAlgumLugar || master) buscarStatusProximoMes()

      if (master) {
        const { data: todosDepts } = await supabase.from('departamentos').select('id, nome, cor, icone, tipo').eq('igreja_id', perfil?.igreja_id).order('nome')
        if (todosDepts) setMeusDepartamentos(todosDepts.map(d => ({ role: 'admin', departamentos: d })))
      } else {
        const listaDepts = depts || []
        // Líderes/admins veem a Cantina mesmo sem vínculo (ninguém se inscreve nela).
        if (ehLiderAlgumLugar) {
          const jaTenho = new Set(listaDepts.map(d => d.departamentos?.id))
          const { data: especiais } = await supabase
            .from('departamentos')
            .select('id, nome, cor, icone, tipo')
            .eq('tipo', 'cantina')
            .eq('igreja_id', perfil?.igreja_id)
          especiais?.forEach(d => { if (!jaTenho.has(d.id)) listaDepts.push({ role: 'líder', departamentos: d }) })
        }
        // Defesa: remove vínculos órfãos (departamento apagado mas o vínculo ficou).
        setMeusDepartamentos(listaDepts.filter(v => v.departamentos))
      }

      const { data: minhasEscalas } = await supabase
        .from('schedules')
        .select('id, data, turno, status, departamento_id, cor_roupa, departamentos(nome, tipo), schedule_roles!inner(funcao, user_id)')
        .eq('schedule_roles.user_id', user.id)
        .neq('status', 'Rascunho')
        .order('data', { ascending: true })
      const hoje = dataLocalISO(new Date())
      setProximas((minhasEscalas || []).filter(e => e.data >= hoje))
    }
    setLoading(false)
  }, [])

  const { isPulling, pullProgress, isRefreshing } = usePullToRefresh(buscarDados)
  // setState só acontece depois dos awaits (buscas no Supabase), não de forma síncrona
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { buscarDados() }, [buscarDados])

  if (loading) return <InicioSkeleton />

  const proxima = proximas[0]
  const estadoEscala = (esc) => ({ departamentoId: esc.departamento_id, departamentoNome: esc.departamentos?.nome, departamentoTipo: esc.departamentos?.tipo, userRole: isMasterUser ? 'admin' : 'membro' })
  const abrirDept = (v) => navigate('/dashboard', { state: { departamentoId: v.departamentos.id, departamentoNome: v.departamentos.nome, departamentoTipo: v.departamentos.tipo, userRole: v.role } })
  const deptsResumo = meusDepartamentos.filter(v => v.departamentos.tipo !== 'cantina' && (isMasterUser || v.role !== 'membro'))
  const nomeProxMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString('pt-BR', { month: 'long' })

  return (
    <>
      <PullIndicator isPulling={isPulling} progress={pullProgress} isRefreshing={isRefreshing} />
      <div className="min-h-screen bg-bg">

        {/* TOPO */}
        <header className="bg-topo text-white px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-14">
          <div className="max-w-[720px] mx-auto flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-white/80">Olá, {nome.split(' ')[0] || 'bem-vindo'}</p>
              <h1 className="text-2xl font-bold">Graça e paz</h1>
              {isMasterUser && <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15">Administrador</span>}
            </div>
            <Link to="/avisos" aria-label={naoLidas ? `Avisos, ${naoLidas} não lidos` : 'Avisos'}
              className="relative p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <Bell className="w-5 h-5" aria-hidden="true" />
              {naoLidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[10px] font-bold flex items-center justify-center">
                  {naoLidas > 9 ? '9+' : naoLidas}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="max-w-[720px] mx-auto px-4 -mt-9 space-y-6 pb-6">

          {/* PRÓXIMA ESCALA */}
          {proxima ? (
            <Card className="!p-5">
              <p className="text-[11px] font-bold text-accent tracking-wide">PRÓXIMA ESCALA</p>
              <p className="text-lg font-bold text-ink mt-1">{dataComDia(proxima.data)} · {proxima.turno}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Pill tom="dept" dept={proxima.departamentos?.nome}>
                  <IconeDept nome={proxima.departamentos?.nome} className="w-3 h-3" /> {proxima.departamentos?.nome}
                </Pill>
                <span className="text-sm text-ink-2">{proxima.schedule_roles?.map(r => r.funcao).join(' + ')}</span>
              </div>
              <div className="flex items-center justify-between mt-4">
                <Link to={`/escala/${proxima.id}`} state={estadoEscala(proxima)}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand text-on-brand text-xs font-semibold hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                  Ver detalhes
                </Link>
                {proximas.length > 1 && (
                  <Link to="/escalas" className="text-xs font-semibold text-brand inline-flex items-center gap-1 hover:underline">
                    +{proximas.length - 1} {proximas.length === 2 ? 'próxima' : 'próximas'} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <Card padded={false}>
              <EmptyState icon={<CalendarX2 className="w-5 h-5" aria-hidden="true" />} titulo="Você ainda não foi escalado"
                texto="Quando o líder publicar uma escala com o seu nome, ela aparece aqui." />
            </Card>
          )}

          {/* DEPARTAMENTOS */}
          <section aria-labelledby="titulo-depts">
            <h2 id="titulo-depts" className="text-sm font-bold text-ink mb-3">Departamentos</h2>
            {meusDepartamentos.length === 0 ? (
              <Card padded={false}>
                <EmptyState icon={<LayoutGrid className="w-5 h-5" aria-hidden="true" />} titulo="Você ainda não está em nenhum departamento"
                  texto="Peça ao líder do seu departamento para te adicionar à equipe." />
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {meusDepartamentos.map(v => (
                  <button key={v.departamentos.id} type="button" onClick={() => abrirDept(v)}
                    className={`flex items-center gap-2.5 p-3.5 rounded-card text-left transition active:scale-[0.98]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${classesDept(v.departamentos.nome).chip}`}>
                    <IconeDept nome={v.departamentos.nome} className="w-5 h-5 flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold truncate">{v.departamentos.nome}</span>
                      {v.role !== 'membro' && <span className="block text-[10px] font-semibold opacity-70">{v.role === 'admin' ? 'Admin' : 'Líder'}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* RESUMO DO PRÓXIMO MÊS (líderes) — aparece depois que o 1º departamento publica */}
          {isLider && Object.keys(escalasProxMes).length > 0 && deptsResumo.length > 0 && (
            <section aria-labelledby="titulo-resumo">
              <h2 id="titulo-resumo" className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-brand" aria-hidden="true" /> Escalas de {nomeProxMes}
              </h2>
              <Card padded={false} className="px-4">
                {deptsResumo.map(v => {
                  const qtd = escalasProxMes[v.departamentos.nome] || 0
                  return (
                    <ListRow key={v.departamentos.id} titulo={v.departamentos.nome}
                      icon={<IconeDept nome={v.departamentos.nome} className={`w-4 h-4 ${classesDept(v.departamentos.nome).icone}`} />}
                      direita={qtd ? <Pill tom="sucesso">{qtd} publicada{qtd > 1 ? 's' : ''}</Pill> : <Pill tom="aviso">Pendente</Pill>} />
                  )
                })}
              </Card>
            </section>
          )}

          {/* ADMINISTRAÇÃO */}
          {isMasterUser && (
            <Card padded={false} className="px-4">
              <ListRow titulo="Gestão da igreja" subtitulo="Membros, comunicação e escalas" onClick={() => navigate('/gestao-igreja')}
                icon={<Settings className="w-5 h-5 text-brand" aria-hidden="true" />} />
            </Card>
          )}
        </main>
      </div>
    </>
  )
}
