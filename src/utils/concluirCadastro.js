// src/utils/concluirCadastro.js
// Conclui o cadastro de quem se registrou mas ainda não tinha sessão
// (ex.: Supabase exige confirmação de e-mail).
//
// No signUp guardamos em user_metadata.cadastro_pendente tudo o que precisa de
// sessão para ser gravado (código de convite, funções, departamentos, instrumentos).
// Aqui, já logado, gravamos isso e limpamos o "pendente".
//
// É seguro chamar várias vezes: chamadas simultâneas compartilham a mesma
// promessa e os inserts só gravam o que ainda não existe.

import { supabase } from '../supabase'

let emAndamento = null

export function concluirCadastroPendente(user) {
  if (!user?.user_metadata?.cadastro_pendente) return Promise.resolve({ ok: true, erros: [] })
  if (!emAndamento) {
    emAndamento = executar(user).finally(() => { emAndamento = null })
  }
  return emAndamento
}

async function executar(user) {
  const pend = user.user_metadata.cadastro_pendente
  const erros = []

  // 1) Entra na igreja pelo código de convite (o servidor valida e grava o igreja_id).
  //    Precisa vir primeiro: o RLS dos vínculos depende do igreja_id do perfil.
  const { error: erroIgreja } = await supabase.rpc('entrar_na_igreja', { codigo: pend.codigo_convite || '' })
  if (erroIgreja) {
    console.error('Erro ao entrar na igreja:', erroIgreja.message)
    return { ok: false, erros: ['igreja'] }
  }

  // 2) Funções escolhidas no cadastro
  const { error: erroPerfil } = await supabase
    .from('users_profile')
    .update({ ...(pend.funcoes || {}) })
    .eq('id', user.id)
  if (erroPerfil) {
    console.error('Erro ao salvar perfil:', erroPerfil.message)
    return { ok: false, erros: ['perfil'] }
  }

  // 3) Departamentos (só os que ainda não existem)
  const depts = pend.departamentos || []
  if (depts.length > 0) {
    const { data: existentes, error: erroLer } = await supabase
      .from('membros_departamentos').select('departamento_id').eq('user_id', user.id)
    if (erroLer) {
      console.error('Erro ao ler departamentos:', erroLer.message)
      erros.push('departamentos')
    } else {
      const jaTem = new Set((existentes || []).map(d => d.departamento_id))
      const novos = depts.filter(id => !jaTem.has(id))
        .map(id => ({ user_id: user.id, departamento_id: id, role: 'membro' }))
      if (novos.length > 0) {
        const { error } = await supabase.from('membros_departamentos').insert(novos)
        if (error) { console.error('Erro ao salvar departamentos:', error.message); erros.push('departamentos') }
      }
    }
  }

  // 4) Instrumentos (só os que ainda não existem)
  const insts = pend.instrumentos || []
  if (insts.length > 0) {
    const { data: existentes, error: erroLer } = await supabase
      .from('user_instruments').select('instrumento').eq('user_id', user.id)
    if (erroLer) {
      console.error('Erro ao ler instrumentos:', erroLer.message)
      erros.push('instrumentos')
    } else {
      const jaTem = new Set((existentes || []).map(i => i.instrumento))
      const novos = insts.filter(i => !jaTem.has(i)).map(i => ({ user_id: user.id, instrumento: i }))
      if (novos.length > 0) {
        const { error } = await supabase.from('user_instruments').insert(novos)
        if (error) { console.error('Erro ao salvar instrumentos:', error.message); erros.push('instrumentos') }
      }
    }
  }

  // 5) Tudo gravado: limpa o pendente. Se algo falhou, mantém para tentar no próximo login.
  if (erros.length === 0) {
    const { error } = await supabase.auth.updateUser({ data: { cadastro_pendente: null } })
    if (error) console.warn('Cadastro concluído, mas não foi possível limpar o pendente:', error.message)
  }

  return { ok: erros.length === 0, erros }
}
