// src/pages/ChecklistMidia.jsx
// Página dedicada ao histórico de checklists da Cabine de Mídia.
// Acessível apenas por líderes/admins do departamento de Mídia.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import { ListChecks, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react'
import PageHeader from '../components/PageHeader'
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Histórico de Checklists"
        subtitle={`Cabine de Mídia — ${departamentoNome}`}
        icon={<ListChecks className="w-5 h-5" />}
        color="bg-purple-600"
      />

      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* Filtro de mês */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
            className="flex-1 text-sm font-medium text-gray-700 outline-none bg-transparent capitalize">
            {mesesDisponiveis.map(m => (
              <option key={m.val} value={m.val}>{m.label}</option>
            ))}
          </select>
          {/* Stats do mês */}
          {!loading && (
            <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
              <span className="text-green-600 font-bold">{checklists.length} preenchidos</span>
              <span>/</span>
              <span>{schedules.length} escalas</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400">
            <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma escala encontrada neste mês.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map(escala => {
              const checklist = checklists.find(c => c.schedule_id === escala.id)
              const isOpen    = expandido === escala.id
              const score     = checklist ? calcScore(checklist) : null

              return (
                <div key={escala.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Cabeçalho clicável */}
                  <div
                    onClick={() => setExpandido(isOpen ? null : escala.id)}
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition">
                    {/* Status */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${checklist ? 'bg-green-100' : 'bg-orange-50'}`}>
                      {checklist
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : <AlertCircle className="w-5 h-5 text-orange-400" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 capitalize">
                        {formatarData(escala.data)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{escala.turno}</span>
                        {checklist && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-500">{checklist.nome_responsavel}</span>
                            <span className="text-gray-200">·</span>
                            <span className={`text-xs font-bold ${score.pct === 100 ? 'text-green-600' : 'text-amber-500'}`}>
                              {score.ok}/{score.total} itens
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Badge + chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {checklist ? (
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ OK</span>
                      ) : escala.status === 'Publicada' ? (
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Pendente</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Rascunho</span>
                      )}
                      {checklist && (isOpen
                        ? <ChevronUp className="w-4 h-4 text-gray-300" />
                        : <ChevronDown className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {isOpen && checklist && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                      {/* Itens */}
                      <div className="grid grid-cols-1 gap-1.5">
                        {ITENS.map(item => (
                          <div key={item.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${checklist[item.key] ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            <span className="w-4 text-center">{checklist[item.key] ? '✓' : '✗'}</span>
                            {item.label}
                          </div>
                        ))}
                      </div>

                      {/* Relato */}
                      {checklist.relato_problema && (
                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">⚠️ Relato de Problema</p>
                          <p className="text-xs text-gray-700">{checklist.relato_problema}</p>
                        </div>
                      )}

                      {/* Metadados */}
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-1">
                        <span>Preenchido por <strong className="text-gray-600">{checklist.nome_responsavel}</strong></span>
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
