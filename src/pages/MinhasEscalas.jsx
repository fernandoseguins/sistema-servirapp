// src/pages/MinhasEscalas.jsx — aba Escalas (conteúdo na Task 10)
import { CalendarDays } from 'lucide-react'
import { TopBar, EmptyState } from '../components/ui'

export default function MinhasEscalas() {
  return (
    <div className="min-h-screen bg-bg">
      <TopBar titulo="Escalas" />
      <main className="max-w-[720px] mx-auto px-4">
        <EmptyState icon={<CalendarDays className="w-5 h-5" aria-hidden="true" />} titulo="Em breve" texto="Suas escalas de todos os departamentos vão aparecer aqui." />
      </main>
    </div>
  )
}
