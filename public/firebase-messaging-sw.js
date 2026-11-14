// public/firebase-messaging-sw.js
// Service Worker do Firebase — lida com notificações push em background

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDaHsGHM1RrgmWEBtL3SfWbh9AqvUT6Oic",
  authDomain: "servir-a4eb4.firebaseapp.com",
  projectId: "servir-a4eb4",
  storageBucket: "servir-a4eb4.firebasestorage.app",
  messagingSenderId: "322885267202",
  appId: "1:322885267202:web:71818334869f928a7c9c1b"
});

const messaging = firebase.messaging();

// ✅ Notificação em background — app fechado ou em outra aba
messaging.onBackgroundMessage(function(payload) {
  // Mensagem com bloco `notification`: o próprio SDK do Firebase já exibe.
  // Exibir de novo aqui fazia a notificação chegar DUPLICADA.
  if (payload.notification) return

  // Mensagem só com `data` (formato enviado por _shared/push.ts): exibimos nós.
  const dados = payload.data ?? {}
  const titulo = dados.titulo || 'SerVir'
  const link = dados.link || '/hub'

  return self.registration.showNotification(titulo, {
    body:  dados.mensagem || '',
    icon:  '/icon-192x192.png',
    badge: '/icon-192x192.png',
    // Mesma tag = substitui a anterior. Uma por notificação (id) para não sumir
    // aviso anterior; sem id, agrupa pelo link (ex.: lembretes da mesma escala).
    tag:   dados.tag || link,
    data:  { link },
  })
})

// ✅ Ao clicar na notificação — abre o app na rota certa
self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  const link = event.notification.data?.link ?? '/'
  let url
  try { url = new URL(link, self.location.origin) } catch (e) { url = null }
  // Só abre páginas do próprio app — um link externo numa notificação seria phishing
  url = url && url.origin === self.location.origin ? url.href : new URL('/hub', self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Se o app já está aberto, foca e navega
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.postMessage({ type: 'NAVIGATE', url })
          return
        }
      }
      // Se não está aberto, abre uma nova janela
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})