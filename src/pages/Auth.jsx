// src/pages/Auth.jsx
import { useState } from 'react'
import { supabase } from '../supabase'
import { concluirCadastroPendente } from '../utils/concluirCadastro'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, ArrowLeft, Mic, Mic2, Settings2, Music, Check, Monitor, Camera, PenTool, Baby, Smile, HeartHandshake, Star, Shield } from 'lucide-react'
import { Button, Card, Input, Logo } from '../components/ui'
import IconeDept from '../theme/IconeDept'

// ✅ Mensagem de login conforme o erro real do Supabase (antes era sempre "senha incorreta")
function mensagemErroLogin(error) {
  const code = error?.code || ''
  const msg = (error?.message || '').toLowerCase()
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
    return '❌ Seu e-mail ainda não foi confirmado. Abra o link que enviamos para a sua caixa de entrada.'
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login')) {
    return '❌ Erro: Email ou senha incorretos.'
  }
  if (code === 'over_request_rate_limit' || error?.status === 429) {
    return '❌ Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  }
  if (error?.name === 'AuthRetryableFetchError' || error?.status === 0 || msg.includes('fetch')) {
    return '❌ Sem conexão com o servidor. Verifique a internet e tente de novo.'
  }
  return '❌ Não foi possível entrar agora. Tente novamente.'
}

export default function Auth() {
  const navigate = useNavigate()

  // Controladores de Tela
  const [isSignUp, setIsSignUp] = useState(false)
  const [step, setStep] = useState(1) 
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState('')

  // Passo 1: Dados Pessoais
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Código de convite da igreja (obrigatório no cadastro)
  const [codigoConvite, setCodigoConvite] = useState('')
  
  // Passo 2: Departamentos
  const [departamentosDB, setDepartamentosDB] = useState([])
  const [selectedDepts, setSelectedDepts] = useState([])
  
  // Funções: LOUVOR
  const [voz, setVoz] = useState(false)
  const [conducao, setConducao] = useState(false)
  const [backingVocal, setBackingVocal] = useState(false)
  const [sonoplastia, setSonoplastia] = useState(false)
  const [meusInstrumentos, setMeusInstrumentos] = useState([])
  const listaInstrumentos = ['Violão', 'Guitarra', 'Teclado', 'Bateria', 'Baixo', 'Percussão']

  // Funções: MÍDIA
  const [midiaComputador, setMidiaComputador] = useState(false)
  const [midiaFotografia, setMidiaFotografia] = useState(false)
  const [midiaRedacao, setMidiaRedacao] = useState(false)

  // Funções: INFANTIL
  const [infBercario, setInfBercario] = useState(false)
  const [infSala38, setInfSala38] = useState(false)
  const [infSala911, setInfSala911] = useState(false)
  const [infAcolhimento, setInfAcolhimento] = useState(false)
  const [infAuxiliar, setInfAuxiliar] = useState(false)

  // ✅ Funções: DIACONIA (Apenas 1 função geral)
  const [diaconiaGeral, setDiaconiaGeral] = useState(false)

  // Os departamentos agora são buscados DEPOIS de validar o código de convite
  // (durante o cadastro o usuário ainda não tem igreja, então o RLS esconde tudo).
  // Para login, não precisamos da lista de departamentos aqui.

  // Detetores de departamentos selecionados
  const isLouvorSelected = selectedDepts.includes(departamentosDB.find(d => d.nome === 'Louvor')?.id)
  const isMidiaSelected = selectedDepts.includes(departamentosDB.find(d => d.nome === 'Mídia')?.id)
  const isInfantilSelected = selectedDepts.includes(departamentosDB.find(d => d.nome === 'Infantil')?.id)
  const isDiaconiaSelected = selectedDepts.includes(departamentosDB.find(d => d.nome === 'Diaconia')?.id) // ✅ DIACONIA

  const toggleDept = (id) => {
    if (selectedDepts.includes(id)) setSelectedDepts(selectedDepts.filter(d => d !== id))
    else setSelectedDepts([...selectedDepts, id])
  }

  const toggleInstrumento = (inst) => {
    if (meusInstrumentos.includes(inst)) setMeusInstrumentos(meusInstrumentos.filter(i => i !== inst))
    else setMeusInstrumentos([...meusInstrumentos, inst])
  }

  const resetTelas = (paraCadastro) => {
    setIsSignUp(paraCadastro)
    setStep(1)
    setMensagem('')
    // ✅ Login e cadastro usam o mesmo estado de senha: limpa ao trocar de tela
    // para a senha digitada num formulário não aparecer no outro
    setPassword('')
    setConfirmPassword('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMensagem('')
    
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) {
      setMensagem(mensagemErroLogin(error))
      setLoading(false)
      return
    }

    // ✅ Primeiro login após confirmar o e-mail: grava igreja, departamentos e instrumentos
    const { ok, erros } = await concluirCadastroPendente(data.user)
    setLoading(false)
    if (!ok) {
      setMensagem(`⚠️ Login feito, mas não conseguimos concluir o cadastro (${erros.join(', ')}). Tentaremos de novo no próximo login.`)
      setTimeout(() => navigate('/hub'), 4000)
      return
    }
    navigate('/hub')
  }

  async function handleResetPassword() {
    if (loading) return
    // ✅ Mesmo formato do login (sem espaços, minúsculo)
    const emailLimpo = email.trim().toLowerCase()
    if (!emailLimpo) {
      setMensagem('❌ Digite o seu e-mail acima para redefinir a senha.')
      return
    }
    setLoading(true)
    setMensagem('')

    // ✅ O link do e-mail entra logado e abre o Perfil, onde dá para trocar a senha
    const { error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
      redirectTo: `${window.location.origin}/perfil`,
    })
    
    if (error) {
      console.error('Erro ao recuperar senha:', error)
      setMensagem('❌ Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
    } else {
      setMensagem('✅ E-mail de recuperação enviado! Verifique a sua caixa de entrada.')
    }
    setLoading(false)
  }

  async function handleNextStep(e) {
    e.preventDefault() 
    if (loading) return
    if (!nome.trim() || !email.trim() || password.length < 8) {
      setMensagem('❌ Preencha tudo corretamente (Senha mín. 8 caracteres).')
      return
    }
    if (password !== confirmPassword) {
      setMensagem('❌ As senhas não coincidem. Verifique e tente novamente.')
      return
    }
    if (!codigoConvite.trim()) {
      setMensagem('❌ Digite o código de convite da sua igreja.')
      return
    }

    // ✅ Valida o código de convite no banco
    setLoading(true)
    const { data: igrejas, error } = await supabase
      .rpc('validar_codigo_convite', { codigo: codigoConvite.trim() })
    setLoading(false)

    if (error || !igrejas || igrejas.length === 0) {
      setMensagem('❌ Código de convite inválido. Confira com o líder da sua igreja.')
      return
    }


    // ✅ Busca os departamentos da igreja validada (via função que ignora RLS)
    const { data: depts } = await supabase
      .rpc('departamentos_por_codigo', { codigo: codigoConvite.trim() })
    if (depts) setDepartamentosDB(depts)

    setMensagem('')
    setStep(2)
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMensagem('')

    // Funções escolhidas no passo 2 (vão para o perfil)
    const funcoes = {
      voz, conducao, backing_vocal: backingVocal, sonoplastia,
      midia_computador: midiaComputador, midia_fotografia: midiaFotografia, midia_redacao: midiaRedacao,
      infantil_bercario: infBercario, infantil_sala3_8: infSala38, infantil_sala9_11: infSala911, infantil_acolhimento: infAcolhimento, infantil_auxiliar: infAuxiliar,
      diaconia: diaconiaGeral // ✅ FORÇA O GATILHO DA DIACONIA
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: {
          data: { 
            nome: nome.trim(), 
            ...funcoes, // ✅ inclui a DIACONIA
            // ✅ Tudo que precisa de sessão para ser gravado fica aqui até o primeiro login.
            // Sem isso, quando o Supabase exige confirmação de e-mail, o signUp volta
            // sem sessão e o RLS bloqueia perfil/departamentos/instrumentos em silêncio.
            cadastro_pendente: {
              // ✅ O servidor valida o código e vincula à igreja (RPC entrar_na_igreja)
              codigo_convite: codigoConvite.trim(),
              funcoes,
              departamentos: selectedDepts,
              instrumentos: meusInstrumentos,
            }
          }
        }
      })

      if (authError) throw authError

      if (authData?.user) {
        // A igreja começa SEM admin. O super-admin (dono do sistema)
        // define quem é admin pelo Painel do Dono.

        if (authData.session) {
          // Já logado: grava agora (perfil antes dos vínculos, por causa do RLS)
          const { ok, erros } = await concluirCadastroPendente(authData.user)
          if (!ok) {
            setMensagem(`⚠️ Conta criada, mas não conseguimos salvar: ${erros.join(', ')}. Vamos tentar de novo no próximo login — confira seu perfil.`)
            setTimeout(() => navigate('/hub'), 4000)
            return
          }
          setMensagem('✅ Sucesso! A redirecionar...')
          setTimeout(() => navigate('/hub'), 1500)
        } else {
          // Sem sessão (confirmação de e-mail): o cadastro é concluído no primeiro login
          setMensagem('✅ Conta criada! Confirme o seu e-mail e faça login para concluir o cadastro.')
          setTimeout(() => resetTelas(false), 4000)
        }
      }
    } catch (error) {
      console.error('Erro ao criar conta:', error)
      // Erro comum: email já cadastrado — dá uma dica útil
      const msg = error.message?.toLowerCase().includes('already') || error.message?.toLowerCase().includes('registered')
        ? '❌ Este e-mail já está cadastrado. Tente fazer login.'
        : '❌ Não foi possível criar a conta. Tente novamente.'
      setMensagem(msg)
    } finally {
      setLoading(false)
    }
  }

  const erro = mensagem && !mensagem.includes('✅')
  const Mensagem = () => mensagem ? (
    <p role={erro ? 'alert' : 'status'}
      className={`text-sm font-semibold text-center rounded-ctl px-3 py-2 ${erro ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}>
      {mensagem.replace(/^(❌|✅|⚠️)\s*/u, '')}
    </p>
  ) : null

  const titulo = !isSignUp ? 'Entrar' : step === 1 ? 'Criar conta' : 'Onde você serve?'
  const subtitulo = !isSignUp ? 'Acesse suas escalas e avisos.' : step === 1 ? 'Passo 1 de 2 · seus dados' : 'Passo 2 de 2 · departamentos e funções'

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Topo roxo com o logo */}
      <div className="bg-topo text-white text-center px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-14">
        <Logo variante="branco" className="h-12 mx-auto" />
        <p className="text-xs text-white/80 mt-2">Ser chamado · Vir para cumprir</p>
      </div>

      <main className="w-full max-w-sm mx-auto px-4 -mt-8 flex-1">
        <Card className="space-y-4 !p-5">
          <div>
            <h1 className="text-xl font-bold text-ink">{titulo}</h1>
            <p className="text-xs text-ink-2 mt-0.5">{subtitulo}</p>
          </div>

          {/* LOGIN */}
          {!isSignUp && (
            <form onSubmit={handleLogin} className="space-y-3">
              <Input label="E-mail" type="email" required autoComplete="email" placeholder="seu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="w-4 h-4" aria-hidden="true" />} />
              <div>
                <Input label="Senha" type="password" required autoComplete="current-password" placeholder="Sua senha"
                  value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock className="w-4 h-4" aria-hidden="true" />} />
                <div className="flex justify-end mt-1.5">
                  <button type="button" onClick={handleResetPassword} disabled={loading}
                    className="text-xs font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
                    Esqueci a senha
                  </button>
                </div>
              </div>
              <Mensagem />
              <Button type="submit" full loading={loading} icon={!loading && <ArrowRight className="w-4 h-4" aria-hidden="true" />}>
                Entrar
              </Button>
            </form>
          )}

          {/* CADASTRO — PASSO 1 */}
          {isSignUp && step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-3">
              <Input label="Nome completo" required autoComplete="name" placeholder="Maria da Silva"
                value={nome} onChange={(e) => setNome(e.target.value)} icon={<User className="w-4 h-4" aria-hidden="true" />} />
              <Input label="E-mail" type="email" required autoComplete="email" placeholder="seu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="w-4 h-4" aria-hidden="true" />} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Senha" type="password" required minLength={8} autoComplete="new-password" placeholder="Mín. 8"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <Input label="Confirmar" type="password" required minLength={8} autoComplete="new-password" placeholder="Repita"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Input label="Código de convite" required maxLength={6} placeholder="ABC123"
                className="[&_input]:uppercase [&_input]:tracking-widest [&_input]:font-bold"
                value={codigoConvite} onChange={(e) => setCodigoConvite(e.target.value.toUpperCase())}
                icon={<Star className="w-4 h-4" aria-hidden="true" />} />
              <Mensagem />
              <Button type="submit" full loading={loading} icon={!loading && <ArrowRight className="w-4 h-4" aria-hidden="true" />}>
                Continuar
              </Button>
            </form>
          )}

          {/* CADASTRO — PASSO 2 */}
          {isSignUp && step === 2 && (
            <div className="space-y-4">
              <fieldset>
                <legend className="text-xs font-semibold text-ink-2 mb-2">Departamentos</legend>
                <div className="grid grid-cols-2 gap-2">
                  {departamentosDB.map(dept => {
                    const on = selectedDepts.includes(dept.id)
                    return (
                      <label key={dept.id}
                        className={`flex items-center gap-2 p-2.5 rounded-ctl border cursor-pointer transition text-xs font-semibold
                          has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand
                          ${on ? 'bg-brand/10 border-brand text-brand' : 'bg-surface border-line text-ink-2 hover:bg-surface-2'}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleDept(dept.id)} />
                        <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${on ? 'bg-brand border-brand' : 'border-line'}`}>
                          {on && <Check className="w-3 h-3 text-on-brand" aria-hidden="true" />}
                        </span>
                        <IconeDept nome={dept.nome} className="w-4 h-4" />
                        <span className="truncate">{dept.nome}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {isLouvorSelected && (
                <GrupoFuncoes icon={Music} titulo="Louvor">
                  <OptionCheckbox icon={Star} label="Condução" checked={conducao} onChange={setConducao} />
                  <OptionCheckbox icon={Mic} label="Voz principal" checked={voz} onChange={setVoz} />
                  <OptionCheckbox icon={Mic2} label="Backing" checked={backingVocal} onChange={setBackingVocal} />
                  <OptionCheckbox icon={Settings2} label="Sonoplastia" checked={sonoplastia} onChange={setSonoplastia} />
                  <div className="col-span-2 flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Instrumentos">
                    {listaInstrumentos.map(inst => {
                      const on = meusInstrumentos.includes(inst)
                      return (
                        <button key={inst} type="button" aria-pressed={on} onClick={() => toggleInstrumento(inst)}
                          className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                            ${on ? 'bg-brand/10 border-brand text-brand' : 'bg-surface border-line text-ink-2'}`}>
                          {inst}
                        </button>
                      )
                    })}
                  </div>
                </GrupoFuncoes>
              )}

              {isMidiaSelected && (
                <GrupoFuncoes icon={Camera} titulo="Mídia">
                  <OptionCheckbox icon={Monitor} label="Computador" checked={midiaComputador} onChange={setMidiaComputador} />
                  <OptionCheckbox icon={Camera} label="Fotografia" checked={midiaFotografia} onChange={setMidiaFotografia} />
                  <OptionCheckbox icon={PenTool} label="Redação" checked={midiaRedacao} onChange={setMidiaRedacao} />
                </GrupoFuncoes>
              )}

              {isInfantilSelected && (
                <GrupoFuncoes icon={Baby} titulo="Infantil">
                  <OptionCheckbox icon={Baby} label="Berçário" checked={infBercario} onChange={setInfBercario} />
                  <OptionCheckbox icon={Smile} label="Sala 03-08" checked={infSala38} onChange={setInfSala38} />
                  <OptionCheckbox icon={Smile} label="Sala 09-11" checked={infSala911} onChange={setInfSala911} />
                  <OptionCheckbox icon={HeartHandshake} label="Acolhimento" checked={infAcolhimento} onChange={setInfAcolhimento} />
                  <OptionCheckbox icon={HeartHandshake} label="Auxiliar" checked={infAuxiliar} onChange={setInfAuxiliar} />
                </GrupoFuncoes>
              )}

              {isDiaconiaSelected && (
                <GrupoFuncoes icon={Shield} titulo="Diaconia">
                  <OptionCheckbox icon={Shield} label="Atuar na Diaconia" checked={diaconiaGeral} onChange={setDiaconiaGeral} />
                </GrupoFuncoes>
              )}

              <Mensagem />
              <div className="flex gap-2">
                <Button variant="secundario" onClick={() => setStep(1)} aria-label="Voltar ao passo 1"
                  icon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />} />
                <Button className="flex-1" onClick={handleRegister} loading={loading}>Finalizar cadastro</Button>
              </div>
            </div>
          )}
        </Card>

        <p className="text-center text-sm text-ink-2 py-6">
          {isSignUp ? 'Já tem conta?' : 'Tem um código de convite?'}{' '}
          <button type="button" onClick={() => resetTelas(!isSignUp)}
            className="font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
            {isSignUp ? 'Entrar' : 'Criar minha conta'}
          </button>
        </p>
      </main>
    </div>
  )
}

// ── Peças do passo 2 (fora do componente para não recriar a cada render) ─────
function GrupoFuncoes({ icon, titulo, children }) {
  const Icon = icon
  return (
    <fieldset className="border-t border-line pt-3">
      <legend className="text-xs font-semibold text-ink-2 flex items-center gap-1.5 pr-2">
        <Icon className="w-3.5 h-3.5 text-brand" aria-hidden="true" /> {titulo}
      </legend>
      <div className="grid grid-cols-2 gap-2 mt-2">{children}</div>
    </fieldset>
  )
}

function OptionCheckbox({ icon, label, checked, onChange }) {
  const Icon = icon
  return (
    <label className={`flex items-center gap-2 p-2.5 rounded-ctl border cursor-pointer transition text-xs font-semibold
      has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand
      ${checked ? 'bg-brand/10 border-brand text-brand' : 'bg-surface border-line text-ink-2 hover:bg-surface-2'}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}
