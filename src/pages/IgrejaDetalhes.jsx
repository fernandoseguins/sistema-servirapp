// src/pages/IgrejaDetalhes.jsx
// Tela de detalhes de uma igreja (Painel do Dono). Rota: /igreja/:id
// Só super-admin acessa. Mostra informações e ações da igreja.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'
import { useUI } from '../context/UIContext'
import { TopBar } from '../components/ui'
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
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-warning" />
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-muted mb-3" />
        <p className="font-bold text-ink">Acesso restrito</p>
        <p className="text-sm text-muted mb-4">Esta área é exclusiva do dono do sistema.</p>
        <button onClick={() => navigate('/hub')} className="bg-brand text-on-brand font-bold px-5 py-2.5 rounded-xl active:scale-[0.97] transition">Voltar</button>
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
    <div className="min-h-screen bg-bg pb-20">
      <TopBar
        titulo={igreja.nome}
        subtitulo="Detalhes da igreja"
        onVoltar={() => navigate('/painel-dono')}
        icone={<span className="w-10 h-10 rounded-ctl flex items-center justify-center bg-brand/10 text-brand"><Crown className="w-5 h-5" aria-hidden="true" /></span>}
      />

      <div className="max-w-[720px] mx-auto px-4 pb-6 space-y-5">

        {/* Status + plano */}
        <div className="bg-surface rounded-2xl shadow-sm border border-line p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: igreja.cor_primaria || '#2563eb' }}>
                <Church className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${igreja.ativa ? 'text-success' : 'text-muted'}`}>
                    {igreja.ativa ? '● Ativa' : '○ Inativa'}
                  </span>
                  <span className="text-xs font-bold text-warning bg-warning-soft px-2 py-0.5 rounded-full uppercase">{igreja.plano || 'free'}</span>
                </div>
                <p className="text-xs text-muted mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Criada em {formatarData(igreja.criada_em)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
          {metricas.map((m, i) => (
            <div key={i} className="bg-surface rounded-2xl shadow-sm border border-line p-4 flex flex-col items-center text-center">
              <div className="text-warning mb-2">{m.icone}</div>
              <span className="text-2xl font-bold text-ink leading-none">{m.valor}</span>
              <span className="text-[11px] text-muted font-medium mt-1">{m.rotulo}</span>
            </div>
          ))}
        </div>

        {/* Código de convite */}
        <div className="bg-surface rounded-2xl shadow-sm border border-line p-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" /> Código de convite
          </p>
          <button onClick={copiarCodigo} className="w-full flex items-center justify-between bg-surface-2 hover:bg-surface-2 rounded-xl px-4 py-3 transition active:scale-[0.98]">
            <span className="font-mono font-bold text-lg text-ink tracking-widest">{igreja.codigo_convite}</span>
            <Copy className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Ações */}
        <div className="bg-surface rounded-2xl shadow-sm border border-line p-5 space-y-3">
          <p className="text-xs font-bold text-muted uppercase tracking-wide mb-1">Ações</p>

          <button onClick={() => navigate('/painel-dono')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:bg-brand/10 transition active:scale-[0.98] text-left">
            <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center flex-shrink-0"><UserCog className="w-5 h-5" /></div>
            <div>
              <p className="font-bold text-sm text-ink">Gerenciar admins</p>
              <p className="text-xs text-muted">Promover ou rebaixar admins no painel</p>
            </div>
          </button>

          <button onClick={toggleAtiva} className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:bg-surface-2 transition active:scale-[0.98] text-left">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${igreja.ativa ? 'bg-surface-2 text-ink-2' : 'bg-success-soft text-success'}`}>
              {igreja.ativa ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-bold text-sm text-ink">{igreja.ativa ? 'Desativar igreja' : 'Ativar igreja'}</p>
              <p className="text-xs text-muted">{igreja.ativa ? 'A igreja fica inacessível temporariamente' : 'Libera o acesso à igreja'}</p>
            </div>
          </button>
        </div>

        {/* Zona de perigo */}
        <div className="bg-danger-soft border border-danger/30 rounded-2xl p-5">
          <p className="text-xs font-bold text-danger uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Zona de perigo
          </p>
          <button
            onClick={apagarIgreja}
            disabled={apagando}
            className="w-full flex items-center justify-center gap-2 bg-danger hover:bg-danger text-on-danger font-bold py-3 rounded-xl transition active:scale-[0.97] disabled:opacity-60"
          >
            {apagando ? <><Loader2 className="w-5 h-5 animate-spin" /> Apagando...</> : <><Trash2 className="w-5 h-5" /> Apagar igreja permanentemente</>}
          </button>
          <p className="text-[11px] text-danger mt-2 text-center">Apaga a igreja e todos os seus dados. Não pode ser desfeito.</p>
        </div>

      </div>
    </div>
  )
}