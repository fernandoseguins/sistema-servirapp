// Menu principal: barra fixa embaixo no celular, barra lateral esquerda no desktop (≥768px).
import { NavLink } from 'react-router-dom'
import { Home, CalendarDays, Bell, User } from 'lucide-react'
import { useNotificacoes } from '../../hooks/useNotificacoes'
import Logo from '../ui/Logo'

const ABAS = [
  { to: '/hub',     rotulo: 'Início',  Icone: Home,         prefixos: ['/hub', '/dashboard', '/escala/'] },
  { to: '/escalas', rotulo: 'Escalas', Icone: CalendarDays, prefixos: ['/escalas'] },
  { to: '/avisos',  rotulo: 'Avisos',  Icone: Bell,         prefixos: ['/avisos'] },
  { to: '/perfil',  rotulo: 'Perfil',  Icone: User,         prefixos: ['/perfil'] },
]

function Contador({ n }) {
  if (!n) return null
  return (
    <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-on-accent text-[10px] font-bold flex items-center justify-center">
      {n > 9 ? '9+' : n}
    </span>
  )
}

export default function BottomNav({ pathname }) {
  const { naoLidas } = useNotificacoes()
  const ativa = (aba) => aba.prefixos.some(p => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))

  return (
    <nav aria-label="Navegação principal"
      className="fixed z-40 bg-surface border-line
        bottom-0 inset-x-0 border-t pb-[env(safe-area-inset-bottom)]
        md:top-0 md:bottom-0 md:right-auto md:w-56 md:border-t-0 md:border-r md:pb-0 md:pt-6">
      <div className="hidden md:block px-5 mb-6"><Logo className="h-9" /></div>
      <ul className="flex md:flex-col justify-around md:justify-start md:gap-1 md:px-3">
        {ABAS.map(aba => {
          const on = ativa(aba)
          return (
            <li key={aba.to} className="flex-1 md:flex-none">
              <NavLink to={aba.to} aria-current={on ? 'page' : undefined}
                className={`flex flex-col md:flex-row items-center md:gap-3 gap-0.5 py-2 md:py-2.5 md:px-3 rounded-ctl text-[11px] md:text-sm font-semibold transition
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                  ${on ? 'text-brand md:bg-brand/10' : 'text-ink-2 hover:text-ink'}`}>
                <span className="relative">
                  <aba.Icone className="w-5 h-5" aria-hidden="true" />
                  {aba.to === '/avisos' && <Contador n={naoLidas} />}
                </span>
                {aba.rotulo}
                {aba.to === '/avisos' && naoLidas > 0 && <span className="sr-only">, {naoLidas} não lidas</span>}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
