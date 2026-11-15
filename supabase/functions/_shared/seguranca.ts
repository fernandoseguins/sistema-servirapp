// supabase/functions/_shared/seguranca.ts
// Helpers de segurança compartilhados pelas Edge Functions.
//
// IMPORTANTE: `verify_jwt = true` só garante que o JWT é válido — a chave ANON
// (pública, embutida no front) também é um JWT válido. Por isso as funções
// internas (crons / webhooks) precisam checar explicitamente a Service Role.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const APP_URL = (Deno.env.get('APP_URL') ?? 'https://servirapp.netlify.app').replace(/\/+$/, '')

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

function tokenDaRequisicao(req: Request): string | null {
  const auth = req.headers.get('Authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

// Comparação em tempo constante (evita timing attack na comparação de segredos)
function iguaisTempoConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

// Papel ("role") gravado no JWT, sem validar a assinatura.
function papelDoJwt(token: string): string | null {
  try {
    const parte = token.split('.')[1] ?? ''
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '=')
    const papel = JSON.parse(atob(base64))?.role
    return typeof papel === 'string' ? papel : null
  } catch {
    return null
  }
}

// Só deixa passar chamadas feitas com a Service Role (cron / webhook / outra função).
// Retorna uma Response 401 se não for, ou null se estiver ok.
//
// Aceita a chave idêntica à do ambiente OU um JWT com role "service_role".
// O segundo caso só é seguro porque TODAS as funções que usam isto têm
// `verify_jwt = true` (supabase/config.toml): o gateway já validou a assinatura.
// (Os crons e o trigger do banco guardam um JWT service_role diferente da
// SUPABASE_SERVICE_ROLE_KEY do ambiente — com a comparação exata, davam 401.)
export function exigirServiceRole(req: Request): Response | null {
  const token = tokenDaRequisicao(req)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (token && serviceKey && iguaisTempoConstante(token, serviceKey)) return null
  if (token && papelDoJwt(token) === 'service_role') return null
  return json({ error: 'Não autorizado' }, 401)
}

// Exige um usuário LOGADO de verdade (rejeita a chave anon).
// Retorna { user, client } com um client que respeita o RLS do usuário
// (ou { erro } com a Response 401 pronta).
export async function exigirUsuario(req: Request) {
  const token = tokenDaRequisicao(req)
  if (!token) return { erro: json({ error: 'Não autorizado' }, 401) }

  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return { erro: json({ error: 'Não autorizado' }, 401) }
  return { user: data.user, client }
}

// Aceita apenas caminhos internos ("/escala/123") ou URLs do próprio app.
// Qualquer outra coisa (domínio externo, javascript:, //evil.com) cai no /hub.
export function linkSeguroDoApp(link: unknown): string {
  const padrao = `${APP_URL}/hub`
  if (typeof link !== 'string' || !link) return padrao
  try {
    const url = new URL(link, APP_URL)
    if (url.origin !== new URL(APP_URL).origin) return padrao
    return url.href
  } catch {
    return padrao
  }
}

export function escaparHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}
