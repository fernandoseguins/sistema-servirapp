// supabase/functions/_shared/push.ts
// Envio de push (FCM HTTP v1) para TODOS os aparelhos de um usuário.
//
// Tokens vêm de public.push_tokens (um por aparelho). Se o usuário ainda não
// tem nenhum, cai no legado users_profile.fcm_token.
// Token que o FCM diz não existir mais (UNREGISTERED / 404) é apagado.
//
// O client passado precisa ter poder de Service Role (push_tokens tem RLS):
// - createClient(url, SERVICE_ROLE_KEY), ou
// - createClient(url, ANON_KEY, { global: { headers: { Authorization: 'Bearer <service role>' } } })
//   (o PostgREST usa o JWT do header → role service_role, que ignora RLS).

import { JWT } from "npm:google-auth-library@9"
import { linkSeguroDoApp } from "./seguranca.ts"

// deno-lint-ignore no-explicit-any
type Cliente = any

export type MensagemPush = {
  titulo: string
  mensagem: string
  link?: string
  tag?: string   // mesma tag = o aparelho substitui a notificação anterior
}

export type ResultadoEnvio = {
  enviados: number    // aparelhos que receberam
  invalidos: number   // tokens apagados por não existirem mais
  falhas: number      // outros erros
}

type Credenciais = { projectId: string; jwt: JWT }
let credenciais: Credenciais | null = null

function carregarCredenciais(): Credenciais {
  if (credenciais) return credenciais
  const chave = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!chave) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada.')
  const sa = JSON.parse(chave)
  credenciais = {
    projectId: sa.project_id,
    jwt: new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    }),
  }
  return credenciais
}

// FCM respondeu que o token não existe mais?
function tokenInvalido(status: number, corpo: string): boolean {
  return status === 404
    || corpo.includes('UNREGISTERED')
    || corpo.includes('registration-token-not-registered')
}

type Envio = 'ok' | 'invalido' | 'falha'

async function enviarParaToken(token: string, msg: MensagemPush): Promise<Envio> {
  const { projectId, jwt } = carregarCredenciais()
  const { token: accessToken } = await jwt.getAccessToken()

  const resposta = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        // Só `data` (sem `notification`): quem exibe é o service worker
        // (public/firebase-messaging-sw.js). Com `notification` o SDK do Firebase
        // exibia sozinho E o service worker exibia de novo → push duplicado.
        data: {
          titulo: msg.titulo,
          mensagem: msg.mensagem,
          // o link só pode apontar para o próprio app
          link: linkSeguroDoApp(msg.link),
          ...(msg.tag ? { tag: msg.tag } : {}),
        },
        webpush: { headers: { Urgency: 'high' } },
      },
    }),
  })

  if (resposta.ok) return 'ok'

  // Detalhes só no log do servidor
  const corpo = await resposta.text().catch(() => '')
  if (tokenInvalido(resposta.status, corpo)) return 'invalido'
  console.error('Erro do Firebase:', resposta.status, corpo)
  return 'falha'
}

// Remove um token morto (da tabela nova e do campo legado)
async function apagarToken(client: Cliente, token: string) {
  const { error } = await client.from('push_tokens').delete().eq('token', token)
  if (error) console.error('Erro ao apagar token inválido:', error.message)
  const { error: erroLegado } = await client
    .from('users_profile').update({ fcm_token: null }).eq('fcm_token', token)
  if (erroLegado) console.error('Erro ao limpar fcm_token inválido:', erroLegado.message)
}

// Todos os tokens do usuário (push_tokens; senão o fcm_token legado)
export async function tokensDoUsuario(client: Cliente, userId: string): Promise<string[]> {
  const { data, error } = await client
    .from('push_tokens').select('token').eq('user_id', userId)
  if (error) console.error('Erro ao buscar push_tokens:', error.message)

  const tokens = [...new Set((data ?? []).map((l: { token: string }) => l.token).filter(Boolean))] as string[]
  if (tokens.length) return tokens

  const { data: perfil } = await client
    .from('users_profile').select('fcm_token').eq('id', userId).maybeSingle()
  const legado = perfil?.fcm_token as string | null | undefined
  if (!legado) return []

  // O token legado pode já ter sido transferido para outra conta (troca de
  // conta no mesmo aparelho) — nesse caso não é mais deste usuário.
  const { data: dono } = await client
    .from('push_tokens').select('user_id').eq('token', legado).maybeSingle()
  if (dono && dono.user_id !== userId) return []

  return [legado]
}

// Dono de um token (para quem chama enviar-notificacao só com o token legado)
export async function donoDoToken(client: Cliente, token: string): Promise<string | null> {
  const { data } = await client
    .from('push_tokens').select('user_id').eq('token', token).maybeSingle()
  if (data?.user_id) return data.user_id
  const { data: perfil } = await client
    .from('users_profile').select('id').eq('fcm_token', token).limit(1).maybeSingle()
  return perfil?.id ?? null
}

export async function enviarParaTokens(client: Cliente, tokens: string[], msg: MensagemPush): Promise<ResultadoEnvio> {
  const resultado: ResultadoEnvio = { enviados: 0, invalidos: 0, falhas: 0 }
  for (const token of tokens) {
    try {
      const r = await enviarParaToken(token, msg)
      if (r === 'ok') resultado.enviados++
      else if (r === 'invalido') {
        resultado.invalidos++
        await apagarToken(client, token)
      } else resultado.falhas++
    } catch (erro) {
      console.error('Erro ao enviar push:', erro)
      resultado.falhas++
    }
  }
  return resultado
}

export async function enviarPushParaUsuario(client: Cliente, userId: string, msg: MensagemPush): Promise<ResultadoEnvio> {
  const tokens = await tokensDoUsuario(client, userId)
  if (!tokens.length) return { enviados: 0, invalidos: 0, falhas: 0 }
  return enviarParaTokens(client, tokens, msg)
}
