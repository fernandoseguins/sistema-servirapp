// Listas de rotas usadas pelo AppShell.

// Telas de foco: sem menu (tarefas longas ou impressão)
export const ROTAS_FOCO = ['/gerar-escala', '/checkin', '/imprimir-escalas', '/cabine']

export const comeca = (pathname, lista) => lista.some(p => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))
