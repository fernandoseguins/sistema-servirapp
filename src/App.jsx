// src/App.jsx
import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import { solicitarTokenFCM } from './firebase'

// ✅ Componentes globais carregados imediatamente (aparecem em todas as telas)
import InstallPrompt from './components/InstallPrompt'
import { UIProvider } from './context/UIContext'
import { IgrejaProvider } from './context/IgrejaContext'
import ErrorBoundary from './components/ErrorBoundary'
import ScrollToTop from './components/ScrollToTop'
import GlobalUserMenu from './components/GlobalUserMenu'
// import ChatBot from './components/ChatBot'  // reativar quando adicionar o botão de Dúvidas no Hub

// ✅ Todas as páginas agora são lazy — só carregam quando o usuário navega até elas
const Auth             = lazy(() => import('./pages/Auth'))
const Hub              = lazy(() => import('./pages/Hub'))
const Dashboard        = lazy(() => import('./pages/Dashboard'))
const SwapRequests     = lazy(() => import('./pages/SwapRequests'))
const Unavailability   = lazy(() => import('./pages/Unavailability'))
const CreateNotice     = lazy(() => import('./pages/CreateNotice'))
const Team             = lazy(() => import('./pages/Team'))
const Songs            = lazy(() => import('./pages/Songs'))
const GenerateSchedule = lazy(() => import('./pages/GenerateSchedule'))
const ScheduleDetails  = lazy(() => import('./pages/ScheduleDetails'))
const Profile          = lazy(() => import('./pages/Profile'))
const InfantilLessons  = lazy(() => import('./pages/InfantilLessons'))
const InfantilCheckin  = lazy(() => import('./pages/InfantilCheckin'))
const GlobalNotice     = lazy(() => import('./pages/GlobalNotice'))
const FrequencyReport  = lazy(() => import('./pages/FrequencyReport'))
const PrintSchedules   = lazy(() => import('./pages/PrintSchedules'))
const Cabine           = lazy(() => import('./pages/Cabine'))
const ChecklistMidia   = lazy(() => import('./pages/ChecklistMidia'))
const GestaoIgreja     = lazy(() => import('./pages/GestaoIgreja'))
const AvisoGeral       = lazy(() => import('./pages/AvisoGeral'))
const CantinaSchedule  = lazy(() => import('./pages/CantinaSchedule'))
const MinistrosSchedule= lazy(() => import('./pages/MinistrosSchedule'))
const CriarIgreja      = lazy(() => import('./pages/CriarIgreja'))
const PainelDono       = lazy(() => import('./pages/PainelDono'))
const IgrejaDetalhes   = lazy(() => import('./pages/IgrejaDetalhes'))

// ✅ Spinner reutilizável para o Suspense (mesmo visual do loading de sessão)
function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
    </div>
  )
}

function App() {
  const [session, setSession]   = useState(null)
  const [loading, setLoading]   = useState(true)

  // ✅ Garante que vincularDispositivo só roda UMA vez por sessão
  const jaVinculou = useRef(false)

  const vincularDispositivo = async (userId) => {
    if (jaVinculou.current) return
    jaVinculou.current = true

    // ✅ Supabase local (testes): não registra o aparelho no Firebase de produção
    const url = import.meta.env.VITE_SUPABASE_URL || ''
    if (url.includes('127.0.0.1') || url.includes('localhost')) return

    try {
      let token = null

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        token = await solicitarTokenFCM(registration)
      } else {
        console.warn('⚠️ O navegador não suporta Service Workers.')
      }

      if (token) {
        const { error } = await supabase
          .from('users_profile')
          .update({ fcm_token: token })
          .eq('id', userId)

        if (error) console.error('❌ Erro ao salvar token:', error.message)
      }
    } catch (error) {
      console.error('❌ Erro crítico na vinculação do dispositivo:', error)
    }
  }

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setLoading(false)

      if (session?.user?.id) {
        setTimeout(() => vincularDispositivo(session.user.id), 2000)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)

      // ✅ O ref garante que mesmo chamado várias vezes aqui, só vincula uma vez
      if (session?.user?.id) {
        vincularDispositivo(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <PageSpinner />

  return (
    <ErrorBoundary>
    <UIProvider>
    <IgrejaProvider>
    <BrowserRouter>
      {session && (
        <>
          <GlobalUserMenu />
          {/* ChatBot flutuante removido — será acessível por um botão dedicado no Hub */}
        </>
      )}

      <ScrollToTop />

      {/* ✅ Suspense envolve todas as rotas — exibe o spinner enquanto o chunk carrega */}
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/"                element={!session ? <Auth />             : <Navigate to="/hub" replace />} />
          <Route path="/hub"             element={session  ? <Hub />              : <Navigate to="/" replace />} />
          <Route path="/dashboard/:id?"  element={session  ? <Dashboard />        : <Navigate to="/" replace />} />
          <Route path="/trocas/:id?"     element={session  ? <SwapRequests />     : <Navigate to="/" replace />} />
          <Route path="/indisponibilidade" element={session ? <Unavailability />  : <Navigate to="/" replace />} />
          <Route path="/criar-aviso"     element={session  ? <CreateNotice />     : <Navigate to="/" replace />} />
          <Route path="/equipe"          element={session  ? <Team />             : <Navigate to="/" replace />} />
          <Route path="/louvores"        element={session  ? <Songs />            : <Navigate to="/" replace />} />
          <Route path="/gerar-escala"    element={session  ? <GenerateSchedule /> : <Navigate to="/" replace />} />
          <Route path="/escala/:id"      element={session  ? <ScheduleDetails />  : <Navigate to="/" replace />} />
          <Route path="/perfil"          element={session  ? <Profile />          : <Navigate to="/" replace />} />
          <Route path="/informativo"     element={session  ? <GlobalNotice />     : <Navigate to="/" replace />} />
          <Route path="/licoes"          element={session  ? <InfantilLessons />  : <Navigate to="/" replace />} />
          <Route path="/checkin"         element={session  ? <InfantilCheckin />  : <Navigate to="/" replace />} />
          <Route path="/frequencia"      element={session  ? <FrequencyReport />  : <Navigate to="/" replace />} />
          <Route path="/imprimir-escalas" element={session  ? <PrintSchedules />   : <Navigate to="/" replace />} />
          <Route path="/cabine/:id?"        element={session  ? <Cabine />           : <Navigate to="/" replace />} />
          <Route path="/checklist-midia"    element={session  ? <ChecklistMidia />   : <Navigate to="/" replace />} />
          <Route path="/gestao-igreja"      element={session  ? <GestaoIgreja />     : <Navigate to="/" replace />} />
          <Route path="/aviso-geral"        element={session  ? <AvisoGeral />       : <Navigate to="/" replace />} />
          <Route path="/cantina"            element={session  ? <CantinaSchedule />  : <Navigate to="/" replace />} />
          <Route path="/ministros"          element={session  ? <MinistrosSchedule /> : <Navigate to="/" replace />} />
          <Route path="/criar-igreja"       element={session  ? <CriarIgreja />       : <Navigate to="/" replace />} />
          <Route path="/painel-dono"        element={session  ? <PainelDono />        : <Navigate to="/" replace />} />
          <Route path="/igreja/:id"         element={session  ? <IgrejaDetalhes />    : <Navigate to="/" replace />} />
          {/* ✅ Rota desconhecida: em vez de página em branco, manda para o início */}
          <Route path="*"                   element={<Navigate to={session ? '/hub' : '/'} replace />} />
        </Routes>
      </Suspense>

      <InstallPrompt />
    </BrowserRouter>
    </IgrejaProvider>
    </UIProvider>
    </ErrorBoundary>
  )
}

export default App