// src/pages/Profile.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { removerTokenPushDoAparelho } from '../utils/pushTokens'
import { User, CalendarHeart, Music, Shield, Save, Plus, Trash2,
         Mic, Mic2, Settings2, Monitor, Camera, PenTool, Baby, Smile,
         HeartHandshake, Star, Lock, CheckCircle2, Eye, EyeOff,
         Sun, Moon, SunMoon, Crown, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../context/UIContext'
import { useAparencia } from '../hooks/useAparencia'
import { Button, Card, Pill, ListRow, Input, Select, TopBar } from '../components/ui'

// ── Skeleton de carregamento ──────────────────────────────────────────────────
function ProfileSkeleton() {
  const P = ({ className }) => <div className={`bg-surface-2 rounded-ctl animate-pulse ${className}`} />
  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-topo px-4 py-6 mb-4">
        <div className="max-w-[720px] mx-auto"><div className="h-3 w-20 bg-white/20 rounded mb-2" /><div className="h-5 w-40 bg-white/30 rounded" /></div>
      </div>
      <div className="max-w-[720px] mx-auto px-4 space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-surface p-5 rounded-card border border-line space-y-3">
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
  const { score, label, color, texto } = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '', texto: '' }
    let s = 0
    if (password.length >= 6)  s++
    if (password.length >= 10) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    const levels = [
      { label: 'Muito fraca', color: 'bg-danger',  texto: 'text-danger' },
      { label: 'Fraca',       color: 'bg-danger',  texto: 'text-danger' },
      { label: 'Razoável',    color: 'bg-warning', texto: 'text-warning' },
      { label: 'Boa',         color: 'bg-brand',   texto: 'text-brand' },
      { label: 'Forte',       color: 'bg-success', texto: 'text-success' },
    ]
    return { score: s, ...levels[Math.min(s, 4)] }
  }, [password])

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : 'bg-surface-2'}`} />
        ))}
      </div>
      <p className={`text-[10px] font-semibold ${texto}`}>{label}</p>
    </div>
  )
}

// ── Cartão de função (checkbox acessível por teclado) ─────────────────────────
// Fora do componente Profile: definido dentro do render, seria recriado a cada
// digitação e os campos perderiam o foco.
function ToggleCard({ checked, onChange, icon, label, className = '' }) {
  const Icon = icon
  return (
    <label className={`flex flex-col items-center justify-center gap-1 p-3 rounded-ctl border cursor-pointer transition select-none text-center
      has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand
      ${checked ? 'bg-brand/10 border-brand text-brand' : 'bg-surface border-line text-ink-2 hover:bg-surface-2'} ${className}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <Icon className="w-5 h-5" aria-hidden="true" />
      <span className="text-[11px] font-semibold whitespace-pre-line">{label}</span>
    </label>
  )
}

function Secao({ icon, titulo, children }) {
  const Icon = icon
  return (
    <Card as="section" className="space-y-4">
      <h2 className="text-sm font-bold text-ink flex items-center gap-2">
        <Icon className="w-4 h-4 text-brand" aria-hidden="true" /> {titulo}
      </h2>
      {children}
    </Card>
  )
}

export default function Profile() {
  const navigate   = useNavigate()
  const { toast }  = useUI()
  const { preferencia, setPreferencia } = useAparencia()
  const [ehSuperAdmin, setEhSuperAdmin] = useState(false)

  async function sair() {
    await removerTokenPushDoAparelho()
    await supabase.auth.signOut()
    navigate('/')
  }

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
      const [perfilRes, deptsRes, instsRes, superRes] = await Promise.all([
        supabase.from('users_profile').select('*').eq('id', user.id).single(),
        supabase.from('membros_departamentos').select('role, departamentos(nome, tipo)').eq('user_id', user.id),
        supabase.from('user_instruments').select('id, instrumento').eq('user_id', user.id),
        supabase.rpc('sou_super_admin_flag'),
      ])
      setEhSuperAdmin(superRes.data === true)

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

  const OPCOES_APARENCIA = [
    { valor: 'auto',   rotulo: 'Automático', Icone: SunMoon },
    { valor: 'claro',  rotulo: 'Claro',      Icone: Sun },
    { valor: 'escuro', rotulo: 'Escuro',     Icone: Moon },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <TopBar variante="destaque" titulo={nome || 'Meu perfil'} subtitulo="Meu perfil" />

      <main className="max-w-[720px] mx-auto px-4 py-4 space-y-4">

        {/* DEPARTAMENTOS */}
        <Secao icon={Shield} titulo="Meus departamentos">
          {meusDepts.length === 0 ? (
            <p className="text-xs text-ink-2">Você ainda não participa de nenhum departamento.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {meusDepts.map((v, i) => (
                <Pill key={i} tom="dept" dept={v.departamentos?.nome} className="!text-xs !py-1">
                  {v.departamentos?.nome}
                  <span className="opacity-70 font-medium">· {v.role}</span>
                </Pill>
              ))}
            </div>
          )}
        </Secao>

        {/* DADOS PESSOAIS */}
        <Secao icon={User} titulo="Informações pessoais">
          <Input label="Nome completo" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
          <Input label="Data de nascimento" type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)}
            icon={<CalendarHeart className="w-4 h-4" aria-hidden="true" />} />
        </Secao>

        {/* PERFIL LOUVOR */}
        {isLouvor && (
          <Secao icon={Music} titulo="Louvor">
            <div className="grid grid-cols-2 gap-2">
              <ToggleCard checked={conducao}    onChange={e => setConducao(e.target.checked)}    icon={Star}      label="Condução" />
              <ToggleCard checked={voz}         onChange={e => setVoz(e.target.checked)}         icon={Mic}       label="Voz principal" />
              <ToggleCard checked={backing}     onChange={e => setBacking(e.target.checked)}     icon={Mic2}      label="Backing vocal" />
              <ToggleCard checked={sonoplastia} onChange={e => setSonoplastia(e.target.checked)} icon={Settings2} label="Mesa de som" />
            </div>

            <div className="border-t border-line pt-4">
              <p className="text-xs font-semibold text-ink-2 mb-2">Instrumentos</p>
              <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]">
                {instrumentos.map(inst => (
                  <Pill key={inst.id} tom="brand" className="!text-xs !py-1">
                    {inst.instrumento}
                    <button type="button" onClick={() => removerInstrumento(inst.id, inst.instrumento)} aria-label={`Remover ${inst.instrumento}`}
                      className="ml-0.5 opacity-60 hover:opacity-100 hover:text-danger transition">
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </Pill>
                ))}
                {instrumentos.length === 0 && <span className="text-xs text-ink-2">Nenhum instrumento.</span>}
              </div>
              <div className="flex gap-2 items-end">
                <Select
                  className="flex-1"
                  aria-label="Adicionar instrumento"
                  value={novoInstrumento}
                  onChange={e => setNovoInstrumento(e.target.value)}
                  options={[{ value: '', label: 'Adicionar instrumento…' },
                    ...INSTRUMENTOS.filter(i => !instrumentos.some(mi => mi.instrumento === i)).map(i => ({ value: i, label: i }))]}
                />
                <Button onClick={adicionarInstrumento} disabled={!novoInstrumento} aria-label="Adicionar instrumento"
                  icon={<Plus className="w-5 h-5" aria-hidden="true" />} />
              </div>
            </div>
          </Secao>
        )}

        {/* PERFIL MÍDIA */}
        {isMidia && (
          <Secao icon={Camera} titulo="Mídia">
            <div className="grid grid-cols-3 gap-2">
              <ToggleCard checked={midiaPC}    onChange={e => setMidiaPC(e.target.checked)}    icon={Monitor} label={"PC /\nProjeção"} />
              <ToggleCard checked={midiaFoto}  onChange={e => setMidiaFoto(e.target.checked)}  icon={Camera}  label={"Fotos e\nvídeos"} />
              <ToggleCard checked={midiaRedes} onChange={e => setMidiaRedes(e.target.checked)} icon={PenTool} label={"Redes\nsociais"} />
            </div>
          </Secao>
        )}

        {/* PERFIL INFANTIL */}
        {isInfantil && (
          <Secao icon={Baby} titulo="Infantil">
            <div className="grid grid-cols-2 gap-2">
              {[
                { state: infBercario,    set: setInfBercario,    icon: Baby,           label: 'Berçário' },
                { state: infSala38,      set: setInfSala38,      icon: Smile,          label: 'Sala 03 a 08' },
                { state: infSala911,     set: setInfSala911,     icon: Smile,          label: 'Sala 09 a 11' },
                { state: infAcolhimento, set: setInfAcolhimento, icon: HeartHandshake, label: 'Acolhimento' },
              ].map(({ state, set, icon, label }) => (
                <ToggleCard key={label} checked={state} onChange={e => set(e.target.checked)} icon={icon} label={label} />
              ))}
              <ToggleCard checked={infAuxiliar} onChange={e => setInfAuxiliar(e.target.checked)} icon={Smile} label="Auxiliar" className="col-span-2" />
            </div>
          </Secao>
        )}

        {/* PERFIL DIACONIA */}
        {isDiaconia && (
          <Secao icon={Shield} titulo="Diaconia">
            <ToggleCard checked={diaconia} onChange={e => setDiaconia(e.target.checked)} icon={Shield} label="Atuar na Diaconia" />
          </Secao>
        )}

        <Button full onClick={salvarPerfil} loading={salvando} icon={<Save className="w-5 h-5" aria-hidden="true" />}>
          {salvando ? 'Salvando…' : 'Salvar alterações'}
        </Button>

        {/* APARÊNCIA */}
        <Secao icon={SunMoon} titulo="Aparência">
          <div role="radiogroup" aria-label="Aparência" className="grid grid-cols-3 gap-2">
            {OPCOES_APARENCIA.map((opcao) => {
              const { valor, rotulo } = opcao
              const Icone = opcao.Icone
              const on = preferencia === valor
              return (
                <button key={valor} type="button" role="radio" aria-checked={on} onClick={() => setPreferencia(valor)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-ctl border text-xs font-semibold transition
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                    ${on ? 'bg-brand/10 border-brand text-brand' : 'bg-surface border-line text-ink-2 hover:bg-surface-2'}`}>
                  <Icone className="w-5 h-5" aria-hidden="true" /> {rotulo}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-ink-2">Automático segue o modo claro ou escuro do seu celular.</p>
        </Secao>

        {/* SEGURANÇA — ALTERAR SENHA */}
        <Secao icon={Lock} titulo="Segurança">
          <div>
            <div className="relative">
              <Input label="Nova senha" type={mostrarSenha ? 'text' : 'password'} value={senhaNova}
                onChange={e => setSenhaNova(e.target.value)} placeholder="Mínimo 8 caracteres" />
              <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 bottom-3 text-muted hover:text-ink-2 transition">
                {mostrarSenha ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
            <PasswordStrength password={senhaNova} />
          </div>

          <div className="relative">
            <Input label="Confirmar nova senha" type={mostrarSenha ? 'text' : 'password'} value={confirmarSenha}
              onChange={e => setConfirmarSenha(e.target.value)} placeholder="Repita a nova senha"
              erro={senhasErradas ? 'As senhas não coincidem.' : undefined} />
            {senhasConferem && <CheckCircle2 className="w-4 h-4 text-success absolute right-3 top-[38px]" aria-label="Senhas conferem" />}
          </div>

          <Button full variant="secundario" onClick={alterarSenha} loading={loadingSenha}
            disabled={!senhaNova || !confirmarSenha} icon={<Lock className="w-4 h-4" aria-hidden="true" />}>
            Atualizar senha
          </Button>
        </Secao>

        {/* CONTA */}
        <Card padded={false} className="px-4">
          {ehSuperAdmin && (
            <ListRow titulo="Painel do Dono" subtitulo="Igrejas do sistema" onClick={() => navigate('/painel-dono')}
              icon={<Crown className="w-5 h-5 text-warning" aria-hidden="true" />} />
          )}
          <ListRow titulo="Sair da conta" onClick={sair}
            icon={<LogOut className="w-5 h-5 text-danger" aria-hidden="true" />} />
        </Card>
      </main>
    </div>
  )
}
