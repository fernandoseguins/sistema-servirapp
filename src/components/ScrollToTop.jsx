// src/components/ScrollToTop.jsx
// Reseta o scroll para o topo sempre que a rota muda.
// Necessário em SPAs React — o browser preserva a posição de scroll entre navegações.

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}