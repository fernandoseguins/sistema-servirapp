// src/components/EmptyState.jsx
// Componente reutilizável de estado vazio.
//
// PROPS:
//   icon       — elemento JSX (ex: <Music className="..." />) — obrigatório
//   title      — título principal                              — obrigatório
//   subtitle   — texto secundário                             — opcional
//   action     — { label: string, onClick: fn }               — opcional (botão de ação)
//   variant    — 'default' | 'success' | 'info'               — opcional (cor do ícone)
//   size       — 'sm' | 'md'                                   — opcional (compacto ou normal)
//
// USO:
//   <EmptyState
//     icon={<Music className="w-8 h-8" />}
//     title="Nenhuma música encontrada"
//     subtitle="Adicione músicas ao repertório do departamento."
//     action={{ label: 'Adicionar música', onClick: () => setModalAberto(true) }}
//   />

import { cloneElement } from 'react'

const VARIANT_STYLES = {
  default: {
    wrap:  'bg-gray-100 text-gray-400',
    title: 'text-gray-700',
    sub:   'text-gray-400',
  },
  success: {
    wrap:  'bg-green-50 text-green-400',
    title: 'text-gray-700',
    sub:   'text-gray-400',
  },
  info: {
    wrap:  'bg-blue-50 text-blue-400',
    title: 'text-gray-700',
    sub:   'text-gray-400',
  },
  warning: {
    wrap:  'bg-yellow-50 text-yellow-400',
    title: 'text-gray-700',
    sub:   'text-gray-400',
  },
}

const SIZE_STYLES = {
  sm: { padding: 'py-6 px-4', iconBox: 'w-10 h-10', gap: 'mb-2', titleSize: 'text-sm', subSize: 'text-xs' },
  md: { padding: 'py-10 px-6', iconBox: 'w-14 h-14', gap: 'mb-3', titleSize: 'text-base', subSize: 'text-sm' },
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
  variant = 'default',
  size    = 'md',
}) {
  const v = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default
  const s = SIZE_STYLES[size]    ?? SIZE_STYLES.md

  // Clona o ícone para aplicar className consistente
  const styledIcon = cloneElement(icon, {
    className: `w-6 h-6 ${v.wrap.split(' ')[1]}`,
  })

  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.padding} bg-white rounded-2xl border border-dashed border-gray-200`}>

      {/* Círculo do ícone */}
      <div className={`${s.iconBox} rounded-full ${v.wrap} flex items-center justify-center flex-shrink-0 ${s.gap}`}>
        {styledIcon}
      </div>

      {/* Título */}
      <p className={`font-semibold ${v.title} ${s.titleSize} mb-1`}>
        {title}
      </p>

      {/* Subtítulo */}
      {subtitle && (
        <p className={`${v.sub} ${s.subSize} max-w-xs leading-relaxed`}>
          {subtitle}
        </p>
      )}

      {/* Botão de ação opcional */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 active:scale-95 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}