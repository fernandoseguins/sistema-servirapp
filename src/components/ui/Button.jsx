import { Loader2 } from 'lucide-react'

const VARIANTES = {
  primario:   'bg-brand text-on-brand hover:opacity-90',
  secundario: 'bg-surface-2 text-brand hover:bg-line',
  fantasma:   'bg-transparent text-ink hover:bg-surface-2',
  perigo:     'bg-danger-soft text-danger hover:opacity-90',
}
const TAMANHOS = {
  md: 'h-11 px-4 text-sm gap-2',
  sm: 'h-9 px-3 text-xs gap-1.5',
}

export default function Button({
  variant = 'primario', size = 'md', icon, loading = false, full = false,
  type = 'button', className = '', children, disabled, ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-ctl font-semibold transition active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg
        disabled:opacity-60 disabled:pointer-events-none
        ${VARIANTES[variant]} ${TAMANHOS[size]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : icon}
      {children && <span className={loading ? 'opacity-80' : ''}>{children}</span>}
    </button>
  )
}
