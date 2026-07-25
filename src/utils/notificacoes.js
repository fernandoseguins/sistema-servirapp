// src/utils/notificacoes.js
// Utilitário central de notificações do SerVir.
//
// REGRA NOVA (push automático via trigger no banco):
//   Estas funções APENAS inserem na tabela `notifications`.
//   Um Database Webhook do Supabase dispara a Edge Function `push-on-insert`
//   automaticamente a cada INSERT, que busca o token e envia o push no celular.
//
//   Ou seja: não precisamos mais disparar o push pelo front-end.
//   Isso torna o push 100% confiável — funciona mesmo se o app fechar logo após a ação.

import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// enviarNotificacao — notifica UM usuário
// ─────────────────────────────────────────────────────────────────────────────
export async function enviarNotificacao({
  userId,
  departamentoId = null,
  titulo,
  mensagem,
  tipo = 'aviso',
  link = null,
}) {
  if (!userId || !titulo) return
  try {
    // Só insere — o trigger no banco dispara o push sozinho.
    const { error } = await supabase.from('notifications').insert([{
      user_id:               userId,
      departamento_id:       departamentoId,
      titulo,
      mensagem,
      tipo,
      link_redirecionamento: link,
    }])
    if (error) console.warn('Erro ao inserir notificação:', error.message)
  } catch (err) {
    console.warn('Erro em enviarNotificacao:', err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// enviarNotificacaoEmMassa — notifica VÁRIOS usuários
// ─────────────────────────────────────────────────────────────────────────────
export async function enviarNotificacaoEmMassa({
  userIds,
  departamentoId = null,
  titulo,
  mensagem,
  tipo = 'aviso',
  link = null,
}) {
  if (!userIds?.length || !titulo) return
  try {
    // Insere uma linha por usuário — o trigger dispara um push para cada.
    const linhas = userIds.map(id => ({
      user_id:               id,
      departamento_id:       departamentoId,
      titulo,
      mensagem,
      tipo,
      link_redirecionamento: link,
    }))
    const { error } = await supabase.from('notifications').insert(linhas)
    if (error) console.warn('Erro ao inserir notificações em massa:', error.message)
  } catch (err) {
    console.warn('Erro em enviarNotificacaoEmMassa:', err.message)
  }
}