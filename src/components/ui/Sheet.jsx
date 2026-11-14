import { useEffect, useRef, useId } from 'react'
import { X } from 'lucide-react'

// Painel que sobe de baixo (no desktop, centralizado). Fecha com Esc e clique no fundo.
export default function Sheet({ aberto, onFechar, titulo, children }) {
  const painelRef = useRef(null)
  const fecharRef = useRef(onFechar)
  const tituloId = useId()

  useEffect(() => { fecharRef.current = onFechar })

  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement
    painelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') fecharRef.current?.() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      anterior?.focus?.()
    }
  }, [aberto])

  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onFechar} aria-hidden="true" />
      <div
        ref={painelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? tituloId : undefined}
        className="relative w-full md:max-w-md bg-surface rounded-t-[24px] md:rounded-card border border-line
          p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto focus:outline-none"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        <div className="flex items-center justify-between mb-3">
          {titulo ? <h2 id={tituloId} className="text-base font-bold text-ink">{titulo}</h2> : <span />}
          <button type="button" onClick={onFechar} aria-label="Fechar"
            className="p-2 -mr-2 rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
