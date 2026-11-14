// src/components/ScheduleBoard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { CalendarDays, Palette, User, Clock, Send, ChevronDown, ArrowRight, Headphones } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getDeptTheme } from '../utils/departmentThemes'
import { hojeLocal } from '../utils/datas'
// Quando o quadro é da Cantina, mostramos o departamento responsável do dia
// (rotação por domingo) em vez do turno (ex: "Louvor" em vez de "Culto da Noite").
import { deptResponsavelCantina } from '../utils/cantinaRotacao'

export default function ScheduleBoard({ departamentoId, userRole, departamentoNome, departamentoCor = null }) {
  const [escalas,    setEscalas]    = useState([])
  const [membros,    setMembros]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const navigate        = useNavigate()
  const isLiderOuAdmin  = userRole === 'admin' || userRole === 'líder'
  const isMidia         = departamentoNome === 'Mídia' || departamentoNome === 'Midia'
  const isCantina        = departamentoNome === 'Cantina'
  const themeRaw        = getDeptTheme(departamentoNome, departamentoCor)
  const theme           = { ...themeRaw, btnHover: themeRaw.boardBtnHover }
  const pers            = themeRaw.personalizado
  const st              = themeRaw.styles || {}

  function formatarDataComDia(dataString) {
    if (!dataString) return ''
    const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
    const data = new Date(dataString + 'T12:00:00')
    return `${dias[data.getDay()]}, ${String(data.getDate()).padStart(2,'0')}/${String(data.getMonth()+1).padStart(2,'0')}`
  }

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

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-center text-gray-500 text-sm py-8 font-bold animate-pulse">A carregar escalas...</p>
      ) : escalas.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500">
          <CalendarDays className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium">Nenhuma escala programada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {escalas.map((escala) => {
            const isOpen = expandedId === escala.id
            const nomeLiderCabine = membros.find(m => m.id === escala.lider_cabine_id)?.nome
            return (
              <div key={escala.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
                <div
                  onClick={() => toggleAccordion(escala.id)}
                  className={`${escala.status === 'Rascunho' ? 'bg-orange-500 hover:bg-orange-600' : `${pers ? '' : theme.bgPublicada} hover:opacity-95`} text-white p-4 cursor-pointer transition-all flex flex-col gap-3`} style={pers && escala.status !== 'Rascunho' ? st.bgPublicada : {}}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 font-bold text-base">
                      <CalendarDays className="w-5 h-5 shrink-0" />
                      <span className="capitalize">{formatarDataComDia(escala.data)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${escala.status === 'Rascunho' ? 'bg-orange-400 border-orange-300 text-orange-50' : `${pers ? '' : theme.tagBg + ' ' + theme.tagBorder + ' ' + theme.tagText}`}`} style={pers && escala.status !== 'Rascunho' ? { ...st.tagBg, ...st.tagBorder, ...st.tagText } : {}}>
                        {escala.status === 'Rascunho' ? <><Clock className="w-2.5 h-2.5"/> Rascunho</> : <><Send className="w-2.5 h-2.5"/> Publicada</>}
                      </span>
                      <ChevronDown className={`w-5 h-5 transition-transform duration-300 opacity-70 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-white text-xs font-medium opacity-90">
                    <div className="uppercase tracking-wider font-bold bg-black/30 px-2.5 py-1 rounded-lg">
                      {isCantina ? deptResponsavelCantina(escala.data) : (escala.turno === 'Integral' ? 'Culto Principal' : `Culto da ${escala.turno}`)}
                    </div>
                    {escala.cor_roupa && (
                      <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-lg">
                        <Palette className="w-3.5 h-3.5" /> {escala.cor_roupa}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <div className="p-4 bg-white border-t border-gray-50">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/escala/${escala.id}`, { state: { departamentoId, departamentoNome, userRole } }) }}
                        className={`w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold transition shadow-sm ${pers ? 'hover:bg-gray-50' : theme.btnHover}`}>
                        Ver Detalhes Completos <ArrowRight className="w-4 h-4" />
                      </button>

                      {isMidia && isLiderOuAdmin && (
                        <div className="mb-4 bg-purple-50 p-3 rounded-xl border border-purple-100 flex items-center gap-3">
                          <div className="bg-purple-200 p-1.5 rounded-lg">
                            <Headphones className="w-4 h-4 text-purple-700" />
                          </div>
                          <div>
                            <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Líder na Cabine</p>
                            <p className="text-xs text-purple-900 font-bold">{nomeLiderCabine || 'Nenhum designado'}</p>
                          </div>
                        </div>
                      )}

                      {escala.schedule_roles.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-2">Ninguém escalado ainda.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {escala.schedule_roles.map((papel, index) => (
                            <div key={index} className="flex justify-between items-start border-b border-gray-50 last:border-0 pb-2.5 last:pb-0 gap-4">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 leading-tight flex-1 pt-0.5">
                                {papel.funcao}
                              </span>
                              <span className="flex items-start justify-end gap-1.5 text-xs font-bold text-gray-800 text-right w-1/2 shrink-0">
                                <User className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                {papel.users_profile?.nome || 'Membro Excluído'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}