// src/pages/Cabine.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { TopBar, Card, Pill, Select, EmptyState } from '../components/ui'
import { classesDept } from '../theme/deptCores'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Monitor, Headphones, Calendar, Clock, Trash2, ShieldAlert } from 'lucide-react'
import { hojeLocal } from '../utils/datas'

export default function Cabine() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  
  const departamentoId = params.id || location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome || 'Mídia'

  const [escalas, setEscalas] = useState([])
  const [membros, setMembros] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast, confirm } = useUI()

  useEffect(() => {
    if (!departamentoId) {
      navigate('/hub')
      return
    }
    buscarDados()
  }, [departamentoId])

  async function buscarDados() {
    setLoading(true)
    const hoje = hojeLocal()

    const { data: esc } = await supabase
      .from('schedules')
      .select('id, data, turno, lider_cabine_id, status')
      .eq('departamento_id', departamentoId)
      .gte('data', hoje)
      .order('data', { ascending: true })

    if (esc) setEscalas(esc)

    const { data: equipa } = await supabase
      .from('membros_departamentos')
      .select('users_profile(id, nome)')
      .eq('departamento_id', departamentoId)
      .in('role', ['líder', 'admin']) 
    
    if (equipa) setMembros(equipa.map(e => e.users_profile).filter(Boolean).sort((a,b) => a.nome.localeCompare(b.nome)))
    
    setLoading(false)
  }

  async function definirLiderCabine(escalaId, userId) {
    setLoading(true)
    const { error } = await supabase.from('schedules').update({ lider_cabine_id: userId || null }).eq('id', escalaId)
    
    if (!error) {
      toast.success(userId ? 'Cabine definida com sucesso!' : 'Cabine removida.')
      buscarDados()
    } else {
      (() => { console.error('Erro ao salvar:', error); toast.error('Não foi possível salvar. Tente novamente.') })()
      setLoading(false)
    }
  }

  function formatarDataLonga(dataString) {
    if (!dataString) return ''
    return new Date(dataString + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Cabine"
        subtitulo={`${departamentoNome || 'Mídia'} · quem fica em cada culto`}
        onVoltar={() => navigate(-1)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome || 'Mídia').chip}`}>
          <Monitor className="w-5 h-5" aria-hidden="true" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">

        <p className="bg-surface-2 p-3 rounded-ctl flex items-start gap-2 text-xs text-ink-2">
          <ShieldAlert className="w-4 h-4 text-brand mt-0.5 shrink-0" aria-hidden="true" />
          Só líderes veem esta área. Defina quem fica responsável pela cabine em cada culto.
        </p>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map(i => <div key={i} className="h-32 bg-surface-2 rounded-card animate-pulse" />)}
          </div>
        ) : escalas.length === 0 ? (
          <Card>
            <EmptyState icon={<Calendar className="w-6 h-6" aria-hidden="true" />} titulo="Nenhuma escala futura" texto="Quando houver escalas de Mídia, elas aparecem aqui." />
          </Card>
        ) : (
          <ul className="space-y-3">
            {escalas.map(esc => {
              const temLider = !!esc.lider_cabine_id
              const nomeLider = membros.find(m => m.id === esc.lider_cabine_id)?.nome

              return (
                <li key={esc.id}>
                  <Card className={temLider ? '!border-brand/40' : ''}>
                    <div className="flex justify-between items-start mb-3 border-b border-line pb-3">
                      <div>
                        <p className="text-sm font-bold text-ink flex items-center gap-1.5 capitalize">
                          <Calendar className="w-4 h-4 text-brand" aria-hidden="true" /> {formatarDataLonga(esc.data)}
                        </p>
                        <p className="text-xs text-ink-2 mt-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {esc.turno === 'Integral' ? 'Culto principal' : `Culto da ${esc.turno.toLowerCase()}`}
                        </p>
                      </div>
                      {esc.status === 'Rascunho' && <Pill tom="aviso">Rascunho</Pill>}
                    </div>

                    {temLider ? (
                      <div className="flex items-center justify-between bg-surface-2 p-3 rounded-ctl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand text-on-brand flex items-center justify-center font-bold text-sm" aria-hidden="true">
                            {nomeLider?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-ink">{nomeLider || 'Desconhecido'}</p>
                            <p className="text-[11px] text-brand font-semibold">Na cabine</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => definirLiderCabine(esc.id, null)} aria-label={`Tirar ${nomeLider || 'responsável'} da cabine`}
                          className="p-2 text-muted hover:text-danger hover:bg-danger-soft rounded-ctl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <Select
                        aria-label={`Responsável pela cabine em ${formatarDataLonga(esc.data)}`}
                        onChange={(e) => definirLiderCabine(esc.id, e.target.value)}
                        value=""
                        options={[{ value: '', label: 'Escolher quem vai ficar' }, ...membros.map(m => ({ value: m.id, label: m.nome }))]}
                      />
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
