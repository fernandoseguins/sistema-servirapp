// src/utils/url.js
// Links vindos do banco (cifra, YouTube, lições, arquivos) são digitados por usuários.
// Só deixamos passar http/https — bloqueia `javascript:`, `data:` etc. (XSS armazenado).

export function urlSegura(url) {
  if (typeof url !== 'string' || !url.trim()) return undefined
  let bruto = url.trim()
  // "www.cifraclub.com.br/..." (sem protocolo) → assume https
  if (/^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(bruto)) bruto = `https://${bruto}`
  try {
    const u = new URL(bruto)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined
  } catch {
    return undefined
  }
}

// Para navegação interna (ex.: link de notificação): só caminhos do próprio app.
// Rejeita URLs absolutas e "//dominio.com" (open redirect).
export function caminhoInterno(link) {
  if (typeof link !== 'string') return null
  if (!link.startsWith('/') || link.startsWith('//') || link.startsWith('/\\')) return null
  return link
}
