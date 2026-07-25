// src/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

// As suas chaves de acesso do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDaHsGHM1RrgmWEBtL3SfWbh9AqvUT6Oic",
  authDomain: "servir-a4eb4.firebaseapp.com",
  projectId: "servir-a4eb4",
  storageBucket: "servir-a4eb4.firebasestorage.app",
  messagingSenderId: "322885267202",
  appId: "1:322885267202:web:71818334869f928a7c9c1b"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o serviço de Mensagens (Notificações Push)
export const messaging = getMessaging(app);

// ✅ ATUALIZADO: Agora recebemos o 'registration' para forçar o Firebase a não travar
export const solicitarTokenFCM = async (registration) => {
  try {
    const chavePublica = "BBabNa9N66SwTbq96CvK4tElMfqiOdetR9Y26eU_3FXboaWdDALMJLx52qq4A4HwwgHkD2ZHqphHODttl8HEZcg";
    
    // Passamos o serviceWorkerRegistration junto com a chave pública
    const tokenAtual = await getToken(messaging, { 
      vapidKey: chavePublica,
      serviceWorkerRegistration: registration 
    });
    
    if (tokenAtual) {      return tokenAtual;
    } else {      return null;
    }
  } catch (erro) {
    console.error("❌ Erro ao pegar o token do Firebase:", erro);
    return null;
  }
};