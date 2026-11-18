// src/pages/ChecklistMidia.jsx
// Página dedicada ao histórico de checklists da Cabine de Mídia.
// Acessível apenas por líderes/admins do departamento de Mídia.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import { ListChecks, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react'
import { TopBar, Card, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { useUI } from '../context/UIContext'

const ITENS = [
  { key: 'equipamentos_ok', label: 'Equipamentos verificados' },
  { key: 'computadores_ok', label: 'Computadores desligados' },
  { key: 'tvs_ok',          label: 'TVs e Projetores desligados' },
  { key: 'ar_ok',           label: 'Ar condicionado desligado' },
  { key: 'bancada_ok',      label: 'Bancada limpa' },
]

export default function ChecklistMidia() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useUI()

  const departamentoId   = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome || 'Mídia'

  const [checklists,  setChecklists]  = useState([])
  const [schedules,   setSchedules]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [expandido,   setExpandido]   = useState(null)
  const [filtroMes,   setFiltroMes]   = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  useEffect(() => {
    if (!departamentoId) { navigate('/hub'); return }
    buscarDados()
  }, [departamentoId, filtroMes])

  async function buscarDados() {
    setLoading(true)
    const [ano, mes] = filtroMes.split('-')
    const inicio = `${ano}-${mes}-01`
    const fim    = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`

    // Escalas do mês + checklists em paralelo
    const [escalasRes, checklistsRes] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, data, turno, status')
        .eq('departamento_id', departamentoId)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false }),
      supabase
        .from('media_checklists')
        .select('*')
        .eq('departamento_id', departamentoId)
        .gte('data', inicio)
        .lte('data', fim)
        .order('created_at', { ascending: false }),
    ])

    setSchedules(escalasRes.data || [])
    setChecklists(checklistsRes.data || [])
    setLoading(false)
  }

  function formatarData(dataStr) {
    const d = new Date(dataStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  }

  // Calcula % de itens ok no checklist
  function calcScore(cl) {
    const total = ITENS.length
    const ok    = ITENS.filter(i => cl[i.key]).length
    return { ok, total, pct: Math.round((ok / total) * 100) }
  }

  const mesesDisponiveis = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { val, label }
  })

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Checklists da cabine"
        subtitulo={`${departamentoNome || 'Mídia'} · histórico`}
        onVoltar={() => navigate(-1)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome || 'Mídia').chip}`}>
          <IconeDept nome={departamentoNome || 'Mídia'} className="w-5 h-5" />
        </span>}
      />

      <div className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">

        {/* Filtro de mês */}
        <div className="bg-surface p-4 rounded-2xl shadow-sm border border-line flex items-center gap-3">
          <CalendarDays className="w-4 h-4 text-muted flex-shrink-0" aria-hidden="true" />
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} aria-label="Mês"
            className="flex-1 min-w-0 text-sm font-medium text-ink outline-none bg-transparent capitalize focus-visible:ring-2 focus-visible:ring-brand rounded">
            {mesesDisponiveis.map(m => (
              <option key={m.val} value={m.val}>{m.label}</option>
            ))}
          </select>
          {/* Stats do mês */}
          {!loading && (
            <div className="flex items-center gap-1.5 text-xs text-muted flex-shrink-0">
              <span className="text-success font-bold">{checklists.length} preenchidos</span>
              <span>/</span>
              <span>{schedules.length} escalas</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-surface rounded-2xl border border-line p-4 animate-pulse">
                <div className="h-4 bg-line rounded w-40 mb-2" />
                <div className="h-3 bg-surface-2 rounded w-24" />
              </div>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <Card>
            <EmptyState icon={<ListChecks className="w-6 h-6" aria-hidden="true" />} titulo="Nenhuma escala neste mês" texto="Escolha outro mês no filtro acima." />
          </Card>
        ) : (
          <div className="space-y-3">
            {schedules.map(escala => {
              const checklist = checklists.find(c => c.schedule_id === escala.id)
              const isOpen    = expandido === escala.id
              const score     = checklist ? calcScore(checklist) : null

              return (
                <div key={escala.id} className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
                  {/* Cabeçalho clicável */}
                  <button type="button" aria-expanded={isOpen}
                    onClick={() => setExpandido(isOpen ? null : escala.id)}
                    className="w-full text-left flex items-center gap-4 p-4 cursor-pointer hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                    {/* Status */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${checklist ? 'bg-success-soft' : 'bg-warning-soft'}`}>
                      {checklist
                        ? <CheckCircle2 className="w-5 h-5 text-success" />
                        : <AlertCircle className="w-5 h-5 text-warning" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink capitalize">
                        {formatarData(escala.data)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted">{escala.turno}</span>
                        {checklist && (
                          <>
                            <span className="text-muted">·</span>
                            <span className="text-xs text-ink-2">{checklist.nome_responsavel}</span>
                            <span className="text-muted">·</span>
                            <span className={`text-xs font-bold ${score.pct === 100 ? 'text-success' : 'text-warning'}`}>
                              {score.ok}/{score.total} itens
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Badge + chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {checklist ? (
                        <span className="text-[10px] font-bold bg-success-soft text-success px-2 py-0.5 rounded-full">✓ OK</span>
                      ) : escala.status === 'Publicada' ? (
                        <span className="text-[10px] font-bold bg-warning-soft text-warning px-2 py-0.5 rounded-full">Pendente</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-surface-2 text-muted px-2 py-0.5 rounded-full">Rascunho</span>
                      )}
                      {checklist && (isOpen
                        ? <ChevronUp className="w-4 h-4 text-muted" />
                        : <ChevronDown className="w-4 h-4 text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {isOpen && checklist && (
                    <div className="border-t border-line px-4 py-3 bg-surface-2 space-y-3">
                      {/* Itens */}
                      <div className="grid grid-cols-1 gap-1.5">
                        {ITENS.map(item => (
                          <div key={item.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${checklist[item.key] ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                            <span className="w-4 text-center">{checklist[item.key] ? '✓' : '✗'}</span>
                            {item.label}
                          </div>
                        ))}
                      </div>

                      {/* Relato */}
                      {checklist.relato_problema && (
                        <div className="bg-warning-soft border border-warning/30 p-3 rounded-xl">
                          <p className="text-[10px] font-bold text-warning uppercase tracking-wider mb-1">⚠️ Relato de Problema</p>
                          <p className="text-xs text-ink">{checklist.relato_problema}</p>
                        </div>
                      )}

                      {/* Metadados */}
                      <div className="flex items-center gap-3 text-[10px] text-muted pt-1">
                        <span>Preenchido por <strong className="text-ink-2">{checklist.nome_responsavel}</strong></span>
                        <span>às {new Date(checklist.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
