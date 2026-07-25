// src/pages/InfantilCheckin.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import PageHeader from '../components/PageHeader'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, UserCheck, CheckCircle2, Plus, Baby, AlertCircle, Search, ClipboardList, FileText, Trash2, Edit2, XCircle, Save, Smile, Clock, BarChart3 } from 'lucide-react'
import { hojeLocal } from '../utils/datas'

export default function InfantilCheckin() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const departamentoTipo = location.state?.departamentoTipo

  // Controle de Abas: 'checkin', 'cadastro', 'historico', 'relatorios'
  const [abaAtiva, setAbaAtiva] = useState('checkin')

  // Listas de Dados
  const [cadastros, setCadastros] = useState([]) 
  const [criancasPresentes, setCriancasPresentes] = useState([]) 
  const [historicoSaidas, setHistoricoSaidas] = useState([]) 
  const [relatorios, setRelatorios] = useState([]) 
  
  // Controle de Permissão
  const [isLiderOuAdmin, setIsLiderOuAdmin] = useState(false)

  // Busca Rápida
  const [termoBuscaCheckin, setTermoBuscaCheckin] = useState('')
  const [termoBuscaCadastro, setTermoBuscaCadastro] = useState('') 

  // Controle de Modais (Novo/Editar)
  const [modalFichaAberto, setModalFichaAberto] = useState(false)
  const [idFichaEditando, setIdFichaEditando] = useState(null) 

  // Formulário de Cadastro Fixo
  const [nomeCrianca, setNomeCrianca] = useState('')
  const [sala, setSala] = useState('') 
  const [nomeResponsavel, setNomeResponsavel] = useState('')
  const [telefone, setTelefone] = useState('')
  const [restricoes, setRestricoes] = useState('')
  
  const [loading, setLoading] = useState(true)
  const { toast, confirm } = useUI()
  const [processando, setProcessando] = useState(false)

  // Tema Rosa do Infantil
  const theme = { 
    bgPrimary: 'bg-pink-500', textPrimary: 'text-pink-500', 
    btnHover: 'hover:bg-pink-600', textLight: 'text-pink-100',
    tabActive: 'bg-pink-500 text-white shadow-md', tabInactive: 'bg-gray-100 text-gray-500 hover:bg-gray-200'
  }

  useEffect(() => {
    // Aceita por tipo (preferido) ou por nome (fallback). Sem dado → volta ao Hub.
    const ehInfantil = departamentoTipo === 'infantil' || departamentoNome === 'Infantil'
    if (!departamentoId || !ehInfantil) {
      navigate('/hub')
      return
    }
    carregarTudo()
  }, [departamentoId])

  async function carregarTudo() {
    setLoading(true)

    // 1. Auth — precisa do user.id antes das demais
    const { data: { user } } = await supabase.auth.getUser()
    let possuiAcessoEspecial = false

    const hojeFormatoDB = hojeLocal()

    if (user) {
      const { data: ehSuperFlag } = await supabase.rpc('sou_super_admin_flag')
      const ehMaster = ehSuperFlag === true

      // ✅ Promise.all — permissão + fichas + presentes em paralelo
      const [deptsRes, cadastrosRes, presentesRes] = await Promise.all([
        supabase
          .from('membros_departamentos')
          .select('role')
          .eq('user_id', user.id)
          .eq('departamento_id', departamentoId),
        supabase
          .from('kids_registry')
          .select('*')
          .eq('departamento_id', departamentoId)
          .order('nome_crianca', { ascending: true }),
        supabase
          .from('kids_checkin')
          .select('*')
          .eq('departamento_id', departamentoId)
          .eq('status', 'presente')
          .gte('created_at', `${hojeFormatoDB}T00:00:00`)
          .order('created_at', { ascending: false }),
      ])

      const vinculo = deptsRes.data?.[0]
      const ehLiderAQUI = vinculo?.role === 'líder' || vinculo?.role === 'admin'
      possuiAcessoEspecial = ehMaster || ehLiderAQUI
      setIsLiderOuAdmin(possuiAcessoEspecial)

      if (cadastrosRes.data) setCadastros(cadastrosRes.data)
      if (presentesRes.data) setCriancasPresentes(presentesRes.data)

      const dbCadastros = cadastrosRes.data

      if (possuiAcessoEspecial) {
        const dataLimite = new Date()
        dataLimite.setDate(dataLimite.getDate() - 60)

        // ✅ Promise.all — histórico + estatísticas em paralelo
        const [historicoRes, todosCheckinsRes] = await Promise.all([
          supabase
            .from('kids_checkin')
            .select('*')
            .eq('departamento_id', departamentoId)
            .eq('status', 'saiu')
            .limit(150),
          supabase
            .from('kids_checkin')
            .select('*')
            .eq('departamento_id', departamentoId)
            .gte('created_at', dataLimite.toISOString()),
        ])

        const dbHistorico      = historicoRes.data
        const dbTodosCheckins  = todosCheckinsRes.data
        
        if (dbHistorico) setHistoricoSaidas(dbHistorico)

      if (dbTodosCheckins && dbCadastros) {
        const agrupado = {}
        dbTodosCheckins.forEach(checkin => {
          const dataStr = formatarData(checkin.created_at)
          
          if (!agrupado[dataStr]) {
            agrupado[dataStr] = { dataStr, total: 0, bercario: 0, sala3a8: 0, sala9a11: 0, semSala: 0, rawDate: checkin.created_at }
          }
          
          const ficha = dbCadastros.find(c => c.id === checkin.registry_id)
          const sala = ficha?.sala
          
          agrupado[dataStr].total += 1
          if (sala === 'Berçário') agrupado[dataStr].bercario += 1
          else if (sala === 'Sala 03 a 08') agrupado[dataStr].sala3a8 += 1
          else if (sala === 'Sala 09 a 11') agrupado[dataStr].sala9a11 += 1
          else agrupado[dataStr].semSala += 1
        })
        
        // Garante que o dia MAIS RECENTE fique SEMPRE no topo
        setRelatorios(Object.values(agrupado).sort((a,b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()))
      }
    }
    } // fim if (user)
    
    setLoading(false)
  }

  // --- FUNÇÕES DA ABA: CADASTRO FIXO ---
  function abrirModalNovaFicha() {
    setIdFichaEditando(null)
    setNomeCrianca('')
    setSala('')
    setNomeResponsavel('')
    setTelefone('')
    setRestricoes('')
    setModalFichaAberto(true)
  }

  function abrirModalEditarFicha(ficha) {
    setIdFichaEditando(ficha.id)
    setNomeCrianca(ficha.nome_crianca)
    setSala(ficha.sala || '')
    setNomeResponsavel(ficha.nome_responsavel)
    setTelefone(ficha.telefone_responsavel)
    setRestricoes(ficha.restricoes_medicas || '')
    setModalFichaAberto(true)
  }

  async function salvarFicha(e) {
    e.preventDefault()
    if (!nomeCrianca || !nomeResponsavel || !telefone || !sala) {
      toast.info("Por favor, preencha todos os campos obrigatórios, incluindo a salinha.")
      return
    }
    setProcessando(true)

    const numeroLimpo = telefone.replace(/\D/g, '')

    const payload = {
      nome_crianca: nomeCrianca,
      sala: sala, 
      nome_responsavel: nomeResponsavel,
      telefone_responsavel: numeroLimpo,
      restricoes_medicas: restricoes
    }

    if (idFichaEditando) {
      const { error } = await supabase.from('kids_registry').update(payload).eq('id', idFichaEditando)
      if (error) toast.error('Erro ao atualizar ficha.')
      else toast.success('Ficha atualizada!')
    } else {
      const { error } = await supabase.from('kids_registry').insert([{ ...payload, departamento_id: departamentoId }])
      if (error) toast.error('Erro ao cadastrar criança.')
      else toast.success('Ficha criada com sucesso!')
    }

    setProcessando(false)
    setModalFichaAberto(false)
    carregarTudo()
  }

  async function excluirFicha(id, nome) {
    if (!await confirm({ title: 'Confirmar ação', labelOk: 'Confirmar', labelCancel: 'Cancelar' })) return
    
    setProcessando(true)
    const { error } = await supabase.from('kids_registry').delete().eq('id', id)
    
    if (error) toast.error('Erro ao excluir ficha.')
    else {
      toast.success(`Ficha de ${nome} apagada.`)
      setModalFichaAberto(false)
      carregarTudo()
    }
    setProcessando(false)
  }

  // --- FUNÇÕES DA ABA: CHECK-IN RÁPIDO ---
  async function registrarEntrada(ficha) {
    setProcessando(true)
    const { error } = await supabase.from('kids_checkin').insert([
      { 
        departamento_id: departamentoId, 
        registry_id: ficha.id,
        nome_crianca: ficha.nome_crianca, 
        nome_responsavel: ficha.nome_responsavel,
        telefone_responsavel: ficha.telefone_responsavel
      }
    ])

    if (!error) {
      setTermoBuscaCheckin('') 
      carregarTudo()
    }
    setProcessando(false)
  }

  async function darSaida(idCheckin, nome) {
    if (!await confirm({ title: 'Confirmar ação', labelOk: 'Confirmar', labelCancel: 'Cancelar' })) return
    const horaAtual = new Date().toISOString()
    const { error } = await supabase.from('kids_checkin').update({ status: 'saiu', checkout_time: horaAtual }).eq('id', idCheckin)
    if (!error) carregarTudo()
  }

  function chamarNoWhatsApp(crianca) {
    let numeroFormatado = crianca.telefone_responsavel
    if (numeroFormatado.length <= 11) numeroFormatado = '55' + numeroFormatado
    const texto = `A paz do Senhor, ${crianca.nome_responsavel}! 🚨 O(a) ${crianca.nome_crianca} está precisando de você aqui na sala do Infantil agora. Aguardamos você! 🙏`
    const url = `https://wa.me/${numeroFormatado}?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
  }

  // Helpers de Formatação
  function formatarHora(isoString) {
    if (!isoString) return '--:--'
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  function formatarData(isoString) {
    if (!isoString) return ''
    return new Date(isoString).toLocaleDateString('pt-BR')
  }

  // Filtros de Busca (Aba Checkin/Cadastro)
  const buscarCheckinResultados = cadastros.filter(c => {
    const naoEstaNaSala = !criancasPresentes.some(p => p.registry_id === c.id)
    const bateComABusca = c.nome_crianca.toLowerCase().includes(termoBuscaCheckin.toLowerCase()) || c.nome_responsavel.toLowerCase().includes(termoBuscaCheckin.toLowerCase())
    return naoEstaNaSala && bateComABusca
  })
  const buscarCadastroResultados = cadastros.filter(c => c.nome_crianca.toLowerCase().includes(termoBuscaCadastro.toLowerCase()) || c.nome_responsavel.toLowerCase().includes(termoBuscaCadastro.toLowerCase()))

  // ✅ SEPARAÇÃO DAS CRIANÇAS PRESENTES POR SALA
  const bercario = []
  const sala3a8 = []
  const sala9a11 = []
  const semSala = []

  criancasPresentes.forEach(crianca => {
    const ficha = cadastros.find(c => c.id === crianca.registry_id)
    if (ficha?.sala === 'Berçário') bercario.push(crianca)
    else if (ficha?.sala === 'Sala 03 a 08') sala3a8.push(crianca)
    else if (ficha?.sala === 'Sala 09 a 11') sala9a11.push(crianca)
    else semSala.push(crianca)
  })

  // ✅ NOVO CÉREBRO: ORDENA E SEPARA O HISTÓRICO POR DIA E POR SALA
  const historicoAgrupado = {}
  historicoSaidas.forEach(reg => {
    const dataStr = formatarData(reg.checkout_time || reg.created_at)
    const rawDate = new Date(reg.checkout_time || reg.created_at).getTime()
    
    const ficha = cadastros.find(c => c.id === reg.registry_id)
    let salaDaCrianca = ficha?.sala
    if (!['Berçário', 'Sala 03 a 08', 'Sala 09 a 11'].includes(salaDaCrianca)) salaDaCrianca = 'Sem Sala'

    if (!historicoAgrupado[dataStr]) {
      historicoAgrupado[dataStr] = { 
        dataStr, 
        rawDate, 
        registros: { 'Berçário': [], 'Sala 03 a 08': [], 'Sala 09 a 11': [], 'Sem Sala': [] } 
      }
    }
    historicoAgrupado[dataStr].registros[salaDaCrianca].push(reg)
  })
  // Garante que o dia mais recente fique no topo!
  const historicoOrdenado = Object.values(historicoAgrupado).sort((a, b) => b.rawDate - a.rawDate)

  // Componente Auxiliar para Crianças Presentes
  const RenderCriancaCard = ({ crianca }) => {
    const fichaOriginal = cadastros.find(c => c.id === crianca.registry_id)
    return (
      <div key={crianca.id} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-pink-400"></div>
        <div className="flex justify-between items-start pl-2">
          <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{crianca.nome_crianca}</h3>
            <p className="text-xs text-gray-500 font-medium mt-1">Resp: {crianca.nome_responsavel}</p>
            {fichaOriginal?.restricoes_medicas && (
              <p className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded mt-1.5 inline-block font-bold">
                ⚠️ {fichaOriginal.restricoes_medicas}
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-2 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> Entrada: {formatarHora(crianca.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4 pl-2">
          <button onClick={() => chamarNoWhatsApp(crianca)} className="flex-1 bg-red-50 text-red-600 border border-red-100 font-bold py-2.5 rounded-xl hover:bg-red-100 transition flex items-center justify-center gap-1.5 text-xs shadow-sm">
            <AlertCircle className="w-4 h-4" /> Chamar
          </button>
          <button onClick={() => darSaida(crianca.id, crianca.nome_crianca)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-1.5 text-xs shadow-sm">
            <CheckCircle2 className="w-4 h-4" /> Dar Saída
          </button>
        </div>
      </div>
    )
  }

  // Componente Auxiliar para o Card do Histórico
  const CardHistorico = ({ reg }) => (
    <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col gap-1">
      <div className="flex justify-between items-start">
        <p className="font-bold text-gray-800 text-sm">{reg.nome_crianca}</p>
      </div>
      <p className="text-[10px] text-gray-500 font-medium">Entregue a: {reg.nome_responsavel}</p>
      <div className="flex gap-4 pt-1 mt-1 border-t border-gray-50">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-[10px] font-bold text-gray-500">{formatarHora(reg.created_at)}</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowLeft className="w-3 h-3 text-red-500" />
          <span className="text-[10px] font-bold text-gray-500">{formatarHora(reg.checkout_time)}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* CABEÇALHO */}
      <PageHeader
        title="Check-in Infantil"
        subtitle="Registo de presenças das crianças"
        icon={<Baby className="w-5 h-5" />}
        color={theme.bgPrimary}
      />

      <div className="max-w-md mx-auto px-4 space-y-6">

        {/* NAVEGAÇÃO DAS ABAS */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl overflow-x-auto no-scrollbar gap-1">
          <button 
            onClick={() => setAbaAtiva('checkin')}
            className={`flex-none min-w-[90px] flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-lg text-[11px] sm:text-sm font-bold transition-all ${abaAtiva === 'checkin' ? theme.tabActive : theme.tabInactive}`}
          >
            <CheckCircle2 className="w-4 h-4" /> Check-in
          </button>
          <button 
            onClick={() => setAbaAtiva('cadastro')}
            className={`flex-none min-w-[90px] flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-lg text-[11px] sm:text-sm font-bold transition-all ${abaAtiva === 'cadastro' ? theme.tabActive : theme.tabInactive}`}
          >
            <ClipboardList className="w-4 h-4" /> Fichas
          </button>
          
          {isLiderOuAdmin && (
            <>
              <button 
                onClick={() => setAbaAtiva('historico')}
                className={`flex-none min-w-[90px] flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-lg text-[11px] sm:text-sm font-bold transition-all ${abaAtiva === 'historico' ? theme.tabActive : theme.tabInactive}`}
              >
                <Clock className="w-4 h-4" /> Histórico
              </button>
              <button 
                onClick={() => setAbaAtiva('relatorios')}
                className={`flex-none min-w-[90px] flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-lg text-[11px] sm:text-sm font-bold transition-all ${abaAtiva === 'relatorios' ? theme.tabActive : theme.tabInactive}`}
              >
                <BarChart3 className="w-4 h-4" /> Estatísticas
              </button>
            </>
          )}
        </div>


        {/* ==================================================== */}
        {/* ABA 1: O CHECK-IN RÁPIDO (DOMINGO DE MANHÃ)          */}
        {/* ==================================================== */}
        {abaAtiva === 'checkin' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-800 uppercase mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-pink-500" /> Buscar Criança
              </h2>
              <div className="relative mb-2">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" placeholder="Digite o nome da criança..." value={termoBuscaCheckin} onChange={(e) => setTermoBuscaCheckin(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-pink-500 outline-none" 
                />
              </div>

              {termoBuscaCheckin.length > 0 && (
                <div className="mt-3 space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {buscarCheckinResultados.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-3 bg-gray-50 rounded-lg">Criança não encontrada ou já está na sala. <button onClick={() => setAbaAtiva('cadastro')} className="text-pink-600 font-bold underline">Cadastrar nova?</button></p>
                  ) : (
                    buscarCheckinResultados.map(ficha => (
                      <div key={ficha.id} className="flex justify-between items-center bg-pink-50/50 border border-pink-100 p-3 rounded-xl">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-800 text-sm">{ficha.nome_crianca}</p>
                            {ficha.sala && <span className="text-[8px] bg-white text-pink-600 px-1.5 py-0.5 rounded border border-pink-200 font-bold uppercase tracking-wider">{ficha.sala}</span>}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">Resp: {ficha.nome_responsavel}</p>
                        </div>
                        <button 
                          onClick={() => registrarEntrada(ficha)} disabled={processando}
                          className="bg-pink-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-pink-600 shadow-sm shrink-0 ml-2"
                        >
                          Dar Entrada
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-gray-800 uppercase flex items-center gap-2">
                  <Baby className="w-5 h-5 text-pink-400" /> Na Sala Agora ({criancasPresentes.length})
                </h2>
              </div>
              
              {loading && criancasPresentes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 font-bold animate-pulse">A atualizar...</p>
              ) : criancasPresentes.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">A sala está vazia neste momento.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {bercario.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-pink-600 uppercase tracking-wider mb-2 flex items-center gap-1.5 bg-pink-50 px-3 py-1.5 rounded-lg w-fit border border-pink-100"><Baby className="w-3.5 h-3.5"/> Berçário ({bercario.length})</h3>
                      <div className="space-y-3">{bercario.map(c => <RenderCriancaCard key={c.id} crianca={c} />)}</div>
                    </div>
                  )}
                  {sala3a8.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-2 flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-lg w-fit border border-yellow-100"><Smile className="w-3.5 h-3.5"/> Sala 03 a 08 anos ({sala3a8.length})</h3>
                      <div className="space-y-3">{sala3a8.map(c => <RenderCriancaCard key={c.id} crianca={c} />)}</div>
                    </div>
                  )}
                  {sala9a11.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-lg w-fit border border-green-100"><Smile className="w-3.5 h-3.5"/> Sala 09 a 11 anos ({sala9a11.length})</h3>
                      <div className="space-y-3">{sala9a11.map(c => <RenderCriancaCard key={c.id} crianca={c} />)}</div>
                    </div>
                  )}
                  {semSala.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg w-fit border border-gray-200"><AlertCircle className="w-3.5 h-3.5"/> Faltam Atualizar ({semSala.length})</h3>
                      <div className="space-y-3">{semSala.map(c => <RenderCriancaCard key={c.id} crianca={c} />)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ABA 2: GESTÃO DE CADASTROS (FICHAS)                  */}
        {/* ==================================================== */}
        {abaAtiva === 'cadastro' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            
            <button onClick={abrirModalNovaFicha} className={`w-full text-white font-bold py-3.5 rounded-xl transition active:scale-[0.97] flex items-center justify-center gap-2 shadow-md ${theme.bgPrimary} ${theme.btnHover}`}>
              <Plus className="w-5 h-5" /> Nova Ficha de Criança
            </button>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-sm font-bold uppercase flex items-center gap-2 ${theme.textPrimary}`}>
                  <FileText className="w-5 h-5" /> Fichas Registradas ({cadastros.length})
                </h2>
              </div>
              
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" placeholder="Buscar nas fichas..." value={termoBuscaCadastro} onChange={(e) => setTermoBuscaCadastro(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-pink-500 outline-none text-sm" 
                />
              </div>

              {loading && cadastros.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 font-bold animate-pulse">A carregar...</p>
              ) : buscarCadastroResultados.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6 bg-gray-50 rounded-lg">Nenhuma ficha encontrada.</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {buscarCadastroResultados.map(ficha => (
                    <div key={ficha.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-xl hover:bg-pink-50 hover:border-pink-200 transition group cursor-pointer" onClick={() => abrirModalEditarFicha(ficha)}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-800 text-sm">{ficha.nome_crianca}</p>
                          {ficha.sala && <span className="text-[8px] bg-white text-pink-600 px-1.5 py-0.5 rounded border border-pink-200 font-bold uppercase tracking-wider">{ficha.sala}</span>}
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium mt-1">Resp: {ficha.nome_responsavel} • 📱 {ficha.telefone_responsavel}</p>
                        {ficha.restricoes_medicas && <p className="text-[9px] text-yellow-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Tem restrição médica</p>}
                      </div>
                      <div className="text-gray-300 group-hover:text-pink-500 transition">
                        <Edit2 className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ✅ ABA 3: HISTÓRICO ORGANIZADO (SÓ LÍDER/ADMIN)      */}
        {/* ==================================================== */}
        {abaAtiva === 'historico' && isLiderOuAdmin && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-sm font-bold uppercase flex items-center gap-2 ${theme.textPrimary}`}>
                  <Clock className="w-5 h-5" /> Histórico de Saídas
                </h2>
              </div>
              
              {loading && historicoSaidas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 font-bold animate-pulse">A carregar histórico...</p>
              ) : historicoOrdenado.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Nenhum registo de saída encontrado.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {historicoOrdenado.map(dia => (
                    <div key={dia.dataStr} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Cabeçalho do Dia */}
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                        <span className="font-black text-gray-800 text-sm">{dia.dataStr}</span>
                      </div>
                      
                      <div className="p-3 space-y-4 bg-gray-50/50">
                        
                        {/* Bloco Berçário */}
                        {dia.registros['Berçário'].length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-bold text-pink-600 uppercase tracking-wider mb-2 bg-pink-50 px-2 py-1 rounded w-fit border border-pink-100">Berçário</h3>
                            <div className="space-y-2">
                              {dia.registros['Berçário'].map(reg => <CardHistorico key={reg.id} reg={reg} />)}
                            </div>
                          </div>
                        )}

                        {/* Bloco Sala 3 a 8 */}
                        {dia.registros['Sala 03 a 08'].length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider mb-2 bg-yellow-50 px-2 py-1 rounded w-fit border border-yellow-100">Sala 03 a 08 anos</h3>
                            <div className="space-y-2">
                              {dia.registros['Sala 03 a 08'].map(reg => <CardHistorico key={reg.id} reg={reg} />)}
                            </div>
                          </div>
                        )}

                        {/* Bloco Sala 9 a 11 */}
                        {dia.registros['Sala 09 a 11'].length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2 bg-green-50 px-2 py-1 rounded w-fit border border-green-100">Sala 09 a 11 anos</h3>
                            <div className="space-y-2">
                              {dia.registros['Sala 09 a 11'].map(reg => <CardHistorico key={reg.id} reg={reg} />)}
                            </div>
                          </div>
                        )}

                        {/* Bloco Sem Sala */}
                        {dia.registros['Sem Sala'].length > 0 && (
                          <div>
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 bg-gray-200 px-2 py-1 rounded w-fit border border-gray-300">Sem Sala</h3>
                            <div className="space-y-2">
                              {dia.registros['Sem Sala'].map(reg => <CardHistorico key={reg.id} reg={reg} />)}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ABA 4: ESTATÍSTICAS E RELATÓRIOS (SÓ LÍDER/ADMIN)    */}
        {/* ==================================================== */}
        {abaAtiva === 'relatorios' && isLiderOuAdmin && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h2 className={`text-sm font-bold uppercase flex items-center gap-2 ${theme.textPrimary}`}>
                  <BarChart3 className="w-5 h-5" /> Presença nos Cultos
                </h2>
              </div>
              
              {loading && relatorios.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 font-bold animate-pulse">Processando dados...</p>
              ) : relatorios.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Não há registos suficientes para gerar o relatório.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {relatorios.map((rel, index) => (
                    <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                      <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                        <span className="font-black text-gray-800">{rel.dataStr}</span>
                        <span className="bg-pink-100 text-pink-700 text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                          Total: {rel.total} Crianças
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-600">
                        <div className="flex justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                          <span>Berçário:</span> <span className="text-pink-600">{rel.bercario}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                          <span>03 a 08 anos:</span> <span className="text-yellow-600">{rel.sala3a8}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                          <span>09 a 11 anos:</span> <span className="text-green-600">{rel.sala9a11}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                          <span>S/ Sala:</span> <span className="text-gray-500">{rel.semSala}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL DE CRIAR / EDITAR FICHA                        */}
        {/* ==================================================== */}
        {modalFichaAberto && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
              
              <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-pink-500" />
                    {idFichaEditando ? 'Editar Ficha' : 'Nova Ficha'}
                  </h2>
                </div>
                <button onClick={() => setModalFichaAberto(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={salvarFicha} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nome da Criança</label>
                  <input 
                    type="text" required value={nomeCrianca} onChange={(e) => setNomeCrianca(e.target.value)} placeholder="Ex: Joãozinho Silva"
                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-pink-500 outline-none bg-gray-50" 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Idade / Salinha</label>
                  <select 
                    required 
                    value={sala} 
                    onChange={(e) => setSala(e.target.value)} 
                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-pink-500 outline-none bg-gray-50"
                  >
                    <option value="">Selecione a salinha da criança...</option>
                    <option value="Berçário">0 a 2 anos (Berçário)</option>
                    <option value="Sala 03 a 08">3 a 8 anos</option>
                    <option value="Sala 09 a 11">9 a 11 anos</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Responsável</label>
                    <input 
                      type="text" required value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} placeholder="Ex: Maria"
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-pink-500 outline-none bg-gray-50" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">WhatsApp</label>
                    <input 
                      type="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Apenas números..."
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-pink-500 outline-none bg-gray-50" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Alergias ou Observações (Opcional)</label>
                  <textarea 
                    value={restricoes} onChange={(e) => setRestricoes(e.target.value)} placeholder="Ex: Intolerância à lactose, asma..."
                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-pink-500 outline-none bg-gray-50 h-20 resize-none" 
                  />
                </div>
                
                <div className="pt-2">
                  <button type="submit" disabled={processando} className={`w-full text-white font-bold py-3.5 rounded-xl transition active:scale-[0.97] flex items-center justify-center gap-2 shadow-md disabled:opacity-50 ${theme.bgPrimary} ${theme.btnHover}`}>
                    <Save className="w-5 h-5" /> {processando ? 'Salvando...' : 'Salvar Ficha'}
                  </button>
                </div>
              </form>

              {idFichaEditando && isLiderOuAdmin && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button 
                    onClick={() => excluirFicha(idFichaEditando, nomeCrianca)}
                    className="w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition flex items-center justify-center gap-2 text-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Ficha Permanentemente
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}