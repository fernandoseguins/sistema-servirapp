import { ArrowLeft } from 'lucide-react'

// Cabeçalho de tela. "destaque" = fundo roxo do tema (topo), texto branco.
export default function TopBar({ titulo, subtitulo, onVoltar, acoes, variante = 'simples', icone, children }) {
  const destaque = variante === 'destaque'
  return (
    <header className={`${destaque ? 'bg-topo text-white' : 'text-ink'} px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4`}>
      <div className="max-w-[720px] mx-auto flex items-center gap-3">
        {onVoltar && (
          <button type="button" onClick={onVoltar} aria-label="Voltar"
            className={`p-2 -ml-2 rounded-full transition focus-visible:outline-none focus-visible:ring-2
              ${destaque ? 'hover:bg-white/15 focus-visible:ring-white' : 'hover:bg-surface-2 focus-visible:ring-brand'}`}>
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
        {icone && <span className="flex-shrink-0">{icone}</span>}
        <div className="flex-1 min-w-0">
          {subtitulo && <p className={`text-xs truncate ${destaque ? 'text-white/80' : 'text-ink-2'}`}>{subtitulo}</p>}
          <h1 className="text-lg font-bold leading-tight truncate">{titulo}</h1>
        </div>
        {acoes && <div className="flex items-center gap-1 flex-shrink-0">{acoes}</div>}
      </div>
      {children && <div className="max-w-[720px] mx-auto">{children}</div>}
    </header>
  )
}
