// src/components/Skeletons.jsx
// Componentes de skeleton loading — espelham o layout real de cada tela.
// Uso: import { HubSkeleton, DashboardSkeleton, ScheduleDetailsSkeleton } from '../components/Skeletons'

// Bloco base pulsante — bloco cinza com animate-pulse
function Pulse({ className }) {
  return <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`} />
}

// ─────────────────────────────────────────
// HUB
// ─────────────────────────────────────────
export function HubSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Header escuro */}
      <div className="bg-gray-900 pt-10 pb-8 rounded-b-3xl">
        <div className="max-w-5xl mx-auto px-5">
          <Pulse className="h-3 w-28 mb-2 opacity-40" />
          <Pulse className="h-7 w-40 opacity-60" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8 space-y-8">

        {/* Minha Agenda Global — cards compactos 210px */}
        <div>
          <Pulse className="h-4 w-44 mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="min-w-[210px] bg-gray-200 rounded-xl p-4 animate-pulse flex-shrink-0">
                <Pulse className="h-3 w-16 mb-2 bg-gray-300" />
                <Pulse className="h-5 w-32 mb-1 bg-gray-300" />
                <Pulse className="h-3 w-24 mb-3 bg-gray-300" />
                <Pulse className="h-7 w-24 rounded-lg bg-gray-300" />
              </div>
            ))}
          </div>
        </div>

        {/* Meu Calendário */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-5">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-8 w-36 rounded-lg" />
          </div>
          <div className="grid grid-cols-7 gap-1 mb-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Pulse key={i} className="h-3 mx-auto w-6" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-3">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="flex justify-center">
                <Pulse className="w-9 h-9 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Indicador de escalas do próximo mês — grid 2x2 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <Pulse className="h-3 w-32" />
            <Pulse className="h-3 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white px-4 py-3 flex items-center gap-3">
                <Pulse className="w-2 h-2 rounded-full" />
                <Pulse className="h-3 flex-1" />
                <Pulse className="h-4 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Cards de departamentos */}
        <div>
          <Pulse className="h-4 w-36 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center gap-4 animate-pulse">
                <Pulse className="w-20 h-20 rounded-full" />
                <Pulse className="h-6 w-28" />
                <Pulse className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Card de Administração (master admin) */}
        <div className="border-t border-gray-200 pt-8">
          <Pulse className="h-4 w-32 mb-4" />
          <div className="bg-gray-200 rounded-2xl p-5 animate-pulse flex items-center gap-4">
            <Pulse className="w-12 h-12 rounded-xl bg-gray-300" />
            <div className="flex-1">
              <Pulse className="h-4 w-40 mb-2 bg-gray-300" />
              <Pulse className="h-3 w-56 bg-gray-300" />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────
export function DashboardSkeleton({ corHeader = 'bg-blue-600' }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Header colorido do departamento */}
      <div className={`${corHeader} rounded-b-3xl mb-6 animate-pulse`}>
        <div className="max-w-xl mx-auto px-5 py-6 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/20" />
          <div>
            <div className="h-5 w-32 bg-white/30 rounded-lg mb-1" />
            <div className="h-3 w-16 bg-white/20 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 space-y-8">

        {/* Card do próximo culto */}
        <div className={`${corHeader} rounded-2xl p-6 animate-pulse opacity-60`}>
          <div className="h-3 w-24 bg-white/40 rounded mb-3" />
          <div className="h-7 w-44 bg-white/40 rounded mb-2" />
          <div className="h-3 w-36 bg-white/30 rounded mb-6" />
          <div className="h-9 w-36 bg-white/20 rounded-xl" />
        </div>

        {/* Calendário */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-5">
            <Pulse className="h-4 w-28" />
            <Pulse className="h-8 w-36 rounded-lg" />
          </div>
          <div className="grid grid-cols-7 gap-1 mb-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Pulse key={i} className="h-3 mx-auto w-6" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-3">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="flex justify-center">
                <Pulse className="w-9 h-9 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Botões de ação */}
        <div>
          <Pulse className="h-4 w-16 mb-4" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 animate-pulse">
                <Pulse className="w-6 h-6 rounded-md" />
                <Pulse className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Lista de escalas */}
        <div>
          <Pulse className="h-4 w-20 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center animate-pulse">
                <div>
                  <Pulse className="h-4 w-32 mb-2" />
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

// ─────────────────────────────────────────
// SCHEDULE DETAILS
// ─────────────────────────────────────────
export function ScheduleDetailsSkeleton({ corHeader = 'bg-blue-600' }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">

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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
          <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
          <div className="p-5 border-b border-gray-100 bg-gray-50">
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