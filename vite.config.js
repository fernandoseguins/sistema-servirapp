import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        // ✅ CORRIGIDO: aponta para index.html (SPA), não para offline.html
        // O offline.html como navigateFallback causava redirecionamento
        // mesmo com internet, pois o SW não encontrava /hub no cache.
        navigateFallback: '/index.html',

        // Não aplica o fallback para rotas da API ou do Supabase
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/],

        importScripts: ['/firebase-messaging-sw.js'],
      },
      manifest: {
        name: 'Servir Sistema de Escalas',
        short_name: 'Servir',
        description: 'Gestão de Escalas e Departamentos',
        theme_color: '#1f2937',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          // ✅ Entrada separada para maskable — corrige exibição em launchers Android
          // 'any maskable' num único campo é inválido pela spec do W3C
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})