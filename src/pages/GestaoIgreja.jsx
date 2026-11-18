// src/pages/GestaoIgreja.jsx
// Página dedicada à Gestão da Igreja — acessível apenas pelo Master Admin.
// Centraliza stats, aniversariantes e ferramentas administrativas.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/ui'
import {
  Settings, FileText, ArrowRight, Megaphone, Cake,
  Users, X, Trash2, Search, Shield, ShieldAlert, User as UserIcon, Loader2,
} from 'lucide-react'
import { useUI } from '../context/UIContext'
import { dataLocalISO } from '../utils/datas'


export default function GestaoIgreja() {
  const navigate = useNavigate()
  const { toast, confirm } = useUI()

  const [aniversariantes,   setAniversariantes]   = useState([])
  const [statsIgreja,       setStatsIgreja]        = useState({ membros: 0, escalas: 0 })
  const [loading,           setLoading]           = useState(true)
  const [modalMembros,      setModalMembros]      = useState(false)
  const [membros,           setMembros]           = useState([])
  const [loadingMembros,    setLoadingMembros]    = useState(false)
  const [buscaMembro,       setBuscaMembro]       = useState('')
  const [membroLider,       setMembroLider]       = useState(null)  // membro selecionado p/ gerir líder
  const [vinculosMembro,    setVinculosMembro]    = useState([])
  const [loadingVinculos,   setLoadingVinculos]   = useState(false)

  useEffect(() => {
    verificarAcessoEBuscarDados()
  }, [])

  // Abre o modal e carrega os membros da igreja
  async function abrirListaMembros() {
    setModalMembros(true)
    setLoadingMembros(true)
    const { data, error } = await supabase.rpc('listar_membros_igreja')
    if (error) (() => { console.error('Erro ao carregar membros:', error); toast.error('Não foi possível carregar os membros. Tente novamente.') })()
    else setMembros(data || [])
    setLoadingMembros(false)
  }

  // Remove um membro da igreja (com confirmação)
  // Abre o sub-modal para gerir líder de um membro
  async function abrirGestaoLider(membro) {
    setMembroLider(membro)
    setLoadingVinculos(true)
    const { data, error } = await supabase.rpc('vinculos_do_membro', { p_user_id: membro.id })
    if (error) {
      console.error('Erro ao carregar vínculos:', error)
      toast.error('Não foi possível carregar os departamentos. Tente novamente.')
      setMembroLider(null)
    } else {
      setVinculosMembro(data || [])
    }
    setLoadingVinculos(false)
  }

  async function alternarLider(vinculo) {
    const tornarLider = vinculo.role !== 'líder'
    const { error } = await supabase.rpc('definir_lider_departamento', {
      p_user_id: membroLider.id,
      p_departamento_id: vinculo.departamento_id,
      p_tornar_lider: tornarLider,
    })
    if (error) {
      console.error('Erro ao alterar líder:', error)
      toast.error('Não foi possível alterar. Tente novamente.')
      return
    }
    toast.success(tornarLider ? `${membroLider.nome.split(' ')[0]} agora é líder de ${vinculo.departamento_nome}!` : 'Líder rebaixado.')
    setVinculosMembro(prev => prev.map(v => v.departamento_id === vinculo.departamento_id ? { ...v, role: tornarLider ? 'líder' : 'membro' } : v))
  }

  async function removerMembro(membro) {
    const ok = await confirm({
      title: 'Remover da igreja',
      message: `Remover "${membro.nome}" da igreja? A pessoa perde acesso a tudo (departamentos, escalas). Esta ação não pode ser desfeita pelo app.`,
      danger: true, labelOk: 'Remover', labelCancel: 'Cancelar'
    })
    if (!ok) return

    const { error } = await supabase.rpc('remover_membro_da_igreja', { p_user_id: membro.id })
    if (error) {
      (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
    } else {
      toast.success(`${membro.nome} foi removido(a) da igreja.`)
      setMembros(prev => prev.filter(m => m.id !== membro.id))
      // Atualiza o contador de membros
      setStatsIgreja(prev => ({ ...prev, membros: Math.max(0, prev.membros - 1) }))
    }
  }

  async function verificarAcessoEBuscarDados() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }

    // Verifica se é master admin
    const { data: depts } = await supabase
      .from('membros_departamentos')
      .select('role, departamentos ( id, nome )')
      .eq('user_id', user.id)

    const { data: ehSecretariaVip } = await supabase.rpc('sou_super_admin_flag')
    const ehAdmin = depts ? depts.some(d => d.role === 'admin') : false

    if (!ehSecretariaVip && !ehAdmin) {
      // Sem permissão — volta para o hub
      navigate('/hub')
      return
    }

    await buscarDadosGestao()
    setLoading(false)
  }

  async function buscarDadosGestao() {
    const mesAtualNum = new Date().getMonth() + 1

    // Aniversariantes do mês atual
    const { data: perfis } = await supabase
      .from('users_profile')
      .select('id, nome, data_nascimento')
      .not('data_nascimento', 'is', null)

    if (perfis) {
      const anivMes = perfis
        .filter(p => parseInt(p.data_nascimento?.split('-')[1]) === mesAtualNum)
        .sort((a, b) => parseInt(a.data_nascimento?.split('-')[2]) - parseInt(b.data_nascimento?.split('-')[2]))
        .slice(0, 5)
      setAniversariantes(anivMes)
    }

    // Mini stats
    const primeiroDiaMes = dataLocalISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

    const [membrosRes, escalasRes] = await Promise.all([
      // ✅ Conta PESSOAS únicas (perfis), não vínculos — quem está em vários depts conta 1x
      supabase.from('users_profile').select('*', { count: 'exact', head: true }),
      supabase.from('schedules').select('*', { count: 'exact', head: true })
        .eq('status', 'Publicada')
        .gte('data', primeiroDiaMes),
    ])
    setStatsIgreja({
      membros: membrosRes.count ?? 0,
      escalas: escalasRes.count ?? 0,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      <TopBar
        titulo="Gestão da igreja"
        subtitulo="Painel administrativo"
        onVoltar={() => navigate('/hub')}
        icone={<span className="w-10 h-10 rounded-ctl flex items-center justify-center bg-brand/10 text-brand"><Settings className="w-5 h-5" aria-hidden="true" /></span>}
      />

      <div className="max-w-[720px] mx-auto px-4 pb-6 space-y-5">

        {/* ── Mini stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={abrirListaMembros} className="bg-topo rounded-card p-4 text-white text-left hover:opacity-90 active:scale-95 transition-all relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <p className="text-[11px] font-semibold text-white/80 mb-1">Membros ativos</p>
            <p className="text-2xl font-bold">{statsIgreja.membros}</p>
            <p className="text-[11px] text-white/80 mt-0.5 flex items-center gap-1">
              ver e gerenciar <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </button>
          <div className="bg-surface border border-line rounded-card p-4 text-ink">
            <p className="text-[11px] font-semibold text-ink-2 mb-1">Escalas este mês</p>
            <p className="text-2xl font-bold">{statsIgreja.escalas}</p>
            <p className="text-[11px] text-ink-2 mt-0.5">publicadas</p>
          </div>
        </div>

        {/* ── Aniversariantes ── */}
        {aniversariantes.length > 0 && (
          <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-accent/10 border-b border-accent/30">
              <Cake className="w-4 h-4 text-accent-ink" />
              <span className="text-xs font-bold text-accent-ink uppercase tracking-wider">
                Aniversariantes — {new Date().toLocaleString('pt-BR', { month: 'long' })}
              </span>
            </div>
            <div className="divide-y divide-line">
              {aniversariantes.map(p => {
                const [, , dia] = p.data_nascimento.split('-')
                const isHoje = parseInt(dia) === new Date().getDate()
                return (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${isHoje ? 'bg-accent/10' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-accent/10 text-accent-ink flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {p.nome?.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-ink truncate flex-1">{p.nome?.split(' ').slice(0,2).join(' ')}</p>
                    <p className={`text-xs font-bold ${isHoje ? 'text-accent-ink' : 'text-muted'}`}>{isHoje ? '🎉 Hoje!' : `dia ${parseInt(dia)}`}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Comunicação ── */}
        <div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 px-1">Comunicação</p>
          <div className="space-y-2">
            <button type="button" onClick={() => navigate('/informativo')}
              className="w-full text-left bg-surface p-4 rounded-card border border-line hover:border-warning/30 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="bg-warning-soft p-2.5 rounded-xl text-warning group-hover:bg-warning group-hover:text-on-brand transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">Informativo Geral</p>
                  <p className="text-[11px] text-muted">Gerar texto para WhatsApp</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted group-hover:text-warning flex-shrink-0" />
            </button>
            <button type="button" onClick={() => navigate('/aviso-geral')}
              className="w-full text-left bg-surface p-4 rounded-card border border-line hover:border-brand/30 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="bg-brand/10 p-2.5 rounded-xl text-brand group-hover:bg-brand group-hover:text-on-brand transition-colors">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">Enviar Aviso</p>
                  <p className="text-[11px] text-muted">Notificar membros do departamento</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted group-hover:text-brand flex-shrink-0" />
            </button>
          </div>
        </div>

      </div>

      {/* Modal: Lista de Membros da Igreja */}
      {modalMembros && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[6vh]">
          <button type="button" tabIndex={-1} aria-label="Fechar" className="absolute inset-0 bg-black/40 cursor-default" onClick={() => setModalMembros(false)} />
          <div role="dialog" aria-modal="true" className="relative bg-surface w-full max-w-lg rounded-3xl flex flex-col" style={{ maxHeight: '85dvh' }}>
            {/* Cabeçalho */}
            <div className="p-5 border-b border-line">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-ink">Membros da Igreja</h3>
                </div>
                <button onClick={() => setModalMembros(false)} className="p-2 hover:bg-surface-2 rounded-lg"><X className="w-5 h-5 text-muted" /></button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaMembro}
                  onChange={e => setBuscaMembro(e.target.value)}
                  placeholder="Buscar membro..."
                  className="w-full bg-surface-2 border border-line rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto p-3" style={{ WebkitOverflowScrolling: 'touch' }}>
              {loadingMembros ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand" />
                </div>
              ) : (() => {
                const filtrados = membros.filter(m => m.nome?.toLowerCase().includes(buscaMembro.toLowerCase()))
                if (filtrados.length === 0) {
                  return <p className="text-center text-muted py-10 text-sm">{buscaMembro ? 'Nenhum membro encontrado.' : 'Nenhum membro ainda.'}</p>
                }
                return (
                  <div className="space-y-1.5">
                    {filtrados.map(membro => (
                      <div key={membro.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 transition">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${membro.role === 'admin' ? 'bg-warning-soft text-warning' : membro.role === 'líder' ? 'bg-brand/10 text-brand' : 'bg-surface-2 text-ink-2'}`}>
                          {membro.role === 'admin' ? <ShieldAlert className="w-4 h-4" /> : membro.role === 'líder' ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-ink truncate">{membro.nome}</p>
                          <p className="text-[11px] text-muted truncate">{membro.departamentos || 'Sem departamento'}</p>
                        </div>
                        <button
                          onClick={() => abrirGestaoLider(membro)}
                          className="p-2 text-brand hover:text-brand hover:bg-brand/10 rounded-lg transition flex-shrink-0"
                          aria-label="Gerenciar líder"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removerMembro(membro)}
                          className="p-2 text-danger hover:text-danger hover:bg-danger-soft rounded-lg transition flex-shrink-0"
                          aria-label="Remover da igreja"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div className="p-4 border-t border-line">
              <p className="text-[11px] text-muted text-center">{membros.length} membro(s) na igreja</p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Gerenciar líder de um membro */}
      {membroLider && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
          <button type="button" tabIndex={-1} aria-label="Fechar" className="absolute inset-0 bg-black/50 cursor-default" onClick={() => setMembroLider(null)} />
          <div role="dialog" aria-modal="true" className="relative bg-surface rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-ink truncate">Liderança</h3>
                  <p className="text-xs text-ink-2 truncate">{membroLider.nome}</p>
                </div>
              </div>
              <button onClick={() => setMembroLider(null)} className="p-2 rounded-lg hover:bg-surface-2 transition" aria-label="Fechar">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingVinculos ? (
                <div className="flex items-center justify-center py-10 text-muted">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : vinculosMembro.length === 0 ? (
                <p className="text-center text-muted text-sm py-10">Este membro não está em nenhum departamento.<br/>Adicione-o a um departamento primeiro.</p>
              ) : (
                <>
                  <p className="text-xs text-muted px-1 pb-1">Toque para tornar líder de cada departamento:</p>
                  {vinculosMembro.map(vinculo => (
                    <button
                      key={vinculo.departamento_id}
                      onClick={() => alternarLider(vinculo)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition ${
                        vinculo.role === 'líder'
                          ? 'border-brand bg-brand/10'
                          : 'border-line bg-surface-2 hover:border-brand/30'
                      }`}
                    >
                      <span className="text-sm font-bold text-ink">{vinculo.departamento_nome}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1 ${
                        vinculo.role === 'líder' ? 'bg-brand text-on-brand' : 'bg-line text-ink-2'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {vinculo.role === 'líder' ? 'Líder' : 'Tornar líder'}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}