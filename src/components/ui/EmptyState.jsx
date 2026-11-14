export default function EmptyState({ icon, titulo, texto, acao, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center px-6 py-10 ${className}`}>
      {icon && <div className="w-12 h-12 rounded-full bg-surface-2 text-brand flex items-center justify-center mb-3">{icon}</div>}
      <p className="text-sm font-bold text-ink">{titulo}</p>
      {texto && <p className="text-xs text-ink-2 mt-1 max-w-xs">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
