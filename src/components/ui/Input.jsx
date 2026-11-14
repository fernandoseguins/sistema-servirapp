import { useId } from 'react'

export default function Input({ label, icon, erro, id, className = '', ...props }) {
  const autoId = useId()
  const campoId = id || autoId
  const erroId = `${campoId}-erro`
  return (
    <div className={className}>
      {label && <label htmlFor={campoId} className="block text-xs font-semibold text-ink-2 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">{icon}</span>}
        <input
          id={campoId}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? erroId : undefined}
          className={`w-full h-11 rounded-ctl bg-surface border text-sm text-ink placeholder:text-muted
            focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition
            ${icon ? 'pl-10' : 'pl-3'} pr-3 ${erro ? 'border-danger' : 'border-line'}`}
          {...props}
        />
      </div>
      {erro && <p id={erroId} className="text-xs text-danger mt-1">{erro}</p>}
    </div>
  )
}
