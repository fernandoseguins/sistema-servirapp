// src/components/ScheduleBoard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { CalendarDays, User, Clock, Send, ChevronDown, ArrowRight, Headphones } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { agruparPorMes, dataComDia, rotuloTurno } from '../utils/escalas'
import { Card, Pill, Button, EmptyState } from './ui'
import { hojeLocal } from '../utils/datas'
// Quando o quadro é da Cantina, mostramos o departamento responsável do dia
// (rotação por domingo) em vez do turno (ex: "Louvor" em vez de "Culto da Noite").
import { deptResponsavelCantina } from '../utils/cantinaRotacao'

export default function ScheduleBoard({ departamentoId, userRole, departamentoNome }) {
  const [escalas,    setEscalas]    = useState([])
  const [membros,    setMembros]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const navigate        = useNavigate()
  const isLiderOuAdmin  = userRole === 'admin' || userRole === 'líder'
  const isMidia         = departamentoNome === 'Mídia' || departamentoNome === 'Midia'
  const isCantina        = departamentoNome === 'Cantina'

  useEffect(() => {
    async function buscarEscalas() {
      if (!departamentoId) return
      setLoading(true)

      // ✅ Sem filtro de datas — mostra sempre a partir de hoje
      const hoje = hojeLocal()

      let query = supabase
        .from('schedules')
        .select(`id, data, cor_roupa, status, turno, lider_cabine_id,
          schedule_roles ( funcao, users_profile ( nome ) )`)
        .eq('departamento_id', departamentoId)
        .gte('data', hoje)
        .order('data', { ascending: true })

      if (!isLiderOuAdmin) query = query.neq('status', 'Rascunho')

      const { data, error } = await query
      if (!error && data) setEscalas(data)

      if (isMidia && isLiderOuAdmin) {
        const { data: equipa } = await supabase
          .from('membros_departamentos')
          .select('users_profile(id, nome)')
          .eq('departamento_id', departamentoId)
          .in('role', ['líder', 'admin'])
        if (equipa) setMembros(equipa.map(e => e.users_profile).filter(Boolean))
      }

      setLoading(false)
    }
    buscarEscalas()
  }, [departamentoId, isLiderOuAdmin, isMidia])

  const toggleAccordion = (id) => setExpandedId(expandedId === id ? null : id)
  const grupos = agruparPorMes(escalas)

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-card bg-surface-2 animate-pulse" />)}</div>
  }
  if (escalas.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState icon={<CalendarDays className="w-5 h-5" aria-hidden="true" />} titulo="Nenhuma escala programada"
          texto={isLiderOuAdmin ? 'Use “Gerar mês” para criar as escalas.' : 'Quando o líder publicar as escalas, elas aparecem aqui.'} />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {grupos.map(g => (
        <section key={g.chave} aria-label={g.titulo}>
          <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wide mb-2">{g.titulo}</h3>
          <Card padded={false} className="divide-y divide-line overflow-hidden">
            {g.itens.map((escala) => {
              const isOpen = expandedId === escala.id
              const rascunho = escala.status === 'Rascunho'
              const nomeLiderCabine = membros.find(m => m.id === escala.lider_cabine_id)?.nome
              const painelId = `escala-${escala.id}`
              return (
                <div key={escala.id}>
                  <button type="button" onClick={() => toggleAccordion(escala.id)} aria-expanded={isOpen} aria-controls={painelId}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink truncate">{dataComDia(escala.data)}</span>
                      <span className="block text-xs text-ink-2 truncate">
                        {isCantina ? deptResponsavelCantina(escala.data) : rotuloTurno(escala.turno)}
                        {escala.cor_roupa ? ` · Roupa: ${escala.cor_roupa}` : ''}
                      </span>
                    </span>
                    <Pill tom={rascunho ? 'aviso' : 'sucesso'}>
                      {rascunho ? <Clock className="w-3 h-3" aria-hidden="true" /> : <Send className="w-3 h-3" aria-hidden="true" />}
                      {rascunho ? 'Rascunho' : 'Publicada'}
                    </Pill>
                    <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {isOpen && (
                    <div id={painelId} className="px-4 pb-4 space-y-3">
                      {isMidia && isLiderOuAdmin && (
                        <p className="flex items-center gap-2 text-xs text-ink-2 bg-surface-2 rounded-ctl px-3 py-2">
                          <Headphones className="w-4 h-4 text-brand" aria-hidden="true" />
                          Líder na cabine: <span className="font-semibold text-ink">{nomeLiderCabine || 'nenhum designado'}</span>
                        </p>
                      )}
                      {escala.schedule_roles.length === 0 ? (
                        <p className="text-sm text-ink-2">Ninguém escalado ainda.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {escala.schedule_roles.map((papel, index) => (
                            <li key={index} className="flex justify-between gap-4 text-xs">
                              <span className="text-ink-2">{papel.funcao}</span>
                              <span className="font-semibold text-ink text-right flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                                {papel.users_profile?.nome || 'Membro excluído'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button variant="secundario" size="sm" full icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                        onClick={() => navigate(`/escala/${escala.id}`, { state: { departamentoId, departamentoNome, userRole } })}>
                        Ver detalhes
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </Card>
        </section>
      ))}
    </div>
  )
}
