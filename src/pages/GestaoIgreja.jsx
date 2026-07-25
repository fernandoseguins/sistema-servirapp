// src/pages/GestaoIgreja.jsx
// Página dedicada à Gestão da Igreja — acessível apenas pelo Master Admin.
// Centraliza stats, aniversariantes e ferramentas administrativas.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader
        title="Gestão da Igreja"
        subtitle="Painel administrativo"
        icon={<Settings className="w-5 h-5" />}
        color="bg-blue-600"
      />

      <div className="max-w-md mx-auto px-4 space-y-5">

        {/* ── Mini stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={abrirListaMembros} className="bg-blue-600 rounded-2xl p-4 text-white text-left hover:bg-blue-700 active:scale-95 transition-all relative group">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-1">Membros ativos</p>
            <p className="text-2xl font-bold">{statsIgreja.membros}</p>
            <p className="text-[11px] text-blue-200 mt-0.5 flex items-center gap-1">
              ver e gerenciar <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </button>
          <div className="bg-gray-900 rounded-2xl p-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Escalas este mês</p>
            <p className="text-2xl font-bold">{statsIgreja.escalas}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">publicadas</p>
          </div>
        </div>

        {/* ── Aniversariantes ── */}
        {aniversariantes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-pink-50 border-b border-pink-100">
              <Cake className="w-4 h-4 text-pink-500" />
              <span className="text-xs font-bold text-pink-700 uppercase tracking-wider">
                Aniversariantes — {new Date().toLocaleString('pt-BR', { month: 'long' })}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {aniversariantes.map(p => {
                const [, , dia] = p.data_nascimento.split('-')
                const isHoje = parseInt(dia) === new Date().getDate()
                return (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${isHoje ? 'bg-pink-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {p.nome?.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate flex-1">{p.nome?.split(' ').slice(0,2).join(' ')}</p>
                    <p className={`text-xs font-bold ${isHoje ? 'text-pink-600' : 'text-gray-400'}`}>{isHoje ? '🎉 Hoje!' : `dia ${parseInt(dia)}`}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Comunicação ── */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Comunicação</p>
          <div className="space-y-2">
            <div onClick={() => navigate('/informativo')}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Informativo Geral</p>
                  <p className="text-[11px] text-gray-400">Gerar texto para WhatsApp</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-amber-400 flex-shrink-0" />
            </div>
            <div onClick={() => navigate('/aviso-geral')}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Enviar Aviso</p>
                  <p className="text-[11px] text-gray-400">Notificar membros do departamento</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0" />
            </div>
          </div>
        </div>

      </div>

      {/* Modal: Lista de Membros da Igreja */}
      {modalMembros && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center p-4 pt-[6vh]" onClick={() => setModalMembros(false)}>
          <div className="bg-white w-full max-w-lg rounded-3xl flex flex-col" style={{ maxHeight: '85dvh' }} onClick={e => e.stopPropagation()}>
            {/* Cabeçalho */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Membros da Igreja</h3>
                </div>
                <button onClick={() => setModalMembros(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaMembro}
                  onChange={e => setBuscaMembro(e.target.value)}
                  placeholder="Buscar membro..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto p-3" style={{ WebkitOverflowScrolling: 'touch' }}>
              {loadingMembros ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
                </div>
              ) : (() => {
                const filtrados = membros.filter(m => m.nome?.toLowerCase().includes(buscaMembro.toLowerCase()))
                if (filtrados.length === 0) {
                  return <p className="text-center text-gray-400 py-10 text-sm">{buscaMembro ? 'Nenhum membro encontrado.' : 'Nenhum membro ainda.'}</p>
                }
                return (
                  <div className="space-y-1.5">
                    {filtrados.map(membro => (
                      <div key={membro.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${membro.role === 'admin' ? 'bg-yellow-100 text-yellow-600' : membro.role === 'líder' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                          {membro.role === 'admin' ? <ShieldAlert className="w-4 h-4" /> : membro.role === 'líder' ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{membro.nome}</p>
                          <p className="text-[11px] text-gray-400 truncate">{membro.departamentos || 'Sem departamento'}</p>
                        </div>
                        <button
                          onClick={() => abrirGestaoLider(membro)}
                          className="p-2 text-blue-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition flex-shrink-0"
                          title="Gerenciar líder"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removerMembro(membro)}
                          className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                          title="Remover da igreja"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div className="p-4 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 text-center">{membros.length} membro(s) na igreja</p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Gerenciar líder de um membro */}
      {membroLider && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setMembroLider(null)}>
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">Liderança</h3>
                  <p className="text-xs text-gray-500 truncate">{membroLider.nome}</p>
                </div>
              </div>
              <button onClick={() => setMembroLider(null)} className="p-2 rounded-lg hover:bg-gray-100 transition" aria-label="Fechar">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingVinculos ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : vinculosMembro.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">Este membro não está em nenhum departamento.<br/>Adicione-o a um departamento primeiro.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400 px-1 pb-1">Toque para tornar líder de cada departamento:</p>
                  {vinculosMembro.map(vinculo => (
                    <button
                      key={vinculo.departamento_id}
                      onClick={() => alternarLider(vinculo)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition ${
                        vinculo.role === 'líder'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 bg-gray-50 hover:border-blue-200'
                      }`}
                    >
                      <span className="text-sm font-bold text-gray-800">{vinculo.departamento_nome}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1 ${
                        vinculo.role === 'líder' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
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