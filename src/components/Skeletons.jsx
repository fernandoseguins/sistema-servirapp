// src/components/Skeletons.jsx
// Componentes de skeleton loading — espelham o layout real de cada tela.
// Uso: import { ScheduleDetailsSkeleton } from '../components/Skeletons'

// Bloco base pulsante (tokens do tema: claro/escuro)
function Pulse({ className }) {
  return <div className={`bg-surface-2 rounded-xl animate-pulse ${className}`} />
}

// ─────────────────────────────────────────
// SCHEDULE DETAILS
// ─────────────────────────────────────────
export function ScheduleDetailsSkeleton({ corHeader = 'bg-topo' }) {
  return (
    <div className="min-h-screen bg-bg pb-20">

      {/* Header */}
      <div className={`${corHeader} px-4 py-6 rounded-b-3xl mb-6 flex items-start gap-4 animate-pulse`}>
        <div className="w-10 h-10 rounded-full bg-white/20 mt-1 shrink-0" />
        <div className="flex-1">
          <div className="h-5 w-48 bg-white/40 rounded mb-2" />
          <div className="h-3 w-36 bg-white/30 rounded mb-4" />
          <div className="flex gap-3">
            <div className="h-7 w-28 bg-white/20 rounded-lg" />
            <div className="h-7 w-28 bg-white/20 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 space-y-6">

        {/* Card repertório (Louvor) */}
        <div className="bg-surface rounded-card shadow-sm border border-line overflow-hidden animate-pulse">
          <div className="p-5 border-b border-line bg-bg flex justify-between items-center">
            <Pulse className="h-4 w-28" />
            <Pulse className="h-8 w-8 rounded-lg" />
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Pulse className="w-6 h-6 rounded-full" />
                  <div>
                    <Pulse className="h-4 w-36 mb-1" />
                    <Pulse className="h-3 w-20" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Pulse className="w-8 h-8 rounded-md" />
                  <Pulse className="w-8 h-8 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card equipa escalada */}
        <div className="bg-surface rounded-card shadow-sm border border-line overflow-hidden animate-pulse">
          <div className="p-5 border-b border-line bg-bg">
            <Pulse className="h-4 w-36" />
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between py-1">
                <div>
                  <Pulse className="h-4 w-32 mb-1" />
                  <Pulse className="h-3 w-20" />
                </div>
                <Pulse className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}