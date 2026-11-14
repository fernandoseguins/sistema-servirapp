import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export default function ListRow({ titulo, subtitulo, direita, onClick, href, state, icon, className = '' }) {
  const clicavel = !!(onClick || href)
  const conteudo = (
    <>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-sm font-semibold text-ink truncate">{titulo}</span>
        {subtitulo && <span className="block text-xs text-ink-2 truncate">{subtitulo}</span>}
      </span>
      {direita && <span className="flex-shrink-0 flex items-center gap-2">{direita}</span>}
      {clicavel && <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" aria-hidden="true" />}
    </>
  )
  const base = `w-full flex items-center gap-3 py-3 border-b border-line last:border-b-0 ${className}`
  const foco = 'rounded-ctl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand hover:bg-surface-2/60 transition'

  if (href) return <Link to={href} state={state} className={`${base} ${foco}`}>{conteudo}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={`${base} ${foco}`}>{conteudo}</button>
  return <div className={base}>{conteudo}</div>
}
