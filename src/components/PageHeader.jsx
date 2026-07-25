// src/components/PageHeader.jsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PageHeader({
  title, subtitle, icon, color = 'bg-gray-900',
  onBack, actions, badge, badgeColor = 'bg-white/20', maxWidth = 'max-w-2xl',
}) {
  const navigate  = useNavigate()
  const handleBack = onBack ?? (() => navigate(-1))
  return (
    <div className={`${color} px-4 py-6 rounded-b-3xl mb-6 text-white transition-colors duration-300`}>
      {/* pr-36 reserva espaço para os 3 botões flutuantes do GlobalUserMenu no mobile */}
      <div className={`${maxWidth} mx-auto flex items-center gap-4 pr-36 sm:pr-4`}>
        <button onClick={handleBack} aria-label="Voltar"
          className="p-2 bg-black/10 hover:bg-black/20 active:bg-black/30 rounded-full transition flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold flex items-center gap-2 leading-tight">
            {icon && <span className="opacity-80 flex-shrink-0">{icon}</span>}
            <span className="truncate">{title}</span>
            {badge && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${badgeColor}`}>
                {badge}
              </span>
            )}
          </h1>
          {subtitle && <p className="text-xs text-white/85 font-medium mt-0.5 truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
}