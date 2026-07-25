// src/hooks/usePullToRefresh.js
// Hook de pull-to-refresh para mobile.
// Detecta o gesto de "puxar para baixo" no topo da página e chama
// a função onRefresh passada como parâmetro.
//
// USO:
//   const { isPulling, pullProgress, isRefreshing } = usePullToRefresh(buscarDados)
//
//   // No JSX, adicione o indicador visual:
//   <PullIndicator isPulling={isPulling} progress={pullProgress} isRefreshing={isRefreshing} />
//
// O hook só ativa quando:
//   - O scroll da página está no topo (scrollY === 0)
//   - O gesto começa com toque único
//   - Está num dispositivo touch (mobile/tablet)

import { useState, useEffect, useRef, useCallback } from 'react'

const THRESHOLD    = 80   // px necessários para disparar o refresh
const MAX_PULL     = 120  // px máximos de deslocamento visual

export function usePullToRefresh(onRefresh) {
  const [isPulling, setIsPulling]       = useState(false)
  const [pullProgress, setPullProgress] = useState(0)   // 0–1
  const [isRefreshing, setIsRefreshing] = useState(false)

  const startYRef   = useRef(null)
  const pullingRef  = useRef(false)

  const handleTouchStart = useCallback((e) => {
    // Só ativa se estiver no topo da página
    if (window.scrollY !== 0) return
    if (e.touches.length !== 1) return
    startYRef.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (startYRef.current === null) return
    if (window.scrollY !== 0) { startYRef.current = null; return }

    const deltaY = e.touches[0].clientY - startYRef.current

    if (deltaY <= 0) {
      if (pullingRef.current) {
        pullingRef.current = false
        setIsPulling(false)
        setPullProgress(0)
      }
      return
    }

    // Previne o scroll nativo enquanto estamos puxando
    e.preventDefault()

    pullingRef.current = true
    setIsPulling(true)
    setPullProgress(Math.min(deltaY / THRESHOLD, MAX_PULL / THRESHOLD))
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return

    const progress = pullProgress

    startYRef.current  = null
    pullingRef.current = false
    setIsPulling(false)
    setPullProgress(0)

    if (progress >= 1) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
  }, [pullProgress, onRefresh])

  useEffect(() => {
    // passive: false necessário para poder chamar preventDefault no touchmove
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove',  handleTouchMove,  { passive: false })
    document.addEventListener('touchend',   handleTouchEnd,   { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove',  handleTouchMove)
      document.removeEventListener('touchend',   handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return { isPulling, pullProgress, isRefreshing }
}

// ── Componente visual do indicador ────────────────────────────────────────────
// Círculo animado que aparece no topo ao puxar.
// Importar junto com o hook:
//   import { usePullToRefresh, PullIndicator } from '../hooks/usePullToRefresh'

export function PullIndicator({ isPulling, progress, isRefreshing }) {
  if (!isPulling && !isRefreshing) return null

  const size    = 36
  const radius  = 14
  const circum  = 2 * Math.PI * radius
  const offset  = circum * (1 - Math.min(progress, 1))

  return (
    <div style={{
      position:       'fixed',
      top:            12,
      left:           '50%',
      transform:      'translateX(-50%)',
      zIndex:         9998,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     '#1e293b',
      border:         '1px solid #334155',
      borderRadius:   '50%',
      width:          size + 8,
      height:         size + 8,
      boxShadow:      '0 4px 12px rgba(0,0,0,0.3)',
      transition:     'opacity 0.15s',
    }}>
      {isRefreshing ? (
        // Spinner quando está carregando
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#334155" strokeWidth="2.5"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#3b82f6" strokeWidth="2.5"
            strokeDasharray={circum}
            strokeDashoffset={circum * 0.75}
            strokeLinecap="round"
            style={{ transformOrigin: 'center', animation: 'spin 0.8s linear infinite' }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </svg>
      ) : (
        // Arco de progresso ao puxar
        <svg
          width={size} height={size} viewBox={`0 0 ${size} ${size}`}
          style={{
            transform: `rotate(-90deg) ${progress >= 1 ? 'scale(1.1)' : ''}`,
            transition: 'transform 0.15s',
          }}
        >
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#334155" strokeWidth="2.5"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={progress >= 1 ? '#22c55e' : '#3b82f6'}
            strokeWidth="2.5"
            strokeDasharray={circum}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.2s' }}
          />
        </svg>
      )}
    </div>
  )
}