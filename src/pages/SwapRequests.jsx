// src/pages/SwapRequests.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Check, X, Calendar, ChevronRight, MessageSquare, ArrowRightLeft } from 'lucide-react'
import { useUI } from '../context/UIContext'
import { getDeptTheme } from '../utils/departmentThemes'
import { enviarNotificacao } from '../utils/notificacoes'
import EmptyState from '../components/EmptyState'

function SwapSkeleton() {
  const P = ({ className }) => <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`} />
  return (
    <div className="space-y-4">
      {[1, 2].map(i => (
        <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4 animate-pulse">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <div className="space-y-2"><P className="h-3 w-20" /><P className="h-4 w-44" /></div>
            <P className="h-8 w-20 rounded-lg" />
          </div>
          <div className="flex items-center gap-3">
            <P className="w-10 h-10 rounded-full flex-shrink-0" />
            <P className="h-4 w-24 flex-1" />
            <P className="w-8 h-8 rounded-full flex-shrink-0" />
            <P className="h-4 w-24 flex-1" />
            <P className="w-10 h-10 rounded-full flex-shrink-0" />
          </div>
          <P className="h-10 w-full rounded-xl" />
          <div className="flex gap-3"><P className="h-11 flex-1 rounded-xl" /><P className="h-11 flex-1 rounded-xl" /></div>
        </div>
      ))}
    </div>
  )
}

function Avatar({ nome }) {
  const iniciais = nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
  const cores = ['bg-blue-100 text-blue-700','bg-purple-100 text-purple-700','bg-pink-100 text-pink-700','bg-green-100 text-green-700','bg-yellow-100 text-yellow-700','bg-orange-100 text-orange-700']
  const cor = cores[(nome?.charCodeAt(0) || 0) % cores.length]
  return (
    <div className={`w-10 h-10 ${cor} rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0`}>
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
  const [departamentoCor, setDepartamentoCor] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [pedidos,   setPedidos]   = useState([])
  const [avaliando, setAvaliando] = useState(null)

  const { toast, confirm } = useUI()
  const theme = getDeptTheme(departamentoNome, departamentoCor)
  const pers = theme.personalizado
  const st = theme.styles || {}

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
      queries.push(supabase.from('departamentos').select('nome, cor, icone').eq('id', departamentoId).single())
    }
    const [trocasRes, deptRes] = await Promise.all(queries)
    if (trocasRes.data) setPedidos(trocasRes.data)
    if (deptRes?.data) { setDepartamentoNome(deptRes.data.nome); setDepartamentoCor(deptRes.data.cor) }
    setLoading(false)
  }

  const notificar = (userId, titulo, mensagemTexto, tipo, linkInterno = null) =>
    enviarNotificacao({ userId, departamentoId, titulo, mensagem: mensagemTexto, tipo, link: linkInterno })

  async function avaliarTroca(pedido, aprovado) {
    if (!await confirm({
      title: `${aprovado ? 'Aprovar' : 'Rejeitar'} troca?`,
      message: `${pedido.requester_nome} → ${pedido.substitute_nome}`,
      danger: !aprovado, labelOk: aprovado ? 'Aprovar' : 'Rejeitar', labelCancel: 'Cancelar',
    })) return

    setAvaliando(pedido.id)
    try {
      // Aprovação/rejeição atômica no banco (uma única transação)
      const { data: funcoesTrocadas, error: erroTroca } = await supabase.rpc('responder_troca', { p_pedido_id: pedido.id, p_aprovar: aprovado })
      if (erroTroca) throw erroTroca

      if (aprovado) {
        const funcoesTrocadasStr = funcoesTrocadas || pedido.funcoes_alvo || ''
        await notificar(pedido.requester_id, 'Troca Aprovada!', `A sua troca com ${pedido.substitute_nome} (${funcoesTrocadasStr}) foi aprovada.`, 'escala', `/escala/${pedido.schedule_id}`)
        await notificar(pedido.substitute_id, 'Nova Convocação!', `Você assumiu a(s) função(ões) de ${funcoesTrocadasStr} no lugar de ${pedido.requester_nome}.`, 'escala', `/escala/${pedido.schedule_id}`)
      } else {
        await notificar(pedido.requester_id, 'Troca Rejeitada', `A sua solicitação de troca com ${pedido.substitute_nome} não foi aprovada.`, 'escala', `/escala/${pedido.schedule_id}`)
      }
      setPedidos(prev => prev.filter(p => p.id !== pedido.id))
      toast.success(`Troca ${aprovado ? 'aprovada' : 'rejeitada'} com sucesso!`)
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className={`${pers ? "" : theme.bgPrimary} px-4 py-6 rounded-b-3xl mb-6 text-white`} style={pers ? st.bgPrimary : {}}>
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} aria-label="Voltar" className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Central de Trocas</h1>
            <p className="text-white/70 text-xs mt-0.5">{departamentoNome}</p>
          </div>
          {!loading && pedidos.length > 0 && (
            <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-bold">
              {pedidos.length} pendente{pedidos.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {loading ? <SwapSkeleton /> : pedidos.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={<Check className="w-6 h-6" />} title="Tudo em ordem por aqui!" subtitle={`Nenhum pedido de troca pendente para ${departamentoNome}.`} variant="success" />
          </div>
        ) : (
          <div className="space-y-4">
            {pedidos.map(pedido => {
              const emAvaliacao = avaliando === pedido.id
              return (
                <div key={pedido.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Topo */}
                  <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-semibold capitalize">{formatarData(pedido.schedules?.data)}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-500">{pedido.schedules?.turno}</span>
                    </div>
                    <button onClick={() => navigate(`/escala/${pedido.schedule_id}`, { state: location.state })} className={`text-xs font-bold ${pers ? "" : theme.textPrimary} flex items-center gap-1 hover:underline`} style={pers ? st.textPrimary : {}}>
                      Ver escala <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Quem troca com quem */}
                    <div className="flex items-center gap-3">
                      <Avatar nome={pedido.requester_nome} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">Solicita saída</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{pedido.requester_nome}</p>
                      </div>
                      <div style={pers ? st.bgLight : {}} className={`w-8 h-8 rounded-full ${pers ? "" : theme.bgLight} flex items-center justify-center flex-shrink-0`}>
                        <ArrowRightLeft className={`w-3.5 h-3.5 ${pers ? "" : theme.textPrimary}`} style={pers ? st.textPrimary : {}} />
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-[10px] text-gray-400 font-medium">Substituto</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{pedido.substitute_nome}</p>
                      </div>
                      <Avatar nome={pedido.substitute_nome} />
                    </div>

                    {/* Função */}
                    <div style={pers ? st.bgLight : {}} className={`flex items-center gap-2 ${pers ? "" : theme.bgLight} rounded-xl px-4 py-2.5`}>
                      <span className="text-xs text-gray-500 font-medium flex-shrink-0">Função:</span>
                      <span style={pers ? st.textPrimary : {}} className={`text-xs font-bold ${pers ? "" : theme.textPrimary} truncate`}>{pedido.funcoes_alvo || 'Todas as funções'}</span>
                    </div>

                    {/* Motivo */}
                    {pedido.motivo && (
                      <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-700 italic leading-relaxed">"{pedido.motivo}"</p>
                      </div>
                    )}

                    {/* Botões */}
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => avaliarTroca(pedido, true)} disabled={!!avaliando}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50">
                        {emAvaliacao ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                        Aprovar
                      </button>
                      <button onClick={() => avaliarTroca(pedido, false)} disabled={!!avaliando}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 active:scale-[0.98] text-red-600 font-bold py-3 rounded-xl text-sm border border-red-100 transition-all disabled:opacity-50">
                        {emAvaliacao ? <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" /> : <X className="w-4 h-4" />}
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}