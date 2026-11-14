// src/theme/deptCores.js
// Cores de departamento do tema Vibrante (claro/escuro via variáveis em src/index.css).
// Departamento sem tema próprio (personalizado) usa "outro".

const CONHECIDOS = ['louvor', 'midia', 'infantil', 'diaconia', 'cantina', 'ministros']

export function slugDept(nome) {
  const s = String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
  return CONHECIDOS.includes(s) ? s : 'outro'
}

export function classesDept(nome) {
  const s = slugDept(nome)
  return {
    chip: `bg-dept-${s}-bg text-dept-${s}-fg`,
    icone: `text-dept-${s}-fg`,
  }
}
