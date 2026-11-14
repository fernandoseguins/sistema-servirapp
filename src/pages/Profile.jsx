// src/pages/Profile.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { ArrowLeft, User, CalendarHeart, Music, Shield, Save, Plus, Trash2,
         Mic, Mic2, Settings2, Monitor, Camera, PenTool, Baby, Smile,
         HeartHandshake, Star, Lock, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../context/UIContext'

// ── Skeleton de carregamento ──────────────────────────────────────────────────
function ProfileSkeleton() {
  const P = ({ className }) => <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`} />
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gray-900 px-4 py-6 rounded-b-3xl mb-6">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <P className="w-10 h-10 rounded-full" />
          <div><P className="h-5 w-32 mb-1" /><P className="h-3 w-20" /></div>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 animate-pulse space-y-3">
            <P className="h-4 w-32" />
            <P className="h-11 w-full" />
            <P className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Indicador de força de senha ───────────────────────────────────────────────
function PasswordStrength({ password }) {
  const { score, label, color } = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' }
    let s = 0
    if (password.length >= 6)  s++
    if (password.length >= 10) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    const levels = [
      { label: 'Muito fraca', color: 'bg-red-500' },
      { label: 'Fraca',       color: 'bg-orange-400' },
      { label: 'Razoável',    color: 'bg-yellow-400' },
      { label: 'Boa',         color: 'bg-blue-500' },
      { label: 'Forte',       color: 'bg-green-500' },
    ]
    return { score: s, ...levels[Math.min(s, 4)] }
  }, [password])

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className={`text-[10px] font-semibold ${
        score <= 1 ? 'text-red-500' : score <= 2 ? 'text-orange-400' : score <= 3 ? 'text-yellow-500' : score <= 4 ? 'text-blue-500' : 'text-green-500'
      }`}>{label}</p>
    </div>
  )
}

export default function Profile() {
  const navigate   = useNavigate()
  const { toast }  = useUI()

  const [loading,  setLoading]  = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [meuId,    setMeuId]    = useState(null)

  // Dados pessoais
  const [nome,           setNome]           = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [meusDepts,      setMeusDepts]      = useState([])

  // Louvor
  const [voz,         setVoz]         = useState(false)
  const [conducao,    setConducao]    = useState(false)
  const [backing,     setBacking]     = useState(false)
  const [sonoplastia, setSonoplastia] = useState(false)
  const [instrumentos,    setInstrumentos]    = useState([])
  const [novoInstrumento, setNovoInstrumento] = useState('')
  const INSTRUMENTOS = ['Violão','Guitarra','Baixo','Bateria','Teclado','Percussão','Saxofone','Violino']

  // Mídia
  const [midiaPC,    setMidiaPC]    = useState(false)
  const [midiaFoto,  setMidiaFoto]  = useState(false)
  const [midiaRedes, setMidiaRedes] = useState(false)

  // Infantil
  const [infBercario,    setInfBercario]    = useState(false)
  const [infSala38,      setInfSala38]      = useState(false)
  const [infSala911,     setInfSala911]     = useState(false)
  const [infAcolhimento, setInfAcolhimento] = useState(false)
  const [infAuxiliar,    setInfAuxiliar]    = useState(false)

  // Diaconia
  const [diaconia, setDiaconia] = useState(false)

  // Senha
  const [senhaNova,      setSenhaNova]      = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loadingSenha,   setLoadingSenha]   = useState(false)
  const [mostrarSenha,   setMostrarSenha]   = useState(false)

  // ── Pertencimento por departamento ────────────────────────────────────────
  const isLouvor   = useMemo(() => meusDepts.some(d => d.departamentos?.tipo === 'louvor'),   [meusDepts])
  const isMidia    = useMemo(() => meusDepts.some(d => d.departamentos?.tipo === 'midia'),    [meusDepts])
  const isInfantil = useMemo(() => meusDepts.some(d => d.departamentos?.tipo === 'infantil'), [meusDepts])
  const isDiaconia = useMemo(() => meusDepts.some(d => d.departamentos?.nome === 'Diaconia'), [meusDepts])

  // ── Validação de senha em tempo real ────────────────────────────────────────
  const senhasConferem = senhaNova && confirmarSenha && senhaNova === confirmarSenha
  const senhasErradas  = confirmarSenha && senhaNova !== confirmarSenha

  useEffect(() => { carregarPerfil() }, [])

  async function carregarPerfil() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setMeuId(user.id)

      // ✅ Três queries em paralelo
      const [perfilRes, deptsRes, instsRes] = await Promise.all([
        supabase.from('users_profile').select('*').eq('id', user.id).single(),
        supabase.from('membros_departamentos').select('role, departamentos(nome, tipo)').eq('user_id', user.id),
        supabase.from('user_instruments').select('id, instrumento').eq('user_id', user.id),
      ])

      if (perfilRes.data) {
        const p = perfilRes.data
        setNome(p.nome || '')
        setDataNascimento(p.data_nascimento || '')
        setVoz(p.voz || false)
        setConducao(p.conducao || false)
        setBacking(p.backing_vocal || false)
        setSonoplastia(p.sonoplastia || false)
        setMidiaPC(p.midia_computador || false)
        setMidiaFoto(p.midia_fotografia || false)
        setMidiaRedes(p.midia_redacao || false)
        setInfBercario(p.infantil_bercario || false)
        setInfSala38(p.infantil_sala3_8 || false)
        setInfSala911(p.infantil_sala9_11 || false)
        setInfAcolhimento(p.infantil_acolhimento || false)
        setInfAuxiliar(p.infantil_auxiliar || false)
        setDiaconia(p.diaconia || false)
      }
      if (deptsRes.data)  setMeusDepts(deptsRes.data)
      if (instsRes.data)  setInstrumentos(instsRes.data)
    } catch (err) {
      (() => { console.error('Erro ao carregar perfil:', err); toast.error('Erro ao carregar perfil. Tente novamente.') })()
    } finally {
      setLoading(false)
    }
  }

  async function salvarPerfil() {
    if (!nome.trim()) { toast.warning('O nome não pode estar vazio.'); return }
    setSalvando(true)
    const { error } = await supabase.from('users_profile').update({
      nome,
      data_nascimento:       dataNascimento || null,
      voz:                   isLouvor   ? voz         : false,
      conducao:              isLouvor   ? conducao    : false,
      backing_vocal:         isLouvor   ? backing     : false,
      sonoplastia:           isLouvor   ? sonoplastia : false,
      midia_computador:      isMidia    ? midiaPC     : false,
      midia_fotografia:      isMidia    ? midiaFoto   : false,
      midia_redacao:         isMidia    ? midiaRedes  : false,
      infantil_bercario:     isInfantil ? infBercario    : false,
      infantil_sala3_8:      isInfantil ? infSala38      : false,
      infantil_sala9_11:     isInfantil ? infSala911     : false,
      infantil_acolhimento:  isInfantil ? infAcolhimento : false,
      infantil_auxiliar:     isInfantil ? infAuxiliar    : false,
      diaconia:              isDiaconia ? diaconia    : false,
    }).eq('id', meuId)

    if (error) (() => { console.error('Erro ao salvar perfil:', error); toast.error('Não foi possível salvar o perfil. Tente novamente.') })()
    else       toast.success('Perfil atualizado com sucesso!')
    setSalvando(false)
  }

  async function adicionarInstrumento() {
    if (!novoInstrumento || instrumentos.some(i => i.instrumento === novoInstrumento)) return
    const { data, error } = await supabase
      .from('user_instruments')
      .insert([{ user_id: meuId, instrumento: novoInstrumento }])
      .select().single()
    if (!error && data) {
      setInstrumentos([...instrumentos, data])
      setNovoInstrumento('')
      toast.success(`${novoInstrumento} adicionado!`)
    }
  }

  async function removerInstrumento(id, nome) {
    await supabase.from('user_instruments').delete().eq('id', id)
    setInstrumentos(instrumentos.filter(i => i.id !== id))
    toast.info(`${nome} removido.`)
  }

  async function alterarSenha() {
    if (!senhaNova)           { toast.warning('Digite a nova senha.'); return }
    if (senhaNova.length < 8) { toast.warning('A senha deve ter pelo menos 8 caracteres.'); return }
    if (!senhasConferem)      { toast.warning('As senhas não coincidem.'); return }

    setLoadingSenha(true)
    const { error } = await supabase.auth.updateUser({ password: senhaNova })
    if (error) (() => { console.error('Erro ao alterar senha:', error); toast.error('Erro ao alterar senha. Tente novamente.') })()
    else {
      toast.success('Senha alterada com sucesso!')
      setSenhaNova('')
      setConfirmarSenha('')
    }
    setLoadingSenha(false)
  }

  if (loading) return <ProfileSkeleton />

  // ── Helper: toggle card com checkbox ────────────────────────────────────────
  const ToggleCard = ({ checked, onChange, icon: Icon, label, activeClass }) => (
    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition select-none
      ${checked ? activeClass : 'border-gray-100 hover:bg-gray-50 text-gray-400'}`}>
      <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
      <Icon className="w-5 h-5 mb-1" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-center">{label}</span>
    </label>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* HEADER */}
      <div className="bg-gray-900 px-4 py-6 rounded-b-3xl mb-6 text-white">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" /> Meu Perfil
            </h1>
            <p className="text-xs text-gray-400">Gerencie suas informações</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-5">

        {/* CRACHÁS */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-blue-600" /> Meus Departamentos
          </h2>
          {meusDepts.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhum departamento ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {meusDepts.map((v, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                  <span className="font-bold text-gray-700 text-sm">{v.departamentos?.nome}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
                    ${v.role === 'admin' || v.role === 'líder' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'}`}>
                    {v.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DADOS PESSOAIS */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-green-600" /> Informações Pessoais
          </h2>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome Completo</label>
            <input
              type="text" value={nome} onChange={e => setNome(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-gray-900 outline-none transition"
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
              <CalendarHeart className="w-3.5 h-3.5" /> Data de Nascimento
            </label>
            <input
              type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:ring-2 focus:ring-gray-900 outline-none transition"
            />
          </div>
        </div>

        {/* PERFIL LOUVOR */}
        {isLouvor && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-blue-600" /> Perfil — Louvor
            </h2>

            <div className="grid grid-cols-2 gap-2 mb-5">
              <ToggleCard checked={conducao}    onChange={e => setConducao(e.target.checked)}    icon={Star}     label="Condução"     activeClass="bg-yellow-50 border-yellow-500 text-yellow-700" />
              <ToggleCard checked={voz}         onChange={e => setVoz(e.target.checked)}         icon={Mic}      label="Voz Principal" activeClass="bg-blue-50 border-blue-500 text-blue-700" />
              <ToggleCard checked={backing}     onChange={e => setBacking(e.target.checked)}     icon={Mic2}     label="Backing Vocal" activeClass="bg-purple-50 border-purple-500 text-purple-700" />
              <ToggleCard checked={sonoplastia} onChange={e => setSonoplastia(e.target.checked)} icon={Settings2} label="Mesa de Som"  activeClass="bg-gray-900 border-gray-900 text-white" />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-semibold text-gray-500 mb-2">Instrumentos</label>
              <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]">
                {instrumentos.map(inst => (
                  <span key={inst.id} className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-200 flex items-center gap-1.5">
                    {inst.instrumento}
                    <button type="button" onClick={() => removerInstrumento(inst.id, inst.instrumento)} aria-label={`Remover ${inst.instrumento}`} className="text-indigo-300 hover:text-red-500 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {instrumentos.length === 0 && <span className="text-xs text-gray-400 italic">Nenhum instrumento.</span>}
              </div>
              <div className="flex gap-2">
                <select value={novoInstrumento} onChange={e => setNovoInstrumento(e.target.value)} className="flex-1 border border-gray-200 rounded-xl p-2.5 text-sm outline-none bg-gray-50">
                  <option value="">Adicionar instrumento...</option>
                  {INSTRUMENTOS.filter(i => !instrumentos.some(mi => mi.instrumento === i)).map(inst => (
                    <option key={inst} value={inst}>{inst}</option>
                  ))}
                </select>
                <button type="button" onClick={adicionarInstrumento} disabled={!novoInstrumento} aria-label="Adicionar instrumento" className="bg-indigo-600 text-white px-3 rounded-xl hover:bg-indigo-700 transition active:scale-[0.97] disabled:opacity-40">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PERFIL MÍDIA */}
        {isMidia && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-purple-600" /> Perfil — Mídia
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <ToggleCard checked={midiaPC}    onChange={e => setMidiaPC(e.target.checked)}    icon={Monitor} label={"PC /\nProjeção"} activeClass="bg-indigo-50 border-indigo-500 text-indigo-700" />
              <ToggleCard checked={midiaFoto}  onChange={e => setMidiaFoto(e.target.checked)}  icon={Camera}  label={"Fotos &\nVídeos"}   activeClass="bg-pink-50 border-pink-500 text-pink-700" />
              <ToggleCard checked={midiaRedes} onChange={e => setMidiaRedes(e.target.checked)} icon={PenTool} label={"Redes\nSociais"}   activeClass="bg-orange-50 border-orange-500 text-orange-700" />
            </div>
          </div>
        )}

        {/* PERFIL INFANTIL */}
        {isInfantil && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Baby className="w-3.5 h-3.5 text-pink-500" /> Perfil — Infantil
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { state: infBercario,    set: setInfBercario,    icon: Baby,         label: 'Berçário',      active: 'bg-pink-50 border-pink-500 text-pink-700' },
                { state: infSala38,      set: setInfSala38,      icon: Smile,        label: 'Sala 03 a 08',  active: 'bg-yellow-50 border-yellow-500 text-yellow-700' },
                { state: infSala911,     set: setInfSala911,     icon: Smile,        label: 'Sala 09 a 11',  active: 'bg-green-50 border-green-500 text-green-700' },
                { state: infAcolhimento, set: setInfAcolhimento, icon: HeartHandshake,label: 'Acolhimento',  active: 'bg-red-50 border-red-400 text-red-700' },
              ].map(({ state, set, icon, label, active }) => (
                <ToggleCard key={label} checked={state} onChange={e => set(e.target.checked)} icon={icon} label={label} activeClass={active} />
              ))}
              <label className={`col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition
                ${infAuxiliar ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-100 hover:bg-gray-50 text-gray-400'}`}>
                <input type="checkbox" className="hidden" checked={infAuxiliar} onChange={e => setInfAuxiliar(e.target.checked)} />
                <Smile className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Auxiliar</span>
              </label>
            </div>
          </div>
        )}

        {/* PERFIL DIACONIA */}
        {isDiaconia && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-gray-900" /> Perfil — Diaconia
            </h2>
            <label className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition
              ${diaconia ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'border-gray-200 hover:bg-gray-100 text-gray-500'}`}>
              <input type="checkbox" className="hidden" checked={diaconia} onChange={e => setDiaconia(e.target.checked)} />
              <Shield className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Atuar na Diaconia</span>
            </label>
          </div>
        )}

        {/* BOTÃO SALVAR */}
        <button
          onClick={salvarPerfil}
          disabled={salvando}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save className="w-5 h-5" />
          {salvando ? 'Guardando...' : 'Salvar Alterações'}
        </button>

        {/* SEGURANÇA — ALTERAR SENHA */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-gray-500" /> Segurança
          </h2>

          <div className="space-y-4">
            {/* Nova senha */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nova Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senhaNova}
                  onChange={e => setSenhaNova(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full border border-gray-200 rounded-xl p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-gray-900 transition"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Indicador de força */}
              <PasswordStrength password={senhaNova} />
            </div>

            {/* Confirmar senha */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Confirmar Nova Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={`w-full border rounded-xl p-3 pr-10 text-sm outline-none focus:ring-2 transition
                    ${senhasErradas  ? 'border-red-300 focus:ring-red-400 bg-red-50'
                    : senhasConferem ? 'border-green-300 focus:ring-green-400 bg-green-50'
                    : 'border-gray-200 focus:ring-gray-900'}`}
                />
                {/* Ícone de validação */}
                {confirmarSenha && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {senhasConferem
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <XCircle      className="w-4 h-4 text-red-400" />}
                  </div>
                )}
              </div>
              {senhasErradas && (
                <p className="text-[11px] text-red-500 font-medium mt-1">As senhas não coincidem.</p>
              )}
            </div>

            <button
              onClick={alterarSenha}
              disabled={loadingSenha || !senhaNova || !confirmarSenha}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black active:scale-[0.98] transition-all disabled:opacity-40 text-sm flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {loadingSenha ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </div>
        </div>

        <div className="h-2" />
      </div>
    </div>
  )
}