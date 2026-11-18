# Reforma visual — Fase 3 (demais telas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar as 20 telas que ainda estão no visual antigo para o tema Vibrante (claro + escuro roxo), uma por tarefa, sem mudar nenhuma regra de negócio, e no fim apagar o invólucro `TemaClaroForcado` e as peças antigas.

**Architecture:** Cada tela troca `PageHeader`, `components/EmptyState`, `getDeptTheme` e classes de cor soltas (`bg-gray-*`, `bg-blue-600`…) pelas peças de `src/components/ui/` e pelos tokens (`bg-surface`, `text-ink`, `border-line`, `bg-topo`…). Ao terminar uma tela, a rota dela entra em `ROTAS_NOVAS` e o arquivo entra num teste-guarda (`legado.test.js`) que falha se a tela voltar a usar peças ou cores antigas. Consultas Supabase, handlers e validações ficam intactos.

**Tech Stack:** React 19, Vite 7, Tailwind 3.4, react-router-dom 7, lucide-react, vite-plugin-pwa, Supabase JS, vitest. Nada novo.

**Spec:** `docs/superpowers/specs/2026-11-14-reforma-visual-design.md` (seção "Ordem de entrega", item 3). Plano anterior, com as peças e tokens: `docs/superpowers/plans/2026-11-14-reforma-visual-fase-1-2.md`.

## Global Constraints
- Nenhuma mudança em banco, RLS, edge functions ou regra de negócio. Consultas, `useUI()` (`toast`, `confirm`), handlers e validações de cada tela ficam como estão.
- Cada tela é reformada **inteira** de uma vez: nada de metade antiga e metade nova na mesma tela.
- Usar só tokens: `bg-bg`, `bg-surface`, `bg-surface-2`, `border-line`, `text-ink`, `text-ink-2`, `text-muted`, `brand`, `accent`, `topo`, `danger`/`success`/`warning` (+ `-soft`), `on-*`, `rounded-card` (18px), `rounded-ctl` (12px), `rounded-full` em pills. Cor de departamento só via `classesDept(nome)` + `<IconeDept nome />`.
- Permitidos fora dos tokens: `white`/`black` com opacidade em sobreposições (`bg-black/40`, `text-white` sobre `bg-topo`) e a "folha de papel" da impressão.
- Peças obrigatórias: `TopBar` no lugar de `PageHeader`; `EmptyState` de `components/ui`; `Button`, `Card`, `Pill`, `ListRow`, `Input`, `Select`, `Sheet` sempre que o elemento for desse tipo.
- Tudo clicável é `<button>`/`<a>`/`<Link>`; botão só com ícone tem `aria-label`. Nada de `<div onClick>`.
- Contraste mínimo WCAG AA em claro e escuro.
- Copy em português, frases curtas, sem "por favor", sem "com sucesso". Textos atuais podem ser encurtados, nunca mudar de sentido.
- Testar sempre no Supabase local (`npm run dev` com `.env.development.local`, login `admin@teste.local` do `supabase/seed.sql`), em 375px e ≥1024px, claro e escuro. Nada de testar em produção.
- Referência de tela já reformada para copiar o padrão: `src/pages/Dashboard.jsx` (TopBar com ícone do depto, `Sheet`, `ListRow`, `confirm`).

## Receita de cada tela (vale para as Tasks 2–19)
Cada tarefa de tela segue estes passos; a tarefa só diz o que é específico dela.
1. **Teste-guarda falha:** adicionar `{ arquivo, rota }` da tela em `TELAS_REFORMADAS` (`src/theme/legado.test.js`); `npm test` → FAIL nessa tela.
2. **Reformar** o JSX conforme as Global Constraints e os pontos da tarefa. Botão voltar do `TopBar` faz o mesmo que o `PageHeader` fazia (`navigate(-1)` ou o `onBack` atual). Carregando: skeleton com `bg-surface-2 animate-pulse`.
3. **Liberar a rota:** adicionar o prefixo em `ROTAS_NOVAS` (`src/components/shell/rotas.js`).
4. `npm test` → PASS; `npx eslint <arquivo>` sem erros novos.
5. **Verificar no navegador** (banco local, 375px e 1024px, claro e escuro): os itens da tarefa + nada transborda + `Tab` alcança todos os controles com anel de foco + último item não fica atrás do menu.
6. **Commit** com a mensagem da tarefa.

## Review Focus
1. **Formulários longos no escuro** (campos, `select`, `textarea`, `input[type=date|time]`): texto, placeholder e ícone do calendário nativo legíveis. → `color-scheme: dark` já vem do `.dark`; conferir nas Tasks 2, 5, 6, 10, 11, 12 e 19.
2. **Tela de departamento sem cor própria** (departamento personalizado criado em Criar igreja): ícone e chip usam `outro`, nunca classe vazia. → verificar nas Tasks 2, 3, 4 e 9 com um depto personalizado do banco local.
3. **Impressão no escuro**: imprimir com o app no modo escuro sai em folha branca e texto preto. → Task 16.
4. **Lista vazia** (depto sem membros, sem músicas, sem trocas, sem dias off, sem aulas, sem checklists): `EmptyState` com texto útil, nunca tela branca. → cada tarefa de lista.
5. **Diálogo e toast** (`useUI`) por cima de `Sheet` e do menu fixo, no escuro: aparecem na frente e legíveis. → Tasks 4 e 11.

---

## File Structure
- `src/components/shell/rotas.js` — `ROTAS_FOCO`, `ROTAS_NOVAS`, `comeca` (saem de `AppShell.jsx`).
- `src/theme/legado.test.js` — teste-guarda das telas reformadas.
- Reformadas (uma por tarefa): `src/pages/{Unavailability,SwapRequests,Team,Songs,CreateNotice,AvisoGeral,GlobalNotice,FrequencyReport,GenerateSchedule,CantinaSchedule,MinistrosSchedule,InfantilLessons,InfantilCheckin,Cabine,ChecklistMidia,PrintSchedules,GestaoIgreja,PainelDono,IgrejaDetalhes,CriarIgreja}.jsx`.
- Removidos na Task 20: `src/components/shell/TemaClaroForcado.jsx`, bloco `.tema-claro-forcado` de `src/index.css`, `src/components/PageHeader.jsx`, `src/components/EmptyState.jsx`, `src/utils/departmentThemes.jsx` (se nada mais importar), `dept.*.DEFAULT` em `tailwind.config.js`.

---

### Task 1: Teste-guarda e rotas num módulo

**Files:**
- Create: `src/components/shell/rotas.js`, `src/theme/legado.test.js`
- Modify: `src/components/shell/AppShell.jsx` (importa de `rotas.js`), `src/pages/Profile.jsx:49-65`, `src/pages/ScheduleDetails.jsx` (linhas 910, 922, 945, 986, 1003, 1050, 1128, 1191, 1325, 1333, 1340), `src/components/Skeletons.jsx` (`ScheduleDetailsSkeleton` e peças que ele usa)

**Interfaces:**
- Produces:
  - `rotas.js`: `export const ROTAS_FOCO: string[]`, `export const ROTAS_NOVAS: string[]` (valores atuais de `AppShell.jsx`), `export function comeca(pathname: string, lista: string[]): boolean` (mesma lógica de hoje).
  - `legado.test.js`: `const TELAS_REFORMADAS: { arquivo: string, rota: string }[]` — `arquivo` relativo a `src/` (ex.: `'pages/Hub.jsx'`), `rota` é um caminho real de exemplo (ex.: `'/escala/abc'`). As tarefas seguintes só acrescentam linhas.

- [ ] **Step 1: Escrever o teste** `legado.test.js` (lê cada arquivo com `fs.readFileSync(new URL('../' + arquivo, import.meta.url), 'utf8')`). Lista inicial: `pages/Hub.jsx` `/hub`, `pages/Dashboard.jsx` `/dashboard`, `pages/ScheduleDetails.jsx` `/escala/abc`, `pages/Profile.jsx` `/perfil`, `pages/Auth.jsx` *(sem rota: pular a checagem de rota quando `rota` for `null`)*, `pages/MinhasEscalas.jsx` `/escalas`, `pages/Avisos.jsx` `/avisos`, `components/Skeletons.jsx` `null`. Para cada tela, um `it` por regra:
  ```js
  const COR_ANTIGA = /\b(bg|text|border|ring|from|via|to|divide|placeholder)-(gray|slate|zinc|neutral|stone|blue|indigo|purple|violet|sky|cyan|teal|emerald|green|lime|yellow|amber|orange|red|rose|pink|fuchsia)-\d{2,3}\b/
  const IMPORT_ANTIGO = /from\s+['"][^'"]*(components\/PageHeader|components\/EmptyState|departmentThemes)['"]/
  const DIV_CLICAVEL = /<(div|span|li|img)\b[^>]*\bonClick=/
  expect(texto).not.toMatch(COR_ANTIGA)
  expect(texto).not.toMatch(IMPORT_ANTIGO)
  expect(texto).not.toMatch(DIV_CLICAVEL)
  if (rota) expect(comeca(rota, ROTAS_NOVAS)).toBe(true)
  ```
  Mais um `it` fora do laço: `comeca('/equipe', ROTAS_NOVAS) === false` (prova que o guarda distingue legado).
- [ ] **Step 2:** `npm test` → FAIL em `Profile.jsx` (força da senha, linhas 46–65), `ScheduleDetails.jsx` (`divide-gray-*`, `focus:ring-{blue,amber,purple,yellow}-*`, `<span onClick>` do tom na linha 1003) e `Skeletons.jsx` (`bg-gray-*`); falha também por `rotas.js` não existir.
- [ ] **Step 3:** Criar `rotas.js` e fazer `AppShell` importar dele (comportamento igual). Profile: força da senha → `danger` (muito fraca/fraca), `warning` (razoável), `brand` (boa), `success` (forte), barra vazia `bg-surface-2`. ScheduleDetails: `divide-line`, `focus:ring-brand` (troca: `focus:ring-warning`), e o tom vira `<button type="button" aria-label="Mudar tom">` quando `podeGerirMusicas`, `<span>` sem `onClick` senão. Skeletons: `bg-surface-2`, fundo `bg-bg`, topo `bg-topo`.
- [ ] **Step 4:** `npm test` → PASS (todos, incluindo os antigos).
- [ ] **Step 5: Verificar:** força da senha no Perfil muda de cor nos 5 níveis, claro e escuro; skeleton da escala (rede lenta no DevTools) sem cinza claro no escuro.
- [ ] **Step 6: Commit** `test(tema): guarda contra visual antigo nas telas reformadas`.

### Task 2: Dias off — `pages/Unavailability.jsx`, rota `/indisponibilidade`
- `TopBar` com ícone/chip do depto (como Dashboard). Calendário de seleção: dia marcado `bg-brand text-on-brand`, hoje com `ring-brand`, dias de outro mês `text-muted`; cada dia é `<button aria-label="<dia> de <mês>" aria-pressed>`.
- Lista de dias já marcados com `ListRow` e botão remover (`aria-label="Remover <data>"`); vazio → `EmptyState`. Os 2 `confirm` atuais mantidos.
- Verificar: marcar e desmarcar dia grava no banco local (conferir em `psql`); membro e líder veem o mesmo que antes.
- Commit `feat(dias-off): novo visual`.

### Task 3: Trocas — `pages/SwapRequests.jsx`, rota `/trocas/abc`
- Seções "Pendentes" e "Histórico" em `Card`; cada pedido com `ListRow` (quem pede · escala · data) e `Pill` de status (`aviso` pendente, `sucesso` aprovada, `perigo` recusada). Aprovar = `Button` primário, recusar = `Button` `perigo`, ambos `size="sm"`.
- Aprovação continua chamando a RPC atômica de hoje (commit `37ecc11`); não mexer.
- Verificar: pedir troca em `/escala/:id`, aprovar aqui com o líder, escala atualizada; vazio → `EmptyState`.
- Commit `feat(trocas): novo visual`.

### Task 4: Equipe — `pages/Team.jsx`, rota `/equipe`
- Membros com `ListRow` (avatar/inicial, nome, funções em `Pill`), busca com `Input icon={Search}`. Ações do membro (mudar função, tornar líder, remover…) num `Sheet` aberto pelo botão "⋯" da linha (`aria-label="Ações de <nome>"`), mesmas ações e mesmos `confirm` de hoje.
- Adicionar membro: `Button` no `TopBar` (`acoes`).
- Verificar: adicionar, trocar função, remover; `confirm` aparece na frente do `Sheet` no escuro; depto personalizado mostra ícone `outro`.
- Commit `feat(equipe): novo visual`.

### Task 5: Músicas — `pages/Songs.jsx`, rota `/louvores`
- Lista com `ListRow` (título, artista, tom em `Pill`); busca com `Input`; links externos (cifra/vídeo) como `<a target="_blank" rel="noreferrer">` com `aria-label`.
- Formulário de nova/editar música num `Sheet` com `Input`/`Select`.
- Verificar: criar, editar, apagar música; vazio → `EmptyState`.
- Commit `feat(musicas): novo visual`.

### Task 6: Criar aviso — `pages/CreateNotice.jsx`, rota `/criar-aviso`
- Formulário em `Card` com `Input`, `textarea` estilizado igual ao `Input` (`bg-surface border-line rounded-ctl`), `Select`; botão publicar `Button` primário `full`.
- Verificar: aviso criado aparece no mural do Dashboard e na aba Avisos de quem é do depto.
- Commit `feat(avisos): novo visual de criar aviso`.

### Task 7: Aviso da gestão — `pages/AvisoGeral.jsx`, rota `/aviso-geral`
- Mesmo formulário da Task 6; departamentos de destino como `Pill` clicáveis (`<button aria-pressed>`) com `classesDept`.
- Verificar: enviar para 2 deptos cria uma cópia em cada mural (`da_gestao=true`).
- Commit `feat(avisos): novo visual do aviso da gestão`.

### Task 8: Informativo — `pages/GlobalNotice.jsx`, rota `/informativo`
- `TopBar` + conteúdo em `Card`s; qualquer formulário de edição com `Input`/`Select`/`Button`.
- Verificar: tudo que a tela mostra/edita hoje continua igual (conferir antes de reformar e listar no relatório).
- Commit `feat(informativo): novo visual`.

### Task 9: Frequência — `pages/FrequencyReport.jsx`, rota `/frequencia`
- Filtro de período com `Select`; tabela vira lista de `ListRow` no mobile (nome · presenças · %) e tabela com `border-line` ≥768px; barras de % em `bg-brand` sobre `bg-surface-2`.
- Verificar: números iguais aos de antes (anotar 3 membros antes de reformar e comparar).
- Commit `feat(frequencia): novo visual`.

### Task 10: Gerar escala — `pages/GenerateSchedule.jsx`, rota `/gerar-escala` (tela de foco, sem menu)
- `TopBar` com voltar; passos/etapas atuais em `Card`s; prévia da escala gerada com `ListRow` por data; confirmar = `Button` primário `full` fixo no rodapé com `pb-[env(safe-area-inset-bottom)]`. Os 2 `confirm` mantidos.
- Verificar: gerar um mês no banco local produz as mesmas escalas que antes (mesmo depto, mesmo mês, comparar contagem em `psql`).
- Commit `feat(gerar-escala): novo visual`.

### Task 11: Cantina — `pages/CantinaSchedule.jsx`, rota `/cantina`
- Domingos do mês em `Card`; vagas "Caixa" e "Atendente 1/2" com `Select`; as 4 `div onClick` viram `<button>`. Os 4 `confirm` mantidos.
- Verificar: preencher e salvar um domingo; `confirm` e `toast` legíveis no escuro.
- Commit `feat(cantina): novo visual`.

### Task 12: Ministros — `pages/MinistrosSchedule.jsx`, rota `/ministros`
- Mesmo padrão da Task 11; campo de visitante com `Input`; as 4 `div onClick` viram `<button>`. Os 4 `confirm` mantidos.
- Verificar: escalar ministro cadastrado e visitante digitado no mesmo dia.
- Commit `feat(ministros): novo visual`.

### Task 13: Lições do infantil — `pages/InfantilLessons.jsx`, rota `/licoes`
- Lições com `ListRow` (data · tema); nova lição num `Sheet`. `confirm` mantido.
- Commit `feat(licoes): novo visual`.

### Task 14: Check-in do infantil — `pages/InfantilCheckin.jsx`, rota `/checkin` (tela de foco)
- Busca de criança com `Input` grande; cada criança é `ListRow` com `Button` "Entrada"/"Saída"; contadores do culto em `Card`s com `Pill`. A `div onClick` vira `<button>`. Os 2 `confirm` mantidos.
- Verificar: entrada e saída de uma criança gravam como antes; botões com no mínimo 44px de altura (uso rápido no celular).
- Commit `feat(checkin): novo visual`.

### Task 15: Cabine e checklist de mídia — `pages/Cabine.jsx` (`/cabine/abc`, foco) e `pages/ChecklistMidia.jsx` (`/checklist-midia`)
- Duas telas do mesmo fluxo, mesmo commit. Itens do checklist como `<label>` + checkbox nativo estilizado (`accent-brand`), cada um alcançável por teclado; histórico com `ListRow` por data; vazio → `EmptyState`.
- Verificar: marcar itens na Cabine e ver o registro no histórico.
- Commit `feat(midia): novo visual da cabine e do checklist`.

### Task 16: Imprimir escalas — `pages/PrintSchedules.jsx`, rota `/imprimir-escalas` (foco)
- Barra de ações no tema (`TopBar` + `Button` "Imprimir" que chama `window.print()`); a área impressa é uma "folha" `bg-white text-black` em ambos os temas (exceção permitida). O `@media print` atual continua escondendo a barra.
- Verificar: com o app no escuro, a prévia de impressão do navegador sai branca com texto preto e sem a barra.
- Commit `feat(impressao): novo visual da tela de impressão`.

### Task 17: Gestão da igreja — `pages/GestaoIgreja.jsx`, rota `/gestao-igreja`
- Números em `Card`s (grade 2 colunas no mobile); aniversariantes com `ListRow`; ferramentas com `ListRow` com ícone e seta. As 6 `div onClick` viram `<button>`/`<Link>`. `confirm` mantido.
- Commit `feat(gestao): novo visual`.

### Task 18: Painel do dono e detalhes da igreja — `pages/PainelDono.jsx` (`/painel-dono`) e `pages/IgrejaDetalhes.jsx` (`/igreja/abc`)
- Mesmo fluxo, mesmo commit. Igrejas com `ListRow` (nome · código · `Pill` ativa/inativa); detalhes em `Card`s; ações destrutivas com `Button variant="perigo"`. As 2 `div onClick` viram `<button>`. `confirm`s mantidos. Proteção por e-mail do super admin intacta.
- Commit `feat(painel-dono): novo visual`.

### Task 19: Criar igreja — `pages/CriarIgreja.jsx`, rota `/criar-igreja`
- Etapas (dados → departamentos → criar) com indicador "Passo N de 3"; departamentos como `Pill` clicáveis (`aria-pressed`); campos com `Input`. Código gerado em `Card` com botão copiar (`aria-label="Copiar código"`).
- Verificar no banco local: criar uma igreja com 1 depto personalizado; abrir esse depto mostra ícone/cor `outro`.
- Commit `feat(criar-igreja): novo visual`.

### Task 20: Limpeza do legado
**Files:** os da seção File Structure em "Removidos"; `src/components/shell/AppShell.jsx`; `src/components/shell/rotas.js`; `src/theme/legado.test.js`.

- [ ] **Step 1: Conferir que nada ficou para trás:** toda rota do `<Routes>` de `src/App.jsx` (menos `/`, `*` e `/dev/ui`) tem a tela em `TELAS_REFORMADAS`. Se faltar alguma, parar e reformá-la antes (nova tarefa).
- [ ] **Step 2: Teste que falha:** em `legado.test.js`, trocar a checagem de rota por: nenhum arquivo em `src/` (varrer com `fs.readdirSync(..., { recursive: true })`, só `.js`/`.jsx`) importa `TemaClaroForcado`, `components/PageHeader` ou `components/EmptyState`; remover o `it` de `/equipe`. `npm test` → FAIL (`AppShell` importa `TemaClaroForcado`).
- [ ] **Step 3:** Apagar `TemaClaroForcado.jsx` e o bloco `.tema-claro-forcado` do CSS; `AppShell` sem o ramo `nova`; `ROTAS_NOVAS` sai de `rotas.js` (fica só `ROTAS_FOCO` e `comeca`). Apagar `PageHeader.jsx`, `components/EmptyState.jsx` e `dept.*.DEFAULT` do Tailwind. `departmentThemes.jsx`: apagar se `grep -rn departmentThemes src` não achar import; se alguma tela ainda usar `getDeptIcones`/`gerarTemaDeCor`, manter só essas funções.
- [ ] **Step 4:** `npm test` → PASS; `npm run build` sem erros; `npx eslint src` sem erros novos.
- [ ] **Step 5: Verificar no navegador** (375px e 1024px, claro e escuro) as 20 rotas reformadas, e as 5 linhas do Review Focus.
- [ ] **Step 6:** Prints de Equipe, Gerar escala, Músicas, Dias off, Trocas e Check-in (claro e escuro) para o Fernando.
- [ ] **Step 7: Commit** `chore(tema): remove invólucro claro e peças antigas`.
