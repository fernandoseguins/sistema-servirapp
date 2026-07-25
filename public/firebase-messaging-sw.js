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
  const { title, body } = payload.notification ?? {}
  const link = payload.data?.link ?? payload.fcmOptions?.link ?? '/'

  // Mostra a notificação com ícone e badge
  self.registration.showNotification(title ?? 'SerVir', {
    body:  body ?? '',
    icon:  '/logo1.png',
    badge: '/logo1.png',
    tag:   'servir-notificacao',        // agrupa notificações do mesmo app
    renotify: true,                     // vibra mesmo com tag repetida
    data: { link },
  })
})

// ✅ Ao clicar na notificação — abre o app na rota certa
self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  const link = event.notification.data?.link ?? '/'
  const url  = new URL(link, self.location.origin).href

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