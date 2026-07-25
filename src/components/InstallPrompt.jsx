// src/components/InstallPrompt.jsx
import { useState, useEffect } from 'react'
import { X, Share, PlusSquare, BellRing } from 'lucide-react'

export default function InstallPrompt() {
  const [mostrarAviso, setMostrarAviso] = useState(false)

  useEffect(() => {
    // Deteta se é um dispositivo Apple (iPhone/iPad)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    
    // Deteta se o app JÁ ESTÁ instalado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone

    // Se for iPhone e NÃO estiver instalado, mostra o aviso
    if (isIOS && !isStandalone) {
      const jaFechou = localStorage.getItem('escondeuAvisoPWA')
      if (!jaFechou) {
        setMostrarAviso(true)
      }
    }
  }, [])

  function fecharAviso() {
    setMostrarAviso(false)
    localStorage.setItem('escondeuAvisoPWA', 'true') 
  }

  if (!mostrarAviso) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 pb-8 animate-in slide-in-from-bottom-5">
      <div className="bg-white border border-gray-200 shadow-2xl rounded-2xl p-5 relative max-w-sm mx-auto">
        
        {/* Botão de Fechar */}
        <button onClick={fecharAviso} className="absolute top-3 right-3 text-gray-400 hover:bg-gray-100 p-1.5 rounded-full transition">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3 mb-3 pr-6">
          <div className="bg-blue-100 p-2.5 rounded-full text-blue-600 shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 leading-tight text-sm">Ative as Notificações!</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Instale o app SerVir para ser avisado das suas escalas.</p>
          </div>
        </div>

        <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 mt-4 text-[13px] text-gray-700 font-medium leading-relaxed">
          <p className="mb-2">
            1. Toque em <Share className="inline-flex w-6 h-6 items-center justify-center text-blue-500 bg-white p-1 rounded shadow-sm mx-1 align-middle" /> na barra inferior.
          </p>
          <p>
            2. Depois selecione <PlusSquare className="inline-flex w-6 h-6 items-center justify-center text-gray-800 bg-white p-1 rounded shadow-sm mx-1 align-middle" /> <strong className="text-gray-900">Adicionar à Tela de Início</strong>.
          </p>
        </div>

      </div>
    </div>
  )
}