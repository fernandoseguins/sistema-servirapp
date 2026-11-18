// Listas de rotas usadas pelo AppShell (e pelo teste-guarda src/theme/legado.test.js).

// Telas de foco: sem menu (tarefas longas ou impressão)
export const ROTAS_FOCO = ['/gerar-escala', '/checkin', '/imprimir-escalas', '/cabine']

// Telas já no novo visual (o resto é legado e fica no tema claro)
export const ROTAS_NOVAS = ['/hub', '/escalas', '/avisos', '/perfil', '/dashboard', '/escala/', '/dev/ui',
  '/indisponibilidade', '/trocas', '/equipe', '/louvores', '/criar-aviso', '/aviso-geral', '/informativo', '/frequencia', '/gerar-escala', '/cantina', '/ministros', '/licoes', '/checkin', '/cabine', '/checklist-midia']

export const comeca = (pathname, lista) => lista.some(p => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))
