// Moldura das telas logadas: menu fixo + área de conteúdo.
// Telas ainda não reformadas (fase 3) ficam dentro do TemaClaroForcado.
import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import TemaClaroForcado from './TemaClaroForcado'

// Telas de foco: sem menu (tarefas longas ou impressão)
const ROTAS_FOCO = ['/gerar-escala', '/checkin', '/imprimir-escalas', '/cabine']

// Telas já no novo visual (o resto é legado e fica no tema claro)
const ROTAS_NOVAS = ['/hub', '/escalas', '/avisos', '/perfil', '/dashboard', '/escala/', '/dev/ui']

const comeca = (pathname, lista) => lista.some(p => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))

export default function AppShell({ logado, children }) {
  const { pathname } = useLocation()
  if (!logado || pathname === '/') return children

  const foco = comeca(pathname, ROTAS_FOCO)
  const nova = comeca(pathname, ROTAS_NOVAS)

  if (foco) return nova ? children : <TemaClaroForcado>{children}</TemaClaroForcado>

  // O espaço reservado para o menu fica DENTRO do invólucro claro (sem faixa escura no legado)
  const area = <div className="md:pl-56 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
  return (
    <>
      <BottomNav pathname={pathname} />
      {nova ? area : <TemaClaroForcado>{area}</TemaClaroForcado>}
    </>
  )
}
