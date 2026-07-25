// src/utils/datas.js
// Utilitários de data seguros para o fuso horário do Brasil.
//
// PROBLEMA que isto resolve:
// new Date().toISOString() converte para UTC. No Brasil (UTC-3), depois
// das 21h a data UTC já é o dia seguinte — então "hoje" apareceria errado
// à noite, justo no horário dos cultos. Estas funções usam a data LOCAL.

/**
 * Retorna a data de hoje no formato 'YYYY-MM-DD' usando o fuso LOCAL
 * (não UTC). Seguro para comparar com datas de escala salvas no banco.
 */
export function hojeLocal() {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Converte um objeto Date para 'YYYY-MM-DD' no fuso LOCAL.
 * Use no lugar de date.toISOString().split('T')[0].
 */
export function dataLocalISO(date) {
  const d = date instanceof Date ? date : new Date(date)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}