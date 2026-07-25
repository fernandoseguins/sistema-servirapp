// src/pages/FrequencyReport.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { ArrowLeft, BarChart3, CalendarDays, TrendingUp, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useUI } from '../context/UIContext'
import { getDeptTheme } from '../utils/departmentThemes'

export default function FrequencyReport() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome

  // ✅ NOVO SISTEMA DE CALENDÁRIO (Igual ao Dashboard)
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(hoje.getMonth())
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear())
  
  const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  const [relatorio, setRelatorio] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [membroExpandido, setMembroExpandido] = useState(null)
  const [departamentoCor, setDepartamentoCor] = useState(null)

  // Tema dinâmico (suporta departamentos personalizados)
  const theme = getDeptTheme(departamentoNome, departamentoCor)
  const pers = theme.personalizado
  const st = theme.styles || {}

  useEffect(() => {
    if (!departamentoId) {
      navigate('/hub')
      return
    }
    supabase.from('departamentos').select('cor').eq('id', departamentoId).single()
      .then(({ data }) => { if (data) setDepartamentoCor(data.cor) })
    gerarRelatorio()
  }, [mesAtual, anoAtual, departamentoId])

  async function gerarRelatorio() {
    setLoading(true)
    setMembroExpandido(null) 
    
    // Calcula as datas com base no novo sistema de mês/ano
    const mesFormatado = String(mesAtual + 1).padStart(2, '0')
    const dataInicio = `${anoAtual}-${mesFormatado}-01`
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate()
    const dataFim = `${anoAtual}-${mesFormatado}-${String(ultimoDia).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('schedule_roles')
      .select(`
        user_id,
        funcao,
        users_profile ( nome ),
        schedules!inner ( data, departamento_id )
      `)
      .eq('schedules.departamento_id', departamentoId)
      .gte('schedules.data', dataInicio)
      .lte('schedules.data', dataFim)

    if (data && !error) {
      const contagem = {}
      
      data.forEach(item => {
        const id = item.user_id
        const nome = item.users_profile?.nome || 'Membro Excluído'
        
        if (!contagem[id]) {
          contagem[id] = { id, nome, total: 0, funcoesCount: {} }
        }
        
        contagem[id].total += 1
        
        const roles = item.funcao ? item.funcao.split('+').map(r => r.trim()) : ['Sem função']
        
        roles.forEach(r => {
          contagem[id].funcoesCount[r] = (contagem[id].funcoesCount[r] || 0) + 1
        })
      })

      const listaFinal = Object.values(contagem).sort((a, b) => b.total - a.total)
      setRelatorio(listaFinal)
    }
    
    setLoading(false)
  }

  // Funções de navegação do calendário
  const mesAnterior = () => { 
    if (mesAtual === 0) { setMesAtual(11); setAnoAtual(anoAtual - 1) } 
    else { setMesAtual(mesAtual - 1) } 
  }
  
  const proximoMes = () => { 
    if (mesAtual === 11) { setMesAtual(0); setAnoAtual(anoAtual + 1) } 
    else { setMesAtual(mesAtual + 1) } 
  }

  function toggleMembro(id) {
    if (membroExpandido === id) {
      setMembroExpandido(null)
    } else {
      setMembroExpandido(id)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      <PageHeader
        bg={pers ? theme.hexValue : theme.bgPrimary}
        icon={<BarChart3 className="w-5 h-5" />}
        title="Frequência"
        subtitle={`Termometro de escalas — ${departamentoNome}`}
      />

      <div className="max-w-md mx-auto px-4 space-y-6">
        
        {/* ✅ NOVO SELETOR DE MÊS VISUAL (Igual ao Dashboard) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${pers ? "" : theme.bgLight + " " + theme.textPrimary}`} style={pers ? { ...st.bgLight, ...st.textPrimary } : {}}>
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mês de Análise</p>
              <p className="text-sm font-bold text-gray-800">{nomesMeses[mesAtual]} {anoAtual}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button onClick={mesAnterior} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition active:scale-[0.97]">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={proximoMes} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition active:scale-[0.97]">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* LISTA DE RESULTADOS */}
        <div>
          <h2 className={`text-sm font-bold uppercase mb-3 flex items-center gap-2 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}}>
            <TrendingUp className="w-5 h-5" /> Ranking do Mês
          </h2>

          {loading ? (
            <p className="text-center text-gray-400 text-sm py-6 font-bold animate-pulse">A calcular frequências...</p>
          ) : relatorio.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500">
              <BarChart3 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium">Ninguém foi escalado neste mês ainda.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {relatorio.map((pessoa, index) => (
                <div key={pessoa.id} className="flex flex-col">
                  
                  {/* BARRA PRINCIPAL CLICÁVEL */}
                  <div 
                    onClick={() => toggleMembro(pessoa.id)}
                    className="p-4 flex items-center gap-4 hover:bg-gray-50 transition cursor-pointer"
                  >
                    {/* Medalha */}
                    <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full font-black text-lg shadow-inner
                      ${index === 0 ? 'bg-yellow-100 text-yellow-600 border border-yellow-200' : 
                        index === 1 ? 'bg-gray-100 text-gray-500 border border-gray-200' : 
                        index === 2 ? 'bg-orange-100 text-orange-600 border border-orange-200' : 
                        `${pers ? "" : theme.bgLight + " " + theme.textPrimary}`}`} style={pers ? { ...st.bgLight, ...st.textPrimary } : {}}
                    >
                      {index + 1}º
                    </div>
                    
                    {/* Nome (Truncado para não estourar a tela) */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate pr-2">{pessoa.nome}</h3>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">Toque para ver o detalhe</p>
                    </div>

                    {/* Total e Seta */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-center justify-center">
                        <span className={`text-xl font-black ${pessoa.total >= 5 ? 'text-red-500' : (pers ? '' : theme.textPrimary)}`} style={pessoa.total < 5 && pers ? st.textPrimary : {}}>
                          {pessoa.total}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Vezes</span>
                      </div>
                      {membroExpandido === pessoa.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* GAVETINHA DE DETALHES (Só aparece se estiver clicado) */}
                  {membroExpandido === pessoa.id && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Divisão de Funções:</p>
                      <div className="space-y-1.5">
                        {Object.entries(pessoa.funcoesCount).map(([nomeFuncao, quantidade]) => (
                          <div key={nomeFuncao} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700 font-medium">{nomeFuncao}</span>
                            <span className={`font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-xs shadow-sm ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}}>
                              {quantidade}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}