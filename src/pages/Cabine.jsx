// src/pages/Cabine.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import PageHeader from '../components/PageHeader'
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
    <div className="min-h-screen bg-gray-950 pb-20">
      <PageHeader
        title="Cabine de Controlo"
        subtitle="Monitorização em tempo real"
        icon={<Monitor className="w-5 h-5" />}
        color="bg-gray-900"
      />

      <div className="max-w-xl mx-auto px-4 space-y-4">

        <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex items-start gap-3 mb-6 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Esta área é visível apenas para os líderes. Defina aqui quem será o responsável da cabine em cada culto.
          </p>
        </div>

        {loading ? (
          <p className="text-center py-10 font-bold text-gray-600 animate-pulse">Buscando escalas da cabine...</p>
        ) : escalas.length === 0 ? (
          <div className="text-center p-10 bg-gray-900 rounded-2xl border border-gray-800">
            <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-bold">Nenhuma escala futura encontrada.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {escalas.map(esc => {
              const temLider = !!esc.lider_cabine_id
              const nomeLider = membros.find(m => m.id === esc.lider_cabine_id)?.nome

              return (
                <div key={esc.id} className={`p-4 rounded-2xl border transition-all ${temLider ? 'bg-gray-900 border-purple-500/30' : 'bg-gray-900/50 border-gray-800'}`}>
                  <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                    <div>
                      <p className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-purple-500" /> {formatarDataLonga(esc.data)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {esc.turno === 'Integral' ? 'Culto Principal' : `Culto da ${esc.turno}`}
                      </p>
                    </div>
                    {esc.status === 'Rascunho' && (
                      <span className="text-[9px] font-bold bg-orange-500/20 text-orange-400 px-2 py-1 rounded border border-orange-500/20 uppercase tracking-wider">Rascunho</span>
                    )}
                  </div>

                  {temLider ? (
                    <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-inner">
                          {nomeLider?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-100">{nomeLider || 'Desconhecido'}</p>
                          <p className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">Na Cabine</p>
                        </div>
                      </div>
                      <button onClick={() => definirLiderCabine(esc.id, null)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition" title="Remover Líder">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select 
                        onChange={(e) => definirLiderCabine(esc.id, e.target.value)}
                        value=""
                        className="flex-1 bg-black/40 border border-gray-800 text-gray-300 text-sm rounded-xl p-3 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                      >
                        <option value="" disabled>Selecionar quem vai ficar...</option>
                        {membros.map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
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