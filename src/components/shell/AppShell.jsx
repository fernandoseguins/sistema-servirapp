// Moldura das telas logadas: menu fixo + área de conteúdo.
import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import { ROTAS_FOCO, comeca } from './rotas'

export default function AppShell({ logado, children }) {
  const { pathname } = useLocation()
  if (!logado || pathname === '/') return children

  // Telas de foco: sem menu
  if (comeca(pathname, ROTAS_FOCO)) return children

  return (
    <>
      <BottomNav pathname={pathname} />
      <div className="md:pl-56 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
    </>
  )
}
