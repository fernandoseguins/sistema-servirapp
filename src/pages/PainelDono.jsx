// src/pages/PainelDono.jsx
// Painel do Dono — área EXCLUSIVA do super admin para gerenciar todas as igrejas.
// Rota: /painel-dono (protegida por email no App + na própria tela)

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../context/UIContext'
import {
  Crown, ArrowLeft, Plus, Copy, Church, Users, LayoutGrid,
  Power, PowerOff, Search, CheckCircle2, XCircle, Shield, UserCog, X, Loader2
} from 'lucide-react'


export default function PainelDono() {
  const navigate = useNavigate()
  const { toast, confirm } = useUI()

  const [autorizado, setAutorizado] = useState(null)
  const [igrejas, setIgrejas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  // Modal de gestão de admins
  const [igrejaAdmins, setIgrejaAdmins] = useState(null)  // igreja selecionada
  const [membros, setMembros] = useState([])
  const [carregandoMembros, setCarregandoMembros] = useState(false)
  const [buscaMembro, setBuscaMembro] = useState('')

  // ── Verifica super admin ──────────────────────────────────────────
  useEffect(() => {
    async function checar() {
      const { data: { user } } = await supabase.auth.getUser()
      // Verifica super-admin pela flag no banco (não por email hardcoded)
      const { data: ehSuper } = await supabase.rpc('sou_super_admin_flag')
      const ok = !!user && ehSuper === true
      setAutorizado(ok)
      if (ok) carregarIgrejas()
      else setLoading(false)
    }
    checar()
  }, [])

  async function carregarIgrejas() {
    setLoading(true)
    const { data, error } = await supabase.rpc('listar_igrejas_painel')
    if (error) {
      (() => { console.error('Erro ao carregar igrejas:', error); toast.error('Não foi possível carregar as igrejas. Tente novamente.') })()
    } else {
      setIgrejas(data || [])
    }
    setLoading(false)
  }

  async function toggleAtiva(igreja) {
    const acao = igreja.ativa ? 'desativar' : 'ativar'
    const ok = await confirm({
      title: `${acao === 'ativar' ? 'Ativar' : 'Desativar'} igreja`,
      message: `Tem certeza que deseja ${acao} "${igreja.nome}"?`,
      labelOk: acao === 'ativar' ? 'Ativar' : 'Desativar',
      labelCancel: 'Cancelar'
    })
    if (!ok) return

    const { error } = await supabase
      .from('igrejas')
      .update({ ativa: !igreja.ativa })
      .eq('id', igreja.id)

    if (error) {
      (() => { console.error('Erro ao alterar igreja:', error); toast.error('Não foi possível alterar. Tente novamente.') })()
    } else {
      toast.success(`Igreja ${acao === 'ativar' ? 'ativada' : 'desativada'}!`)
      carregarIgrejas()
    }
  }

  function copiarCodigo(codigo) {
    navigator.clipboard.writeText(codigo)
    toast.success('Código copiado!')
  }

  const igrejasFiltradas = igrejas.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    i.codigo_convite.toLowerCase().includes(busca.toLowerCase())
  )

  // ── Gestão de admins de uma igreja ──────────────────────────────
  async function abrirGestaoAdmins(igreja) {
    setIgrejaAdmins(igreja)
    setBuscaMembro('')
    setCarregandoMembros(true)
    const { data, error } = await supabase.rpc('listar_membros_da_igreja', { p_igreja_id: igreja.id })
    if (error) {
      console.error('Erro ao listar membros:', error)
      toast.error('Não foi possível carregar os membros. Tente novamente.')
      setIgrejaAdmins(null)
    } else {
      setMembros(data || [])
    }
    setCarregandoMembros(false)
  }

  async function alternarAdmin(membro) {
    const tornarAdmin = membro.role !== 'admin'
    const acao = tornarAdmin ? 'promover a admin' : 'rebaixar para membro'

    // Se está rebaixando, verifica se é o último admin da igreja (aviso extra)
    let mensagem = `Deseja ${acao} "${membro.nome}"?`
    if (!tornarAdmin) {
      const qtdAdmins = membros.filter(m => m.role === 'admin').length
      if (qtdAdmins <= 1) {
        mensagem = `"${membro.nome}" é o ÚNICO admin desta igreja. Se rebaixar, a igreja ficará sem nenhum admin até você definir outro. Deseja continuar?`
      }
    }

    if (!await confirm({
      title: tornarAdmin ? 'Promover a admin' : 'Rebaixar admin',
      message: mensagem,
      labelOk: tornarAdmin ? 'Promover' : 'Rebaixar',
      danger: !tornarAdmin,
    })) return

    const { error } = await supabase.rpc('definir_admin_igreja', {
      p_user_id: membro.id,
      p_tornar_admin: tornarAdmin,
    })
    if (error) {
      console.error('Erro ao alterar admin:', error)
      toast.error('Não foi possível alterar. Tente novamente.')
      return
    }
    toast.success(tornarAdmin ? `${membro.nome.split(' ')[0]} agora é admin!` : 'Admin rebaixado.')
    // Atualiza a lista local
    setMembros(prev => prev.map(m => m.id === membro.id ? { ...m, role: tornarAdmin ? 'admin' : 'membro' } : m))
  }

  const membrosFiltrados = membros.filter(m =>
    m.nome?.toLowerCase().includes(buscaMembro.toLowerCase()) ||
    m.email?.toLowerCase().includes(buscaMembro.toLowerCase())
  )

  const totalMembros = igrejas.reduce((s, i) => s + Number(i.qtd_membros), 0)
  const totalAtivas = igrejas.filter(i => i.ativa).length

  // ── Guards ────────────────────────────────────────────────────────
  if (autorizado === null || (loading && autorizado)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500" />
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
        <Crown className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Acesso restrito</h1>
        <p className="text-gray-500 mb-6">Esta área é exclusiva do administrador do sistema.</p>
        <button onClick={() => navigate('/hub')} className="bg-blue-600 text-white font-bold rounded-xl py-3 px-8 hover:bg-blue-700 transition">
          Voltar ao início
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white px-4 py-6 rounded-b-3xl shadow-lg mb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/hub')} className="p-2 rounded-lg hover:bg-white/20 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6" />
              <h1 className="text-xl font-bold">Painel do Dono</h1>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{igrejas.length}</p>
              <p className="text-[11px] opacity-90">Igrejas</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{totalAtivas}</p>
              <p className="text-[11px] opacity-90">Ativas</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{totalMembros}</p>
              <p className="text-[11px] opacity-90">Membros</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4">
        {/* Ações topo */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou código..."
              className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <button
            onClick={() => navigate('/criar-igreja')}
            className="bg-amber-500 text-white font-bold rounded-xl px-4 hover:bg-amber-600 transition flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Plus className="w-5 h-5" /> Nova
          </button>
        </div>

        {/* Lista de igrejas */}
        {igrejasFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <Church className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{busca ? 'Nenhuma igreja encontrada.' : 'Nenhuma igreja ainda.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {igrejasFiltradas.map(igreja => (
              <div key={igreja.id} className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${igreja.ativa ? 'border-green-400' : 'border-gray-300 opacity-70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => navigate(`/igreja/${igreja.id}`)} className="flex items-center gap-3 min-w-0 text-left active:scale-[0.98] transition flex-1">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: igreja.cor_primaria || '#2563eb' }}
                    >
                      <Church className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{igreja.nome}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {igreja.ativa
                          ? <span className="flex items-center gap-1 text-[10px] font-bold text-green-600"><CheckCircle2 className="w-3 h-3" /> Ativa</span>
                          : <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><XCircle className="w-3 h-3" /> Inativa</span>
                        }
                        <span className="text-[10px] text-gray-400 uppercase font-bold">{igreja.plano}</span>
                      </div>
                    </div>
                  </button>

                  {/* Botão ativar/desativar */}
                  <button
                    onClick={() => toggleAtiva(igreja)}
                    className={`p-2 rounded-lg transition flex-shrink-0 ${igreja.ativa ? 'text-gray-400 hover:bg-red-50 hover:text-red-500' : 'text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                    title={igreja.ativa ? 'Desativar' : 'Ativar'}
                  >
                    {igreja.ativa ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                  </button>
                </div>

                {/* Métricas + código */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {igreja.qtd_membros}</span>
                    <span className="flex items-center gap-1"><LayoutGrid className="w-3.5 h-3.5" /> {igreja.qtd_departamentos}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => abrirGestaoAdmins(igreja)}
                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg px-3 py-1.5 transition"
                      title="Gerenciar admins"
                    >
                      <UserCog className="w-3.5 h-3.5" />
                      <span className="font-bold text-xs">Admins</span>
                    </button>
                    <button
                      onClick={() => copiarCodigo(igreja.codigo_convite)}
                      className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-1.5 transition"
                    >
                      <span className="font-mono font-bold text-sm text-gray-700 tracking-wider">{igreja.codigo_convite}</span>
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Gestão de Admins da Igreja */}
      {igrejaAdmins && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setIgrejaAdmins(null)}>
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Cabeçalho */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">Admins</h3>
                  <p className="text-xs text-gray-500 truncate">{igrejaAdmins.nome}</p>
                </div>
              </div>
              <button onClick={() => setIgrejaAdmins(null)} className="p-2 rounded-lg hover:bg-gray-100 transition" aria-label="Fechar">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Busca */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaMembro}
                  onChange={e => setBuscaMembro(e.target.value)}
                  placeholder="Buscar membro..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Lista de membros */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {carregandoMembros ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : membrosFiltrados.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">Nenhum membro encontrado.</p>
              ) : (
                membrosFiltrados.map(membro => (
                  <div key={membro.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{membro.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{membro.email}</p>
                    </div>
                    <button
                      onClick={() => alternarAdmin(membro)}
                      className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 transition flex-shrink-0 ${
                        membro.role === 'admin'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      {membro.role === 'admin' ? 'Admin' : 'Tornar admin'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}