// src/pages/FrequencyReport.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { BarChart3, CalendarDays, TrendingUp, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TopBar, Card, Pill, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'

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

  useEffect(() => {
    if (!departamentoId) {
      navigate('/hub')
      return
    }
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

  const maiorTotal = relatorio[0]?.total || 1
  const corMedalha = (i) => i === 0 ? 'bg-warning-soft text-warning' : i === 1 ? 'bg-surface-2 text-ink-2' : i === 2 ? 'bg-accent/15 text-accent-ink' : 'bg-brand/10 text-brand'

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Frequência"
        subtitulo={departamentoNome}
        onVoltar={() => navigate(-1)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome).chip}`}>
          <IconeDept nome={departamentoNome} className="w-5 h-5" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">

        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-ctl bg-brand/10 text-brand">
              <CalendarDays className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] text-ink-2">Mês</p>
              <p className="text-sm font-bold text-ink" aria-live="polite">{nomesMeses[mesAtual]} {anoAtual}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={mesAnterior} aria-label="Mês anterior"
              className="p-2 rounded-ctl text-ink-2 hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={proximoMes} aria-label="Próximo mês"
              className="p-2 rounded-ctl text-ink-2 hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </Card>

        <section>
          <h2 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand" aria-hidden="true" /> Quem mais serviu no mês
          </h2>

          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-2 rounded-card animate-pulse" />)}
            </div>
          ) : relatorio.length === 0 ? (
            <Card>
              <EmptyState icon={<BarChart3 className="w-6 h-6" aria-hidden="true" />} titulo="Ninguém escalado neste mês" texto="Troque o mês para ver outro período." />
            </Card>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <ul>
                {relatorio.map((pessoa, index) => {
                  const aberto = membroExpandido === pessoa.id
                  return (
                    <li key={pessoa.id} className="border-b border-line last:border-b-0">
                      <button type="button" onClick={() => toggleMembro(pessoa.id)} aria-expanded={aberto}
                        className="w-full p-4 flex items-center gap-3 text-left hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                        <span className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full font-black text-base ${corMedalha(index)}`}
                          aria-label={`${index + 1}º lugar`}>
                          {index + 1}º
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-ink truncate">{pessoa.nome}</span>
                          <span className="block h-1.5 mt-2 rounded-full bg-surface-2 overflow-hidden" aria-hidden="true">
                            <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round(pessoa.total / maiorTotal * 100)}%` }} />
                          </span>
                        </span>
                        <span className="flex flex-col items-center shrink-0">
                          <span className={`text-xl font-black ${pessoa.total >= 5 ? 'text-danger' : 'text-brand'}`}>{pessoa.total}</span>
                          <span className="text-[10px] text-ink-2">{pessoa.total === 1 ? 'vez' : 'vezes'}</span>
                        </span>
                        {aberto ? <ChevronUp className="w-5 h-5 text-muted shrink-0" aria-hidden="true" /> : <ChevronDown className="w-5 h-5 text-muted shrink-0" aria-hidden="true" />}
                      </button>

                      {aberto && (
                        <div className="bg-surface-2 px-4 py-3">
                          <p className="text-xs font-semibold text-ink-2 mb-2">Por função</p>
                          <ul className="space-y-1.5">
                            {Object.entries(pessoa.funcoesCount).map(([nomeFuncao, quantidade]) => (
                              <li key={nomeFuncao} className="flex justify-between items-center text-sm">
                                <span className="text-ink">{nomeFuncao}</span>
                                <Pill tom="brand">{quantidade}x</Pill>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </section>
      </main>
    </div>
  )
}
