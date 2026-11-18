// src/pages/SwapRequests.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Check, X, Calendar, ChevronRight, MessageSquare, ArrowRightLeft } from 'lucide-react'
import { useUI } from '../context/UIContext'
import { enviarNotificacao } from '../utils/notificacoes'
import { rotuloTurno } from '../utils/escalas'
import { TopBar, Button, Card, Pill, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'

// Textos das notificações (mesmo padrão de ScheduleDetails.jsx):
// "Louvor · 16/11 (Culto da noite)", primeiro nome e funções "Violão e Teclado".
const primeiroNome = (nome) => (nome || '').trim().split(/\s+/)[0] || ''
const separarFuncoes = (texto) => (texto || '').split(/[+/]/).map(f => f.trim()).filter(Boolean)
const juntarFuncoes = (lista) => lista.length <= 1 ? (lista[0] || '') : `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`
const dataCurta = (iso) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : ''

function SwapSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {[1, 2].map(i => <div key={i} className="h-56 bg-surface-2 rounded-card animate-pulse" />)}
    </div>
  )
}

function Avatar({ nome }) {
  const iniciais = nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
  return (
    <div className="w-10 h-10 bg-brand/10 text-brand rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" aria-hidden="true">
      {iniciais}
    </div>
  )
}

export default function SwapRequests() {
  const navigate = useNavigate()
  const location = useLocation()
  const params   = useParams()

  const departamentoId = params.id || location.state?.departamentoId
  const [departamentoNome, setDepartamentoNome] = useState(location.state?.departamentoNome || '')
  const [loading,   setLoading]   = useState(true)
  const [pedidos,   setPedidos]   = useState([])
  const [avaliando, setAvaliando] = useState(null)

  const { toast, confirm } = useUI()

  useEffect(() => {
    if (!departamentoId) { navigate('/hub'); return }
    buscarPedidos()
  }, [departamentoId])

  async function buscarPedidos() {
    setLoading(true)
    const queries = [
      supabase.from('swap_requests')
        .select('*, schedules!inner(id, data, turno, departamento_id, departamentos(nome))')
        .eq('status', 'pendente')
        .eq('schedules.departamento_id', departamentoId),
    ]
    if (!departamentoNome) {
      queries.push(supabase.from('departamentos').select('nome').eq('id', departamentoId).single())
    }
    const [trocasRes, deptRes] = await Promise.all(queries)
    if (trocasRes.data) setPedidos(trocasRes.data)
    if (deptRes?.data) setDepartamentoNome(deptRes.data.nome)
    setLoading(false)
  }

  const notificar = (userId, titulo, mensagemTexto, tipo, linkInterno = null) =>
    enviarNotificacao({ userId, departamentoId, titulo, mensagem: mensagemTexto, tipo, link: linkInterno })

  async function avaliarTroca(pedido, aprovado) {
    if (!await confirm({
      title: `${aprovado ? 'Aprovar' : 'Recusar'} troca?`,
      message: `${pedido.requester_nome} → ${pedido.substitute_nome}`,
      danger: !aprovado, labelOk: aprovado ? 'Aprovar' : 'Recusar', labelCancel: 'Cancelar',
    })) return

    setAvaliando(pedido.id)
    try {
      // Aprovação/rejeição atômica no banco (uma única transação)
      const { data: funcoesTrocadas, error: erroTroca } = await supabase.rpc('responder_troca', { p_pedido_id: pedido.id, p_aprovar: aprovado })
      if (erroTroca) throw erroTroca

      // Mesmos textos de ScheduleDetails.jsx (avaliarTroca)
      const esc = pedido.schedules || {}
      const ctxTroca = [esc.departamentos?.nome || departamentoNome, `${dataCurta(esc.data)} (${rotuloTurno(esc.turno)})`].filter(Boolean).join(' · ')
      const funcoesDaTroca = juntarFuncoes(separarFuncoes(funcoesTrocadas || pedido.funcoes_alvo)) || 'a função'
      if (aprovado) {
        await notificar(pedido.requester_id, '✅ Troca aprovada', `${ctxTroca} — ${primeiroNome(pedido.substitute_nome)} assume ${funcoesDaTroca} no seu lugar.`, 'escala', `/escala/${pedido.schedule_id}`)
        await notificar(pedido.substitute_id, '📅 Você entrou na escala', `${ctxTroca} — você assume ${funcoesDaTroca} no lugar de ${primeiroNome(pedido.requester_nome)}.`, 'escala', `/escala/${pedido.schedule_id}`)
      } else {
        await notificar(pedido.requester_id, '❌ Troca rejeitada', `${ctxTroca} — o líder não aprovou passar ${funcoesDaTroca} para ${primeiroNome(pedido.substitute_nome)}.`, 'escala', `/escala/${pedido.schedule_id}`)
      }
      setPedidos(prev => prev.filter(p => p.id !== pedido.id))
      toast.success(`Troca ${aprovado ? 'aprovada' : 'recusada'}.`)
    } catch (err) {
      (() => { console.error('Erro ao processar troca:', err); toast.error(err?.code === 'P0001' ? err.message : 'Não foi possível processar a troca. Tente novamente.') })()
    } finally {
      setAvaliando(null)
    }
  }

  function formatarData(dataString) {
    if (!dataString) return ''
    return new Date(dataString + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Trocas"
        subtitulo={departamentoNome}
        onVoltar={() => navigate(-1)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome).chip}`}>
          <IconeDept nome={departamentoNome} className="w-5 h-5" />
        </span>}
        acoes={!loading && pedidos.length > 0 && (
          <Pill tom="aviso">{pedidos.length} pendente{pedidos.length > 1 ? 's' : ''}</Pill>
        )}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6">
        {loading ? <SwapSkeleton /> : pedidos.length === 0 ? (
          <Card>
            <EmptyState icon={<Check className="w-6 h-6" aria-hidden="true" />} titulo="Nenhum pedido de troca"
              texto={departamentoNome ? `Não há trocas pendentes em ${departamentoNome}.` : 'Não há trocas pendentes.'} />
          </Card>
        ) : (
          <div className="space-y-4">
            {pedidos.map(pedido => {
              const emAvaliacao = avaliando === pedido.id
              return (
                <Card key={pedido.id} padded={false} className="overflow-hidden">
                  <div className="flex justify-between items-center gap-2 px-4 py-3 border-b border-line bg-surface-2">
                    <div className="flex items-center gap-2 text-ink-2 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-muted flex-shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold capitalize truncate">{formatarData(pedido.schedules?.data)}</span>
                      <span className="text-muted" aria-hidden="true">·</span>
                      <span className="text-xs">{pedido.schedules?.turno}</span>
                    </div>
                    <button type="button" onClick={() => navigate(`/escala/${pedido.schedule_id}`, { state: location.state })}
                      className="text-xs font-bold text-brand flex items-center gap-1 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand flex-shrink-0">
                      Ver escala <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Quem troca com quem */}
                    <div className="flex items-center gap-3">
                      <Avatar nome={pedido.requester_nome} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted">Sai</p>
                        <p className="text-sm font-bold text-ink truncate">{pedido.requester_nome}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-brand" aria-label="troca com" />
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-[11px] text-muted">Entra</p>
                        <p className="text-sm font-bold text-ink truncate">{pedido.substitute_nome}</p>
                      </div>
                      <Avatar nome={pedido.substitute_nome} />
                    </div>

                    <div className="flex items-center gap-2 bg-brand/10 rounded-ctl px-3 py-2.5">
                      <span className="text-xs text-ink-2 flex-shrink-0">Função:</span>
                      <span className="text-xs font-bold text-brand truncate">{pedido.funcoes_alvo || 'Todas as funções'}</span>
                    </div>

                    {pedido.motivo && (
                      <div className="flex gap-2 bg-warning-soft rounded-ctl px-3 py-2.5">
                        <MessageSquare className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="text-xs text-ink italic leading-relaxed">"{pedido.motivo}"</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button className="flex-1" onClick={() => avaliarTroca(pedido, true)} disabled={!!avaliando}
                        loading={emAvaliacao} icon={<Check className="w-4 h-4" aria-hidden="true" />}>
                        Aprovar
                      </Button>
                      <Button variant="perigo" className="flex-1" onClick={() => avaliarTroca(pedido, false)} disabled={!!avaliando}
                        loading={emAvaliacao} icon={<X className="w-4 h-4" aria-hidden="true" />}>
                        Recusar
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
