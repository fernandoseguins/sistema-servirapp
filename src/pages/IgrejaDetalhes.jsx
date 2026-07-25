// src/pages/IgrejaDetalhes.jsx
// Tela de detalhes de uma igreja (Painel do Dono). Rota: /igreja/:id
// Só super-admin acessa. Mostra informações e ações da igreja.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'
import { useUI } from '../context/UIContext'
import PageHeader from '../components/PageHeader'
import {
  Crown, Church, Users, LayoutGrid, ShieldCheck, CalendarDays, Star,
  Copy, Power, PowerOff, Trash2, Loader2, Hash, Clock, UserCog
} from 'lucide-react'

export default function IgrejaDetalhes() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { toast, confirm } = useUI()

  const [autorizado, setAutorizado] = useState(null)
  const [igreja, setIgreja] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apagando, setApagando] = useState(false)

  useEffect(() => {
    async function checar() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: ehSuper } = await supabase.rpc('sou_super_admin_flag')
      const ok = !!user && ehSuper === true
      setAutorizado(ok)
      if (ok) carregar()
      else setLoading(false)
    }
    checar()
  }, [id])

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase.rpc('detalhes_igreja', { p_igreja_id: id })
    if (error || !data || data.length === 0) {
      console.error('Erro ao carregar detalhes da igreja:', error)
      toast.error('Não foi possível carregar a igreja. Tente novamente.')
      navigate('/painel-dono')
    } else {
      setIgreja(data[0])
    }
    setLoading(false)
  }

  function copiarCodigo() {
    navigator.clipboard.writeText(igreja.codigo_convite)
    toast.success('Código copiado!')
  }

  async function toggleAtiva() {
    const acao = igreja.ativa ? 'desativar' : 'ativar'
    if (!await confirm({
      title: `${igreja.ativa ? 'Desativar' : 'Ativar'} igreja`,
      message: `Tem certeza que deseja ${acao} "${igreja.nome}"?`,
      labelOk: igreja.ativa ? 'Desativar' : 'Ativar',
      danger: igreja.ativa,
    })) return

    const { error } = await supabase.from('igrejas').update({ ativa: !igreja.ativa }).eq('id', id)
    if (error) {
      console.error('Erro ao alterar status:', error)
      toast.error('Não foi possível alterar. Tente novamente.')
      return
    }
    setIgreja(prev => ({ ...prev, ativa: !prev.ativa }))
    toast.success(igreja.ativa ? 'Igreja desativada.' : 'Igreja ativada!')
  }

  async function apagarIgreja() {
    // Confirmação em duas etapas (ação destrutiva e irreversível)
    if (!await confirm({
      title: '⚠️ Apagar igreja permanentemente',
      message: `Isso vai APAGAR "${igreja.nome}" e TODOS os seus dados: departamentos, escalas, músicas, avisos e histórico. Os membros mantêm a conta, mas perdem o vínculo. Esta ação NÃO pode ser desfeita.`,
      labelOk: 'Continuar',
      labelCancel: 'Cancelar',
      danger: true,
    })) return

    // Segunda confirmação — digitar não, só reconfirmar mesmo
    if (!await confirm({
      title: 'Tem certeza absoluta?',
      message: `Última confirmação: apagar "${igreja.nome}" para sempre?`,
      labelOk: 'Sim, apagar tudo',
      labelCancel: 'Não',
      danger: true,
    })) return

    setApagando(true)
    const { error } = await supabase.rpc('apagar_igreja_completa', { p_igreja_id: id })
    if (error) {
      console.error('Erro ao apagar igreja:', error)
      toast.error('Não foi possível apagar a igreja. Tente novamente.')
      setApagando(false)
      return
    }
    toast.success('Igreja apagada.')
    navigate('/painel-dono')
  }

  function formatarData(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    } catch { return '—' }
  }

  // ── Guards ──────────────────────────────────────────────────────
  if (autorizado === null || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-gray-300 mb-3" />
        <p className="font-bold text-gray-700">Acesso restrito</p>
        <p className="text-sm text-gray-400 mb-4">Esta área é exclusiva do dono do sistema.</p>
        <button onClick={() => navigate('/hub')} className="bg-gray-900 text-white font-bold px-5 py-2.5 rounded-xl active:scale-[0.97] transition">Voltar</button>
      </div>
    )
  }

  if (!igreja) return null

  const metricas = [
    { icone: <Users className="w-5 h-5" />, valor: igreja.qtd_membros, rotulo: 'Membros' },
    { icone: <LayoutGrid className="w-5 h-5" />, valor: igreja.qtd_departamentos, rotulo: 'Departamentos' },
    { icone: <ShieldCheck className="w-5 h-5" />, valor: igreja.qtd_admins, rotulo: 'Admins' },
    { icone: <Star className="w-5 h-5" />, valor: igreja.qtd_lideres, rotulo: 'Líderes' },
    { icone: <CalendarDays className="w-5 h-5" />, valor: igreja.qtd_escalas, rotulo: 'Escalas' },
  ]

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <PageHeader
        title={igreja.nome}
        subtitle="Detalhes da igreja"
        icon={<Crown className="w-5 h-5" />}
        color="bg-gradient-to-br from-amber-500 to-orange-600"
      />

      <div className="max-w-2xl mx-auto px-4 space-y-5">

        {/* Status + plano */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: igreja.cor_primaria || '#2563eb' }}>
                <Church className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${igreja.ativa ? 'text-green-600' : 'text-gray-400'}`}>
                    {igreja.ativa ? '● Ativa' : '○ Inativa'}
                  </span>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase">{igreja.plano || 'free'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Criada em {formatarData(igreja.criada_em)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
          {metricas.map((m, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col items-center text-center">
              <div className="text-amber-500 mb-2">{m.icone}</div>
              <span className="text-2xl font-bold text-gray-900 leading-none">{m.valor}</span>
              <span className="text-[11px] text-gray-400 font-medium mt-1">{m.rotulo}</span>
            </div>
          ))}
        </div>

        {/* Código de convite */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" /> Código de convite
          </p>
          <button onClick={copiarCodigo} className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 transition active:scale-[0.98]">
            <span className="font-mono font-bold text-lg text-gray-800 tracking-widest">{igreja.codigo_convite}</span>
            <Copy className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Ações */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Ações</p>

          <button onClick={() => navigate('/painel-dono')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-blue-50 transition active:scale-[0.98] text-left">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0"><UserCog className="w-5 h-5" /></div>
            <div>
              <p className="font-bold text-sm text-gray-800">Gerenciar admins</p>
              <p className="text-xs text-gray-400">Promover ou rebaixar admins no painel</p>
            </div>
          </button>

          <button onClick={toggleAtiva} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition active:scale-[0.98] text-left">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${igreja.ativa ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-600'}`}>
              {igreja.ativa ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-800">{igreja.ativa ? 'Desativar igreja' : 'Ativar igreja'}</p>
              <p className="text-xs text-gray-400">{igreja.ativa ? 'A igreja fica inacessível temporariamente' : 'Libera o acesso à igreja'}</p>
            </div>
          </button>
        </div>

        {/* Zona de perigo */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Zona de perigo
          </p>
          <button
            onClick={apagarIgreja}
            disabled={apagando}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition active:scale-[0.97] disabled:opacity-60"
          >
            {apagando ? <><Loader2 className="w-5 h-5 animate-spin" /> Apagando...</> : <><Trash2 className="w-5 h-5" /> Apagar igreja permanentemente</>}
          </button>
          <p className="text-[11px] text-red-400 mt-2 text-center">Apaga a igreja e todos os seus dados. Não pode ser desfeito.</p>
        </div>

      </div>
    </div>
  )
}