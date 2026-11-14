import { classesDept } from '../../theme/deptCores'

const TONS = {
  neutro:  'bg-surface-2 text-ink-2',
  brand:   'bg-brand/10 text-brand',
  sucesso: 'bg-success-soft text-success',
  aviso:   'bg-warning-soft text-warning',
  perigo:  'bg-danger-soft text-danger',
}

export default function Pill({ tom = 'neutro', dept, className = '', children }) {
  const cores = tom === 'dept' ? classesDept(dept).chip : TONS[tom]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cores} ${className}`}>
      {children}
    </span>
  )
}
