import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

export default function Select({ label, erro, options = [], id, className = '', ...props }) {
  const autoId = useId()
  const campoId = id || autoId
  return (
    <div className={className}>
      {label && <label htmlFor={campoId} className="block text-xs font-semibold text-ink-2 mb-1.5">{label}</label>}
      <div className="relative">
        <select
          id={campoId}
          aria-invalid={erro ? true : undefined}
          className={`w-full h-11 appearance-none rounded-ctl bg-surface border pl-3 pr-9 text-sm text-ink
            focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition
            ${erro ? 'border-danger' : 'border-line'}`}
          {...props}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
      </div>
      {erro && <p className="text-xs text-danger mt-1">{erro}</p>}
    </div>
  )
}
