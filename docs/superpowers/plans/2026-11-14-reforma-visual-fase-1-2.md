# Reforma visual — Fases 1 e 2 (fundação + telas principais) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao SerVir a identidade Vibrante (claro) + escuro roxo, menu fixo de 4 abas e as 7 telas principais reorganizadas, sem mudar nenhuma regra de negócio.

**Architecture:** Cores viram variáveis CSS (`:root` claro, `.dark` escuro) mapeadas no Tailwind; peças reutilizáveis em `src/components/ui/`; um `AppShell` envolve as rotas logadas com `BottomNav` (mobile) / barra lateral (desktop). Telas ainda não reformadas (fase 3) rodam dentro de um invólucro que força o tema claro, para nunca ficarem ilegíveis no escuro.

**Tech Stack:** React 19, Vite 7, Tailwind 3.4, react-router-dom 7, lucide-react, vite-plugin-pwa, Supabase JS. Novos: `@fontsource/sora`, `vitest` (dev).

**Spec:** `docs/superpowers/specs/2026-11-14-reforma-visual-design.md`

## Global Constraints
- Nenhuma mudança em banco, RLS, edge functions ou regra de negócio; consultas Supabase das telas são reaproveitadas como estão.
- Fonte Sora auto-hospedada (`@fontsource/sora` 400/600/700). Proibido Google Fonts por CDN.
- Claro: brand `#5B3FD9`, accent `#FF6B57`, bg `#F7F6FB`, surface `#FFFFFF`, border `#ECE9FB`, text `#1E1B4B`, text-2 `#6B6880`, muted `#A3A0B8`.
- Escuro: bg `#0F1115`, surface `#1A1D24`, surface-2 `#15181E`, border `#2A2E38`, text `#F2F3F5`, text-2 `#8B90A0`, muted `#5E6475`, brand `#8B7BFF`, accent `#FF8A78`, topo `#2A1F6B`.
- Cantos: cards 18px, controles 12px, pills 999px.
- Preferência de aparência em `localStorage['servir.aparencia']` ∈ `auto | claro | escuro`; padrão `auto`.
- Tudo clicável é `<button>`/`<a>` de verdade; botões só com ícone têm `aria-label`.
- Contraste mínimo WCAG AA em claro e escuro.
- Testar sempre no Supabase local (`npm run dev` com `.env.development.local`), em 375px e ≥1024px, claro e escuro.
- Copy em português, frases curtas, sem "por favor", sem "com sucesso".

## Review Focus
1. **Usuário sem escalas e/ou sem departamentos** (cadastro recém-feito): Início, Escalas e Departamento mostram estado vazio útil, nunca tela branca ou erro. → testado em Tasks 9, 10, 11.
2. **`localStorage` bloqueado (aba anônima/iOS)**: aparência cai para `auto` sem quebrar o app. → teste em Task 1.
3. **Primeira pintura no escuro**: abrir o app com celular no escuro não pisca branco. → verificação em Task 2.
4. **Barra fixa de baixo (iPhone)**: `BottomNav` respeita `safe-area-inset-bottom` e não cobre os botões fixos da escala nem o último item das listas. → verificação em Tasks 6 e 12.
5. **Telas da fase 3 no modo escuro**: continuam claras e legíveis dentro do invólucro `TemaClaroForcado`. → verificação em Task 6.

---

## File Structure
- `src/theme/aparencia.js` — preferência e aplicação do tema (puro + DOM).
- `src/theme/deptCores.js` — slug e classes de cor por departamento.
- `src/index.css` — tokens claro/escuro, cores de departamento, base.
- `tailwind.config.js` — `darkMode: 'class'`, cores por variável, fonte Sora.
- `index.html` — script anti-piscada, `theme-color`.
- `src/components/ui/` — `Button.jsx`, `Card.jsx`, `Pill.jsx`, `ListRow.jsx`, `Input.jsx`, `Select.jsx`, `Sheet.jsx`, `TopBar.jsx`, `Logo.jsx`, `EmptyState.jsx`, `index.js`.
- `src/components/shell/` — `AppShell.jsx`, `BottomNav.jsx`, `TemaClaroForcado.jsx`.
- `src/hooks/useNotificacoes.js` — notificações (extraído de `GlobalUserMenu`).
- `src/hooks/useAparencia.js` — estado React da aparência.
- `src/utils/escalas.js` — `agruparPorMes`.
- `src/pages/MinhasEscalas.jsx` (rota `/escalas`), `src/pages/Avisos.jsx` (rota `/avisos`).
- Reformadas: `Auth.jsx`, `Hub.jsx`, `Dashboard.jsx`, `ScheduleDetails.jsx`, `Profile.jsx`, `App.jsx`.
- `src/pages/DevUI.jsx` — vitrine das peças, só em `import.meta.env.DEV` (rota `/dev/ui`).

---

### Task 1: Preferência de aparência (lógica + testes)

**Files:**
- Create: `src/theme/aparencia.js`, `src/theme/aparencia.test.js`
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)

**Interfaces:**
- Produces:
  - `CHAVE_APARENCIA = 'servir.aparencia'`
  - `lerPreferencia(storage = globalThis.localStorage): 'auto'|'claro'|'escuro'`
  - `salvarPreferencia(pref, storage = globalThis.localStorage): void`
  - `resolverTema(pref, sistemaEscuro: boolean): 'claro'|'escuro'`
  - `aplicarTema(tema, doc = document): void` — liga/desliga classe `dark` em `doc.documentElement` e ajusta `<meta name="theme-color">` (`#5B3FD9` claro, `#0F1115` escuro).

- [ ] **Step 1: Instalar vitest** — `npm i -D vitest`; adicionar script `test`.
- [ ] **Step 2: Escrever testes que falham** em `aparencia.test.js`:
  - `lerPreferencia` retorna `'auto'` com storage vazio; retorna `'escuro'` quando salvo; retorna `'auto'` para valor inválido (`'azul'`); retorna `'auto'` quando `getItem` lança erro.
  - `salvarPreferencia` não lança quando `setItem` lança erro.
  - `resolverTema('auto', true) === 'escuro'`, `resolverTema('auto', false) === 'claro'`, `resolverTema('claro', true) === 'claro'`, `resolverTema('escuro', false) === 'escuro'`.
- [ ] **Step 3: Rodar** `npm test` → FAIL (módulo não existe).
- [ ] **Step 4: Implementar** `aparencia.js` (try/catch em todo acesso ao storage).
- [ ] **Step 5: Rodar** `npm test` → PASS.
- [ ] **Step 6: Commit** `feat(tema): preferência de aparência claro/escuro`.

### Task 2: Tokens, Tailwind, fonte Sora e anti-piscada

**Files:**
- Modify: `src/index.css`, `tailwind.config.js`, `index.html`, `src/main.jsx`, `package.json` (`@fontsource/sora`)

**Interfaces:**
- Consumes: `CHAVE_APARENCIA`, lógica de `resolverTema` (replicada inline no `index.html`, 6 linhas, sem import).
- Produces: classes Tailwind `bg-bg`, `bg-surface`, `bg-surface-2`, `border-line`, `text-ink`, `text-ink-2`, `text-muted`, `bg-brand`, `text-brand`, `text-on-brand`, `bg-accent`, `text-accent`, `bg-topo`, `text-danger|success|warning` + `bg-*-soft`; `font-sans` = Sora; `rounded-card` (18px), `rounded-ctl` (12px).

- [ ] **Step 1:** `npm i @fontsource/sora`; importar `400.css`, `600.css`, `700.css` em `main.jsx`.
- [ ] **Step 2:** Em `index.css`, declarar as variáveis RGB (`--brand: 91 63 217` etc.) em `:root` e `.dark` com os valores das Global Constraints; `topo` claro = brand, escuro = `#2A1F6B`; danger/success/warning: claro `#B42318/#1F7A5A/#8A5A00` com soft `#FEE4E2/#E3F6EF/#FFF4DB`, escuro `#FDA29B/#7FE0BC/#FCD34D` com soft `#3A1E1E/#16332A/#3A2F14`. `body { background: rgb(var(--bg)); color: rgb(var(--ink)); font-family: Sora… }`.
- [ ] **Step 3:** `tailwind.config.js`: `darkMode: 'class'`; cores no formato `rgb(var(--x) / <alpha-value>)`; manter `dept.*` antigos para telas não reformadas.
- [ ] **Step 4:** `index.html`: script inline no `<head>` antes do CSS que lê `servir.aparencia` (try/catch), resolve com `matchMedia('(prefers-color-scheme: dark)')` e adiciona `dark` ao `<html>`; `theme-color` inicial `#5B3FD9`.
- [ ] **Step 5: Verificar** `npm run build` → sem erros; no navegador com `localStorage['servir.aparencia']='escuro'` e recarga, `getComputedStyle(document.body).backgroundColor === 'rgb(15, 17, 21)'` já no primeiro frame (gravar com o painel de performance ou checar via `document.documentElement.classList.contains('dark')` antes do React montar); `getComputedStyle(document.body).fontFamily` começa com `Sora`.
- [ ] **Step 6: Commit** `feat(tema): tokens claro/escuro, Sora e anti-piscada`.

### Task 3: Cores por departamento

**Files:**
- Create: `src/theme/deptCores.js`, `src/theme/deptCores.test.js`
- Modify: `src/index.css` (variáveis `--dept-<slug>-bg/fg` claro e escuro), `tailwind.config.js` (safelist das classes `bg-dept-*-bg`, `text-dept-*-fg`)

**Interfaces:**
- Produces:
  - `slugDept(nome: string): 'louvor'|'midia'|'infantil'|'diaconia'|'cantina'|'ministros'|'outro'` — minúsculo, sem acento; desconhecido → `'outro'`.
  - `classesDept(nome: string): { chip: string, icone: string }` — ex. `{ chip: 'bg-dept-louvor-bg text-dept-louvor-fg', icone: 'text-dept-louvor-fg' }`.
  - `IconeDept({ nome, className })` — componente com o ícone lucide atual de cada departamento (`LayoutGrid` para `outro`).
- Valores (claro bg/fg · escuro bg/fg): louvor `#EEEAFE/#3B2A9E · #2A2350/#C4BBFF`; midia `#FFEDEA/#B23A2B · #3A211D/#FFA799`; infantil `#E3F6EF/#1F7A5A · #16332A/#7FE0BC`; diaconia `#FFF4DB/#8A5A00 · #3A2F14/#FCD34D`; cantina `#FFEBD9/#9A4A00 · #3A2614/#FDBA74`; ministros `#FBE7EE/#8C2346 · #3A1A26/#F9A8C4`; outro `#F1EFF8/#4B4766 · #23232B/#C9C6D9`.

- [ ] **Step 1: Testes que falham:** `slugDept('Mídia') === 'midia'`, `slugDept('Midia') === 'midia'`, `slugDept('LOUVOR') === 'louvor'`, `slugDept('Recepção') === 'outro'`, `slugDept('') === 'outro'`, `slugDept(undefined) === 'outro'`; `classesDept('Louvor').chip === 'bg-dept-louvor-bg text-dept-louvor-fg'`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `deptCores.js` + variáveis CSS + safelist. `getDeptTheme` antigo fica intacto (usado pelas telas da fase 3).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(tema): cores de departamento claro/escuro`.

### Task 4: Peças de UI + logo + vitrine

**Files:**
- Create: `src/components/ui/{Button,Card,Pill,ListRow,Input,Select,Sheet,TopBar,Logo,EmptyState}.jsx`, `src/components/ui/index.js`, `src/pages/DevUI.jsx`
- Modify: `src/App.jsx` (rota `/dev/ui` só quando `import.meta.env.DEV`)

**Interfaces:**
- Consumes: classes da Task 2; `classesDept`, `IconeDept` da Task 3.
- Produces (todas exportadas por `ui/index.js`):
  - `Button({ variant='primario'|'secundario'|'fantasma'|'perigo', size='md'|'sm', icon, loading, full, ...buttonProps })` — `type="button"` por padrão; `loading` mostra spinner e mantém largura.
  - `Card({ as='div', padded=true, className, children })` — `bg-surface border border-line rounded-card`.
  - `Pill({ tom='neutro'|'brand'|'sucesso'|'aviso'|'perigo'|'dept', dept, children })`.
  - `ListRow({ titulo, subtitulo, direita, onClick, href, icon })` — renderiza `<button>`/`<Link>` quando clicável, `<div>` senão.
  - `Input({ label, icon, erro, ...inputProps })`, `Select({ label, erro, options: {value,label}[], ...selectProps })` — `label` sempre ligado ao campo (`htmlFor`/`id` com `useId`).
  - `Sheet({ aberto, onFechar, titulo, children })` — painel inferior; fecha com Esc e clique no fundo; foco vai para dentro ao abrir.
  - `TopBar({ titulo, subtitulo, onVoltar, acoes, variante='simples'|'destaque' })` — `destaque` = fundo `bg-topo` com texto branco; botão voltar com `aria-label="Voltar"`.
  - `Logo({ variante='cor'|'branco', className })` — `/logo.png`; `branco` aplica `brightness(0) invert(1)`.
  - `EmptyState({ icon, titulo, texto, acao })`.

- [ ] **Step 1:** Implementar as peças.
- [ ] **Step 2:** `DevUI.jsx` mostra todas as variantes + um seletor claro/escuro (chama `aplicarTema`).
- [ ] **Step 3: Verificar** em `/dev/ui` a 375px e 1024px, claro e escuro: nada transborda; `Tab` percorre todos os controles com anel de foco visível; `Sheet` fecha com Esc; leitor de tela (read_page) mostra nomes em todos os botões.
- [ ] **Step 4:** `npm run build` → `/dev/ui` ausente do bundle de produção (`grep -r DevUI dist/` vazio).
- [ ] **Step 5: Commit** `feat(ui): peças compartilhadas e vitrine /dev/ui`.

### Task 5: Hooks de aparência e notificações

**Files:**
- Create: `src/hooks/useAparencia.js`, `src/hooks/useNotificacoes.js`
- Modify: `src/components/GlobalUserMenu.jsx` (passa a usar `useNotificacoes`; removido na Task 6)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `useAparencia(): { preferencia, tema, setPreferencia(pref) }` — escuta `matchMedia` quando `auto`; chama `aplicarTema` e `salvarPreferencia`.
  - `useNotificacoes(): { notificacoes, naoLidas, carregando, abrir(notif), apagar(id), marcarTodasLidas(), recarregar() }` — mesmas consultas de hoje em `GlobalUserMenu` (limite 20, ordem desc); `abrir` marca como lida e retorna o destino (`notif.link` ou equivalente usado hoje).

- [ ] **Step 1:** Extrair a lógica de notificações sem mudar consultas; `GlobalUserMenu` passa a consumir o hook.
- [ ] **Step 2: Verificar** no navegador: sino continua mostrando contagem e lista; marcar todas como lidas zera a contagem; trocar o tema do sistema com `preferencia='auto'` alterna `dark` em tempo real.
- [ ] **Step 3: Commit** `refactor: hooks useAparencia e useNotificacoes`.

### Task 6: AppShell, menu fixo e invólucro de tema claro

**Files:**
- Create: `src/components/shell/{AppShell,BottomNav,TemaClaroForcado}.jsx`, `src/pages/MinhasEscalas.jsx` e `src/pages/Avisos.jsx` (placeholders com `EmptyState`, preenchidos nas Tasks 10 e 13)
- Modify: `src/App.jsx` (rotas `/escalas`, `/avisos`; envolver rotas logadas com `AppShell`; remover `<GlobalUserMenu />`), `src/main.jsx` ou `App.jsx` (chamar `useAparencia` uma vez na raiz)

**Interfaces:**
- Consumes: Tasks 4 e 5.
- Produces:
  - `AppShell({ children })` — mobile: conteúdo + `BottomNav`; ≥768px: barra lateral esquerda com as mesmas abas e conteúdo centralizado `max-w-[720px]`. Esconde o menu nas rotas `ROTAS_FOCO = ['/gerar-escala', '/checkin', '/imprimir-escalas', '/cabine']` (prefixo).
  - `BottomNav` — abas Início `/hub` (Home), Escalas `/escalas` (CalendarDays), Avisos `/avisos` (Bell, com contador de `naoLidas`), Perfil `/perfil` (User); aba ativa por prefixo da rota; `padding-bottom: env(safe-area-inset-bottom)`; `<nav aria-label="Navegação principal">`.
  - `TemaClaroForcado({ children })` — redefine as variáveis para os valores claros e `color-scheme: light` no seu escopo. Envolve **todas as rotas que ainda não foram reformadas** (lista explícita `ROTAS_LEGADO` em `App.jsx`: tudo exceto `/`, `/hub`, `/escalas`, `/avisos`, `/perfil`, `/dashboard`, `/escala/:id`).
  - Espaço reservado no fim do conteúdo = altura do menu + safe area (classe `pb-nav`).

- [ ] **Step 1:** Implementar shell, menu e invólucro; ajustar rotas.
- [ ] **Step 2: Verificar** (375px e 1024px, claro e escuro):
  - menu aparece logado, some em `/` e nas rotas de foco;
  - aba ativa correta ao navegar; contador de avisos bate com o banco local;
  - no escuro, `/equipe`, `/louvores`, `/cantina` e `/gestao-igreja` continuam claras e legíveis (fundo branco, texto escuro);
  - último item de uma lista longa não fica atrás do menu;
  - nenhum botão flutuante antigo (`GlobalUserMenu`) na tela.
- [ ] **Step 3: Commit** `feat(shell): menu fixo, barra lateral e invólucro de tema claro`.

### Task 7: Perfil (aparência + sair)

**Files:** Modify `src/pages/Profile.jsx`

**Interfaces:** Consumes `useAparencia`, peças `ui/`.

- [ ] **Step 1:** Reestilizar com `TopBar`, `Card`, `Input`, `Button`; adicionar seção **Aparência** com controle segmentado `Automático | Claro | Escuro` (`role="radiogroup"`); botão **Sair** (`variant="perigo"`) que faz `supabase.auth.signOut()` e vai para `/`. Lógica de salvar perfil e trocar senha intacta.
- [ ] **Step 2: Verificar:** trocar para Escuro aplica na hora e persiste após recarga; Automático segue o sistema; salvar perfil e validações (nome vazio, senhas diferentes) continuam funcionando; Sair volta ao login.
- [ ] **Step 3: Commit** `feat(perfil): novo visual, aparência e sair`.

### Task 8: Login e cadastro

**Files:** Modify `src/pages/Auth.jsx`

- [ ] **Step 1:** Remover o layout desktop de painel duplo; um único layout (o atual mobile reestilizado) para todas as larguras, centralizado `max-w-sm`. Topo `bg-topo` com `Logo variante="branco"` e "Ser chamado · Vir para cumprir"; card sobreposto com o formulário. Rodapé "Tem um código de convite?" + link **Criar minha conta**. Passo 2 do cadastro (departamentos/funções) com `Pill`/`Button` reais (sem `div` clicável). Handlers, validações e `concluirCadastroPendente` intactos.
- [ ] **Step 2: Verificar** no banco local: login com `admin@teste.local`; erro de senha mostra mensagem; "Esqueceu a senha?" sem e-mail mostra aviso; cadastro completo com convite `TESTE1` cria perfil, departamentos e instrumentos (conferir via psql); tudo navegável só por teclado.
- [ ] **Step 3: Commit** `feat(auth): novo visual de login e cadastro`.

### Task 9: Início (Hub)

**Files:** Modify `src/pages/Hub.jsx`

- [ ] **Step 1:** Nova ordem: `TopBar variante="destaque"` com saudação ("Olá, <primeiro nome>" / "Graça e paz") e sino (vai para `/avisos`, com contador); card **Próxima escala** sobreposto (próxima escala futura do usuário: data · turno · depto · função · botão "Ver detalhes" → `/escala/:id`); **Departamentos** em grade 2 colunas com `IconeDept` + `classesDept`; para admin, abaixo: resumo "Escalas do próximo mês" e atalho **Gestão da igreja**. Calendário grande e carrossel saem do Início. Consultas existentes reaproveitadas.
- [ ] **Step 2: Verificar:** usuário com escalas vê a próxima correta; usuário sem escala vê `EmptyState` ("Você ainda não foi escalado"); usuário sem departamento vê `EmptyState` com orientação; tocar num departamento abre o Dashboard dele (mesmo `state` de hoje); admin vê resumo e atalho, membro não.
- [ ] **Step 3: Commit** `feat(inicio): novo Início com próxima escala e departamentos`.

### Task 10: Aba Escalas

**Files:** Create `src/utils/escalas.js`, `src/utils/escalas.test.js`; Modify `src/pages/MinhasEscalas.jsx`

**Interfaces:**
- Produces: `agruparPorMes(escalas: {data:'YYYY-MM-DD'}[]): { chave:'YYYY-MM', titulo:string, itens:[] }[]` — ordem crescente por data; `titulo` em pt-BR com mês por extenso e ano (ex. `'dezembro de 2026'`); datas tratadas como locais (sem deslocamento de fuso).

- [ ] **Step 1: Testes que falham:** escalas de `2026-12-03`, `2026-11-20`, `2026-12-01` → 2 grupos, primeiro `chave '2026-11'`, segundo com itens em ordem `01, 03`; `titulo` do grupo `2026-12` é `'dezembro de 2026'`; lista vazia → `[]`; `2026-12-01` não vira novembro (fuso).
- [ ] **Step 2:** `npm test` → FAIL; implementar; `npm test` → PASS.
- [ ] **Step 3:** Tela: seletor `Minhas | Que eu lidero` (só aparece para quem é líder/admin em algum depto); **Minhas** = escalas futuras do usuário em todos os departamentos (`schedule_roles` do usuário, status ≠ Rascunho), cada linha com data, turno, `Pill` do depto e função; **Que eu lidero** = escalas futuras dos departamentos onde é líder/admin, com `Pill` de status. Linha leva a `/escala/:id`. Vazio → `EmptyState`.
- [ ] **Step 4: Verificar** no banco local com Admin (líder) e Bruno (membro): Bruno não vê o seletor; contagens batem com psql.
- [ ] **Step 5: Commit** `feat(escalas): aba Minhas escalas`.

### Task 11: Departamento (Dashboard)

**Files:** Modify `src/pages/Dashboard.jsx`

- [ ] **Step 1:** `TopBar` com `IconeDept`, nome e papel ("Você é líder"/"Membro"). Líder/admin: botões **Gerar mês** (primário) e **Equipe** (secundário) + botão "⋯" que abre `Sheet` com as demais ações de hoje (Dias off, Bloquear, Músicas, Frequência, Trocas, Aviso, Lições, Check-in, PDF, Publicar tudo — só as que já aparecem para aquele depto/papel). Membro: **Dias off** e **Trocas**. Depois: lista do mês com `ListRow` (data · turno · `Pill` Publicada/Rascunho), navegação de mês; alerta de trocas pendentes; mural de avisos. Calendário grande sai.
- [ ] **Step 2: Verificar:** cada ação do `Sheet` leva à mesma tela de antes (mesmo `state`); Cantina e Ministros continuam abrindo `/cantina` e `/ministros` no "Gerar"; "Publicar tudo" continua pedindo confirmação; depto sem escalas mostra `EmptyState`.
- [ ] **Step 3: Commit** `feat(departamento): ações no topo e lista de escalas`.

### Task 12: Detalhes da escala

**Files:** Modify `src/pages/ScheduleDetails.jsx`

- [ ] **Step 1:** Cabeçalho `bg-topo`: depto · tipo de culto, data por extenso, `Pill`s de ensaio e roupa. Seções em `Card`: Equipe (`ListRow` nome/função), Repertório (status + lista), Mapa vocal, Observações, Ações do líder. Botões só-ícone ganham `aria-label` (adicionar música: "Adicionar música"). Barra fixa inferior com **Pedir troca** para membros escalados, posicionada acima do `BottomNav` + safe area. Lógica intacta.
- [ ] **Step 2: Verificar:** adicionar membro, bloquear duplicado, adicionar música, aprovar repertório e pedir troca funcionam como antes; barra fixa não cobre conteúdo nem o menu (375px); escuro legível.
- [ ] **Step 3: Commit** `feat(escala): novo visual dos detalhes da escala`.

### Task 13: Aba Avisos

**Files:** Modify `src/pages/Avisos.jsx`

- [ ] **Step 1:** Duas seções: **Notificações** (de `useNotificacoes`: lista, "Marcar todas como lidas", tocar abre o destino, apagar) e **Mural** (avisos ativos dos departamentos do usuário, reaproveitando a consulta de `NoticeBoard.jsx`). Vazio → `EmptyState`.
- [ ] **Step 2: Verificar:** contador do menu zera ao marcar todas; tocar numa notificação de escala abre a escala; aviso criado em `/criar-aviso` aparece no mural de quem é do depto e não aparece para quem não é.
- [ ] **Step 3: Commit** `feat(avisos): aba de notificações e mural`.

### Task 14: Verificação final da fase

- [ ] **Step 1:** `npm test` → todos PASS; `npm run build` → sem erros; `npx eslint` nos arquivos tocados sem erros novos.
- [ ] **Step 2:** Percorrer no navegador (banco local), 375px e 1024px, claro e escuro: login → Início → departamento → escala → Escalas → Avisos → Perfil; e as 5 linhas do Review Focus.
- [ ] **Step 3:** Tirar prints das 7 telas (claro e escuro) e enviar ao Fernando.
- [ ] **Step 4: Commit** final se houver ajustes.

---

**Fase 3** (Equipe, Gerar escala, Músicas, Dias off, Trocas, Check-in, Cantina, Ministros, Gestão, Painel do Dono, Criar igreja, demais): plano próprio depois desta fase, uma tela por tarefa, removendo cada rota de `ROTAS_LEGADO` ao reformá-la.
