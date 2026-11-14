// src/utils/pushTokens.js
// Registro do token de push (FCM) do aparelho atual — um por aparelho, em push_tokens.
import { supabase } from '../supabase'

const CHAVE_STORAGE = 'servir_push_token'

// Token deste aparelho (memória + localStorage, para o logout saber qual remover)
let tokenAtual = null

function lerTokenSalvo() {
  if (tokenAtual) return tokenAtual
  try { return localStorage.getItem(CHAVE_STORAGE) } catch { return null }
}

function salvarToken(token) {
  tokenAtual = token
  try {
    if (token) localStorage.setItem(CHAVE_STORAGE, token)
    else localStorage.removeItem(CHAVE_STORAGE)
  } catch { /* ignora (modo privado / storage bloqueado) */ }
}

export function plataformaAtual() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  if (/android/i.test(ua)) return 'web-android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'web-ios'
  return 'web-desktop'
}

// Grava o token do aparelho para o usuário logado.
// - push_tokens via RPC (transfere o token se outra conta usava este aparelho)
// - users_profile.fcm_token continua sendo gravado (compatibilidade)
export async function registrarTokenPush(userId, token) {
  if (!userId || !token) return
  salvarToken(token)

  const { error: erroRpc } = await supabase.rpc('registrar_push_token', {
    p_token: token,
    p_plataforma: plataformaAtual(),
  })
  if (erroRpc) console.error('❌ Erro ao registrar aparelho:', erroRpc.message)

  const { error } = await supabase
    .from('users_profile')
    .update({ fcm_token: token })
    .eq('id', userId)
  if (error) console.error('❌ Erro ao salvar token:', error.message)
}

// Chamar ANTES do signOut (precisa da sessão para passar no RLS).
// Melhor esforço: nunca impede o logout.
export async function removerTokenPushDoAparelho() {
  const token = lerTokenSalvo()
  if (!token) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (userId) {
      await supabase.from('push_tokens').delete().eq('token', token)
      await supabase
        .from('users_profile')
        .update({ fcm_token: null })
        .eq('id', userId)
        .eq('fcm_token', token)
    }
  } catch (erro) {
    console.error('⚠️ Não foi possível remover o aparelho:', erro)
  } finally {
    salvarToken(null)
  }
}
