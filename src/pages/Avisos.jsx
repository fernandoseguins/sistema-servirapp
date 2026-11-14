// src/pages/Avisos.jsx — aba Avisos (conteúdo na Task 13)
import { Bell } from 'lucide-react'
import { TopBar, EmptyState } from '../components/ui'

export default function Avisos() {
  return (
    <div className="min-h-screen bg-bg">
      <TopBar titulo="Avisos" />
      <main className="max-w-[720px] mx-auto px-4">
        <EmptyState icon={<Bell className="w-5 h-5" aria-hidden="true" />} titulo="Em breve" texto="Notificações e mural dos seus departamentos." />
      </main>
    </div>
  )
}
