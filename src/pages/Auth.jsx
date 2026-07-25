// src/pages/Auth.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, ArrowLeft, Mic, Mic2, Settings2, Music, Check, Monitor, Camera, PenTool, Baby, Smile, HeartHandshake, Star, Shield } from 'lucide-react'

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
  const [igrejaValidada, setIgrejaValidada] = useState(null) // { igreja_id, igreja_nome }
  
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
    setConfirmPassword('') 
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setMensagem('')
    
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) setMensagem('❌ Erro: Email ou senha incorretos.')
    else navigate('/hub')
    
    setLoading(false)
  }

  async function handleResetPassword() {
    if (!email) {
      setMensagem('❌ Digite o seu e-mail acima para redefinir a senha.')
      return
    }
    setLoading(true)
    setMensagem('')
    
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    
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
    if (!nome.trim() || !email.trim() || password.length < 6) {
      setMensagem('❌ Preencha tudo corretamente (Senha mín. 6 caracteres).')
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

    setIgrejaValidada(igrejas[0])

    // ✅ Busca os departamentos da igreja validada (via função que ignora RLS)
    const { data: depts } = await supabase
      .rpc('departamentos_por_codigo', { codigo: codigoConvite.trim() })
    if (depts) setDepartamentosDB(depts)

    setMensagem('')
    setStep(2)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setMensagem('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: {
          data: { 
            nome: nome.trim(), 
            voz, conducao, backing_vocal: backingVocal, sonoplastia, 
            midia_computador: midiaComputador, midia_fotografia: midiaFotografia, midia_redacao: midiaRedacao,
            infantil_bercario: infBercario, infantil_sala3_8: infSala38, infantil_sala9_11: infSala911, infantil_acolhimento: infAcolhimento, infantil_auxiliar: infAuxiliar,
            diaconia: diaconiaGeral // ✅ SALVA A DIACONIA
          }
        }
      })

      if (authError) throw authError

      if (authData?.user) {

        // ✅ PRIMEIRO: salva o igreja_id e funções no perfil.
        // Isso precisa vir ANTES de inserir departamentos, porque o RLS
        // usa o igreja_id do perfil para liberar a inserção dos vínculos.
        const { error: erroPerfil } = await supabase.from('users_profile').update({
          igreja_id: igrejaValidada?.igreja_id, // ✅ Vincula à igreja do código de convite
          voz, conducao, backing_vocal: backingVocal, sonoplastia,
          midia_computador: midiaComputador, midia_fotografia: midiaFotografia, midia_redacao: midiaRedacao,
          infantil_bercario: infBercario, infantil_sala3_8: infSala38, infantil_sala9_11: infSala911, infantil_acolhimento: infAcolhimento, infantil_auxiliar: infAuxiliar,
          diaconia: diaconiaGeral // ✅ FORÇA O GATILHO DA DIACONIA
        }).eq('id', authData.user.id)
        if (erroPerfil) console.warn('Erro ao salvar perfil:', erroPerfil.message)

        // DEPOIS: insere os departamentos (agora o RLS já reconhece a igreja)
        if (selectedDepts.length > 0) {
          const deptsToInsert = selectedDepts.map(id => ({ user_id: authData.user.id, departamento_id: id, role: 'membro' }))
          const { error: erroDepts } = await supabase.from('membros_departamentos').insert(deptsToInsert)
          if (erroDepts) console.warn('Erro ao salvar departamentos:', erroDepts.message)
        }

        // A igreja começa SEM admin. O super-admin (dono do sistema)
        // define quem é admin pelo Painel do Dono.

        if (meusInstrumentos.length > 0) {
          const instsToInsert = meusInstrumentos.map(inst => ({ user_id: authData.user.id, instrumento: inst }))
          await supabase.from('user_instruments').insert(instsToInsert)
        }

        if (authData.session) {
          setMensagem('✅ Sucesso! A redirecionar...')
          setTimeout(() => navigate('/hub'), 1500)
        } else {
          setMensagem('✅ Conta criada! Faça login para entrar.')
          setTimeout(() => resetTelas(false), 2500)
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

  const OptionCheckbox = ({ icon, label, checked, onChange, colorClass }) => (
    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition flex-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`w-4 h-4 rounded focus:ring-opacity-50 ${colorClass}`} />
      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">{icon} {label}</span>
    </label>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 pt-12 overflow-hidden relative">
      
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <picture>
          <source srcSet="/logo.webp" type="image/webp" />
          <img src="/logo.png" alt="" className="w-[800px] h-[800px] object-contain" />
        </picture>
      </div>

      <div className="hidden md:block relative w-full max-w-4xl h-[650px] bg-white rounded-3xl shadow-2xl overflow-hidden z-10">
        
        {/* LOGIN */}
        <div className={`absolute top-0 left-0 w-1/2 h-full flex flex-col justify-center px-14 transition-all duration-700 ease-in-out ${isSignUp ? 'translate-x-[100%] opacity-0 z-10' : 'translate-x-0 opacity-100 z-20'}`}>
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img src="/logo.png" alt="Logo" className="w-40 h-40 object-contain mb-6 drop-shadow-md" />
          </picture>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo de volta!</h1>
          <p className="text-sm text-gray-500 mb-8">Faça login para acessar o sistema</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
              <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                <input type="password" required placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="flex justify-end mt-2">
                <button type="button" onClick={handleResetPassword} disabled={loading} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition active:scale-[0.97] hover:underline">
                  Esqueceu a senha?
                </button>
              </div>
            </div>

            {mensagem && !isSignUp && <p className={`text-sm font-bold text-center mt-2 py-2 rounded-lg ${mensagem.includes('✅') ? 'text-green-700 bg-green-50' : 'text-red-500 bg-red-50'}`}>{mensagem}</p>}
            
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold rounded-xl py-3.5 mt-2 hover:bg-blue-700 transition active:scale-[0.97] shadow-md">
              {loading ? 'Aguarde...' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>

        {/* REGISTO */}
        <div className={`absolute top-0 left-0 w-1/2 h-full flex flex-col justify-center px-12 transition-all duration-700 ease-in-out ${isSignUp ? 'translate-x-[100%] opacity-100 z-20' : 'translate-x-0 opacity-0 z-10'}`}>
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain mb-4 drop-shadow-md" />
            </picture>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Criar Conta</h1>
              <p className="text-sm text-gray-500 mb-6">Passo 1: Insira os seus dados pessoais.</p>
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
                  <input type="text" required placeholder="Nome Completo" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                  <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-4 w-4 text-gray-400" /></div>
                    <input type="password" required placeholder="Senha (Mín. 6)" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 pl-10 pr-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Check className="h-4 w-4 text-gray-400" /></div>
                    <input type="password" required placeholder="Confirmar Senha" minLength="6" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 pl-10 pr-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Star className="h-5 w-5 text-gray-400" /></div>
                  <input type="text" required placeholder="Código de convite" value={codigoConvite} onChange={(e) => setCodigoConvite(e.target.value.toUpperCase())} maxLength={6} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none uppercase tracking-widest font-bold" />
                </div>
                {mensagem && isSignUp && <p className="text-sm font-bold text-center text-red-500 mt-2 bg-red-50 py-2 rounded-lg">{mensagem}</p>}
                <button type="submit" className="w-full bg-blue-600 text-white font-bold rounded-xl py-3 mt-2 hover:bg-blue-700 transition active:scale-[0.97] shadow-md flex justify-center items-center gap-2">
                  Continuar <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full py-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-blue-600 transition mb-3 w-fit">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
              
              <div className="flex-1 overflow-y-auto pr-3 space-y-5 customized-scrollbar">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-3">Onde você serve?</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {departamentosDB.map(dept => (
                      <label key={dept.id} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${selectedDepts.includes(dept.id) ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                        <input type="checkbox" className="hidden" checked={selectedDepts.includes(dept.id)} onChange={() => toggleDept(dept.id)} />
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${selectedDepts.includes(dept.id) ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300'}`}>
                          {selectedDepts.includes(dept.id) && <Check className="w-3 h-3" />}
                        </div>
                        <span className="text-xs font-bold">{dept.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {isLouvorSelected && (
                  <div className="pt-4 border-t border-gray-100 animate-in fade-in duration-300">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Music className="w-4 h-4 text-blue-500"/> Louvor</h2>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <OptionCheckbox icon={<Star className="w-3.5 h-3.5 text-yellow-500"/>} label="Condução" checked={conducao} onChange={setConducao} colorClass="text-yellow-600" />
                      <OptionCheckbox icon={<Mic className="w-3.5 h-3.5 text-blue-500"/>} label="Voz Principal" checked={voz} onChange={setVoz} colorClass="text-blue-600" />
                      <OptionCheckbox icon={<Mic2 className="w-3.5 h-3.5 text-purple-500"/>} label="Backing" checked={backingVocal} onChange={setBackingVocal} colorClass="text-purple-600" />
                      <OptionCheckbox icon={<Settings2 className="w-3.5 h-3.5 text-gray-500"/>} label="Sonoplastia" checked={sonoplastia} onChange={setSonoplastia} colorClass="text-gray-600" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {listaInstrumentos.map(inst => (
                        <button key={inst} type="button" onClick={() => toggleInstrumento(inst)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${meusInstrumentos.includes(inst) ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>{inst}</button>
                      ))}
                    </div>
                  </div>
                )}

                {isMidiaSelected && (
                  <div className="pt-4 border-t border-gray-100 animate-in fade-in duration-300">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Camera className="w-4 h-4 text-purple-500"/> Mídia</h2>
                    <div className="grid grid-cols-2 gap-2">
                      <OptionCheckbox icon={<Monitor className="w-3.5 h-3.5 text-indigo-500"/>} label="Computador" checked={midiaComputador} onChange={setMidiaComputador} colorClass="text-indigo-600" />
                      <OptionCheckbox icon={<Camera className="w-3.5 h-3.5 text-pink-500"/>} label="Fotografia" checked={midiaFotografia} onChange={setMidiaFotografia} colorClass="text-pink-600" />
                      <OptionCheckbox icon={<PenTool className="w-3.5 h-3.5 text-orange-500"/>} label="Redação" checked={midiaRedacao} onChange={setMidiaRedacao} colorClass="text-orange-600" />
                    </div>
                  </div>
                )}

                {isInfantilSelected && (
                  <div className="pt-4 border-t border-gray-100 animate-in fade-in duration-300">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Baby className="w-4 h-4 text-pink-500"/> Infantil</h2>
                    <div className="grid grid-cols-2 gap-2">
                      <OptionCheckbox icon={<Baby className="w-3.5 h-3.5 text-pink-400"/>} label="Berçário" checked={infBercario} onChange={setInfBercario} colorClass="text-pink-500" />
                      <OptionCheckbox icon={<Smile className="w-3.5 h-3.5 text-yellow-500"/>} label="Sala 03 - 08" checked={infSala38} onChange={setInfSala38} colorClass="text-yellow-500" />
                      <OptionCheckbox icon={<Smile className="w-3.5 h-3.5 text-green-500"/>} label="Sala 09 - 11" checked={infSala911} onChange={setInfSala911} colorClass="text-green-500" />
                      <OptionCheckbox icon={<HeartHandshake className="w-3.5 h-3.5 text-red-400"/>} label="Acolhimento" checked={infAcolhimento} onChange={setInfAcolhimento} colorClass="text-red-500" />
                      <OptionCheckbox icon={<HeartHandshake className="w-3.5 h-3.5 text-blue-400"/>} label="Auxiliar" checked={infAuxiliar} onChange={setInfAuxiliar} colorClass="text-blue-500" />
                    </div>
                  </div>
                )}

                {/* ✅ NOVO: MÓDULO DA DIACONIA */}
                {isDiaconiaSelected && (
                  <div className="pt-4 border-t border-gray-100 animate-in fade-in duration-300">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Shield className="w-4 h-4 text-gray-800"/> Diaconia</h2>
                    <div className="flex gap-2">
                      <OptionCheckbox icon={<Shield className="w-3.5 h-3.5 text-gray-700"/>} label="Atuar na Diaconia" checked={diaconiaGeral} onChange={setDiaconiaGeral} colorClass="text-gray-900" />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="pt-4 mt-auto">
                {mensagem && isSignUp && <p className={`text-sm font-bold text-center mb-2 py-2 rounded-lg ${mensagem.includes('❌') ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>{mensagem}</p>}
                <button type="button" onClick={handleRegister} disabled={loading} className="w-full bg-blue-600 text-white font-bold rounded-xl py-3.5 hover:bg-blue-700 transition active:scale-[0.97] shadow-md disabled:opacity-50">
                  {loading ? 'Aguarde...' : 'Finalizar Cadastro'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PAINEL DESLIZANTE */}
        <div className={`absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-50 ${isSignUp ? '-translate-x-[100%]' : 'translate-x-0'} pointer-events-none`}>
          <div className={`bg-gradient-to-br from-blue-600 to-indigo-700 relative -left-[100%] h-full w-[200%] transition-transform duration-700 ease-in-out pointer-events-auto ${isSignUp ? 'translate-x-1/2' : 'translate-x-0'}`}>
            <div className={`absolute top-0 right-0 w-1/2 h-full flex flex-col items-center justify-center p-14 text-center text-white transition-transform duration-700 ease-in-out ${isSignUp ? 'translate-x-[20%]' : 'translate-x-0'}`}>
              <h2 className="text-4xl font-bold mb-4">Novo aqui?</h2>
              <p className="text-base font-medium text-blue-100 mb-8 leading-relaxed">Crie a sua conta agora para acompanhar as suas escalas e compromissos na igreja.</p>
              <button onClick={() => resetTelas(true)} className="border-2 border-white text-white font-bold rounded-xl py-3 px-12 hover:bg-white hover:text-blue-600 transition">
                CRIAR CONTA
              </button>
            </div>
            <div className={`absolute top-0 left-0 w-1/2 h-full flex flex-col items-center justify-center p-14 text-center text-white transition-transform duration-700 ease-in-out ${isSignUp ? 'translate-x-0' : '-translate-x-[20%]'}`}>
              <h2 className="text-4xl font-bold mb-4">Já é Membro?</h2>
              <p className="text-base font-medium text-blue-100 mb-8 leading-relaxed">Se já possui uma conta registada, faça login para entrar no seu portal.</p>
              <button onClick={() => resetTelas(false)} className="border-2 border-white text-white font-bold rounded-xl py-3 px-12 hover:bg-white hover:text-blue-600 transition">
                FAZER LOGIN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =======================================================
        📱 VERSÃO MOBILE
        ======================================================= */}
      <div className="md:hidden w-full max-w-md bg-white rounded-3xl shadow-xl z-10 relative mt-16">
        
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white p-2 rounded-full shadow-md z-20">
          <picture>
          <source srcSet="/logo.webp" type="image/webp" />
          <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain rounded-full bg-gray-50" />
        </picture>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 pt-14 text-white text-center rounded-t-3xl rounded-b-[40px] shadow-sm">
          <h1 className="text-2xl font-bold mb-2">{!isSignUp ? 'Bem-vindo!' : step === 1 ? 'Criar Conta' : 'Quase lá...'}</h1>
          <p className="text-blue-100 text-sm">{!isSignUp ? 'Faça login na sua conta.' : step === 1 ? 'Passo 1: Dados Pessoais' : 'Passo 2: Seus Departamentos'}</p>
        </div>

        <div className="p-6 pt-6">
          
          {/* LOGIN MOBILE */}
          {!isSignUp && (
            <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-300">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                  <input type="password" required placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex justify-end mt-2">
                  <button type="button" onClick={handleResetPassword} disabled={loading} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition active:scale-[0.97] hover:underline">
                    Esqueceu a senha?
                  </button>
                </div>
              </div>

              {mensagem && <p className={`text-sm font-bold text-center mt-2 ${mensagem.includes('✅') ? 'text-green-700' : 'text-red-500'}`}>{mensagem}</p>}
              
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold rounded-xl py-4 mt-2 hover:bg-blue-700 transition active:scale-[0.97] flex justify-center items-center gap-2 shadow-md">
                {loading ? 'Aguarde...' : 'Entrar'} <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* CADASTRO MOBILE (PASSO 1) */}
          {isSignUp && step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
                <input type="text" required placeholder="Nome Completo" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                <input type="password" required placeholder="Senha (mín. 6)" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Check className="h-5 w-5 text-gray-400" /></div>
                <input type="password" required placeholder="Confirme sua senha" minLength="6" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Star className="h-5 w-5 text-gray-400" /></div>
                <input type="text" required placeholder="Código de convite" value={codigoConvite} onChange={(e) => setCodigoConvite(e.target.value.toUpperCase())} maxLength={6} className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none uppercase tracking-widest font-bold" />
              </div>

              {mensagem && <p className="text-sm font-bold text-center mt-2 text-red-500">{mensagem}</p>}
              
              <button type="submit" className="w-full bg-blue-600 text-white font-bold rounded-xl py-4 mt-2 hover:bg-blue-700 transition active:scale-[0.97] flex justify-center items-center gap-2 shadow-md">
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* CADASTRO MOBILE (PASSO 2) */}
          {isSignUp && step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="max-h-[350px] overflow-y-auto pr-2 space-y-5 customized-scrollbar">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Departamentos:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {departamentosDB.map(dept => (
                      <label key={dept.id} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition ${selectedDepts.includes(dept.id) ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        <input type="checkbox" className="hidden" checked={selectedDepts.includes(dept.id)} onChange={() => toggleDept(dept.id)} />
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${selectedDepts.includes(dept.id) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
                          {selectedDepts.includes(dept.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs font-bold">{dept.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {isLouvorSelected && (
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Music className="w-3.5 h-3.5 text-blue-500"/> Louvor</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <OptionCheckbox icon={<Star className="w-3.5 h-3.5 text-yellow-500"/>} label="Condução" checked={conducao} onChange={setConducao} colorClass="text-yellow-600" />
                      <OptionCheckbox icon={<Mic className="w-3.5 h-3.5 text-blue-500"/>} label="Voz Principal" checked={voz} onChange={setVoz} colorClass="text-blue-600" />
                      <OptionCheckbox icon={<Mic2 className="w-3.5 h-3.5 text-purple-500"/>} label="Backing" checked={backingVocal} onChange={setBackingVocal} colorClass="text-purple-600" />
                      <OptionCheckbox icon={<Settings2 className="w-3.5 h-3.5 text-gray-500"/>} label="Sonoplastia" checked={sonoplastia} onChange={setSonoplastia} colorClass="text-gray-600" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {listaInstrumentos.map(inst => (
                        <button key={inst} type="button" onClick={() => toggleInstrumento(inst)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold ${meusInstrumentos.includes(inst) ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>{inst}</button>
                      ))}
                    </div>
                  </div>
                )}

                {isMidiaSelected && (
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Camera className="w-3.5 h-3.5 text-purple-500"/> Mídia</label>
                    <div className="grid grid-cols-2 gap-2">
                      <OptionCheckbox icon={<Monitor className="w-3.5 h-3.5 text-indigo-500"/>} label="Computador" checked={midiaComputador} onChange={setMidiaComputador} colorClass="text-indigo-600" />
                      <OptionCheckbox icon={<Camera className="w-3.5 h-3.5 text-pink-500"/>} label="Fotografia" checked={midiaFotografia} onChange={setMidiaFotografia} colorClass="text-pink-600" />
                      <OptionCheckbox icon={<PenTool className="w-3.5 h-3.5 text-orange-500"/>} label="Redação" checked={midiaRedacao} onChange={setMidiaRedacao} colorClass="text-orange-600" />
                    </div>
                  </div>
                )}

                {isInfantilSelected && (
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Baby className="w-3.5 h-3.5 text-pink-500"/> Infantil</label>
                    <div className="grid grid-cols-2 gap-2">
                      <OptionCheckbox icon={<Baby className="w-3.5 h-3.5 text-pink-400"/>} label="Berçário" checked={infBercario} onChange={setInfBercario} colorClass="text-pink-500" />
                      <OptionCheckbox icon={<Smile className="w-3.5 h-3.5 text-yellow-500"/>} label="Sala 03-08" checked={infSala38} onChange={setInfSala38} colorClass="text-yellow-500" />
                      <OptionCheckbox icon={<Smile className="w-3.5 h-3.5 text-green-500"/>} label="Sala 09-11" checked={infSala911} onChange={setInfSala911} colorClass="text-green-500" />
                      <OptionCheckbox icon={<HeartHandshake className="w-3.5 h-3.5 text-red-400"/>} label="Acolher" checked={infAcolhimento} onChange={setInfAcolhimento} colorClass="text-red-500" />
                      <OptionCheckbox icon={<HeartHandshake className="w-3.5 h-3.5 text-blue-400"/>} label="Auxiliar" checked={infAuxiliar} onChange={setInfAuxiliar} colorClass="text-blue-500" />
                    </div>
                  </div>
                )}

                {/* ✅ NOVO: MÓDULO DA DIACONIA NO MOBILE */}
                {isDiaconiaSelected && (
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-gray-800"/> Diaconia</label>
                    <div className="flex gap-2">
                      <OptionCheckbox icon={<Shield className="w-3.5 h-3.5 text-gray-700"/>} label="Atuar na Diaconia" checked={diaconiaGeral} onChange={setDiaconiaGeral} colorClass="text-gray-900" />
                    </div>
                  </div>
                )}
              </div>
              
              {mensagem && isSignUp && <p className={`text-sm font-bold text-center mt-3 py-1 rounded ${mensagem.includes('❌') ? 'text-red-600' : 'text-green-700'}`}>{mensagem}</p>}
              
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setStep(1)} className="p-3.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200"><ArrowLeft className="w-5 h-5" /></button>
                <button type="button" onClick={handleRegister} disabled={loading} className="flex-1 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md disabled:opacity-50">
                  {loading ? 'Aguarde...' : 'Finalizar Cadastro'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <button onClick={() => resetTelas(!isSignUp)} className="text-sm text-gray-500 hover:text-blue-600 font-medium transition">
              {isSignUp ? 'Já tem conta? ' : 'Ainda não tem conta? '}
              <span className="font-bold underline">{isSignUp ? 'Faça login aqui.' : 'Crie uma aqui.'}</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Scrollbar Customizada Global */}
      {/* ✅ Scrollbar movida para src/index.css */}

    </div>
  )
}