# Reforma visual do SerVir — design

Data: 2026-11-14 · Status: aguardando aprovação do Fernando

## Intenção
O Fernando acha o app "sem identidade" e um pouco difícil de navegar. Quer um visual
moderno, com tipografia própria, e telas mais organizadas — sem mudar o que o app faz.
A reforma também prepara o terreno para os departamentos modulares (ver
`2026-11-13-departamentos-modulares-ideia.md`), que virão depois.

## Objetivos
- Identidade única e consistente em todas as telas (tema **Vibrante**).
- **Modo escuro** opcional (variante **A · escuro roxo**).
- Navegação mais curta: **menu fixo embaixo** e as coisas mais usadas no topo de cada tela.
- Peças visuais compartilhadas, para que mudanças futuras de visual sejam feitas num lugar só.

## Fora do escopo (não fazer agora)
- Departamentos modulares / funções e cultos configuráveis.
- **Confirmar presença** na escala (Fernando gostou, mas fica para depois).
- Mudanças em regras de negócio, banco de dados ou edge functions.

## Anti-objetivos (seria fracasso mesmo "funcionando")
- Perder qualquer funcionalidade existente ou mudar o comportamento de um fluxo.
- Telas no meio do caminho com metade do visual antigo e metade do novo **dentro da mesma tela**.
- Texto ilegível no modo escuro (contraste abaixo de WCAG AA).
- App que só funciona online por causa da fonte (é PWA).

## Restrições
- Stack atual: React 19, Vite 7, Tailwind 3.4, react-router 7, lucide-react, vite-plugin-pwa.
- Mobile primeiro (a maioria usa no celular); deve continuar bom no desktop.
- Cerca de 25 telas e 11 mil linhas; a reforma é por partes, com o app sempre funcionando.
- Testar no Supabase local (nada de testar em produção).

## Abordagens consideradas
- **A) Base visual nova + reforma por partes** — *escolhida pelo Fernando.* Primeiro a
  identidade e as peças compartilhadas; depois as telas mais usadas; depois o resto.
  Resultado visível cedo e app nunca quebrado.
- B) Só trocar fonte e cores no app todo — rápido, mas não resolve organização nem
  inconsistência entre telas.
- C) Refazer o front do zero com biblioteca de componentes — arriscado para 11 mil linhas
  e seria refeito de novo com os departamentos modulares.

## Decisões do Fernando
1. Tema claro **Vibrante**: fonte **Sora**; roxo da marca `#5B3FD9`; coral `#FF6B57` como
   destaque secundário; superfícies brancas; cards com borda suave `#ECE9FB`, cantos 18px.
2. Modo escuro **A · escuro roxo**: fundo `#0F1115`, cards `#1A1D24` com borda `#2A2E38`,
   roxo clareado `#8B7BFF` como destaque, coral clareado `#FF8A78`, topo `#2A1F6B`.
3. **Menu fixo embaixo** com 4 abas: Início, Escalas, Avisos, Perfil.
4. Aba **Escalas** = "minhas escalas" de todos os departamentos, numa lista só por data.
5. Organização das telas conforme os mockups aprovados (abaixo).
6. Confirmar presença: **não** entra agora.
7. **Logo**: criar uma versão branca (monocromática) do logo atual para usar sobre o roxo e
   no modo escuro; o logo colorido atual continua em fundos claros.

## Telas (organização aprovada)

### Início (Hub)
```
┌ topo roxo: "Olá, <nome>" / "Graça e paz"      [sino] [avatar]
├ card "Próxima escala" sobreposto ao topo: data · turno · depto · função · [Ver detalhes]
├ Departamentos: grade 2 colunas, chip colorido por depto (ícone + nome)
├ (admin) atalho "Gestão da igreja"
└ menu fixo
```
O calendário grande sai do Início (vai para a aba Escalas, compacto).
**Minha decisão:** para admins, o resumo "Escalas do próximo mês" (status por departamento)
e o atalho de Administração ficam no Início, abaixo dos departamentos.

### Escalas (nova aba)
Lista por data de todas as escalas do usuário (todos os departamentos), agrupada por mês,
com chip do departamento e função. Calendário compacto opcional no topo.
**Minha decisão:** líderes veem um seletor no topo `Minhas | Que eu lidero`; "Que eu lidero"
lista as escalas dos departamentos onde é líder/admin, com status (Publicada/Rascunho).

### Avisos (aba)
**Minha decisão:** reúne as notificações (hoje no sino do `GlobalUserMenu`) e o mural de
avisos dos departamentos do usuário. O sino no topo continua, levando para esta aba.

### Perfil (aba)
Tela de Perfil atual com o novo visual + seção **Aparência**: `Automático | Claro | Escuro`.
Sair da conta fica aqui (hoje está no menu do avatar).

### Login
Um formulário por vez (sai o painel duplo deslizante do desktop). Topo roxo com o logo,
card de login sobreposto, link no rodapé "Tem um código de convite? Criar minha conta".
O cadastro em 2 passos continua igual em lógica.

### Departamento (Dashboard)
```
[←] [ícone] Louvor · "Você é líder"
[Gerar mês] [Equipe] [⋯]        ← ações principais do líder; resto no ⋯
Lista de escalas do mês com status   (substitui o calendário grande)
Alerta de pedidos de troca pendentes
```
Membro comum vê no topo: `Dias off` e `Trocas`.

### Detalhes da escala
Cabeçalho roxo com depto · tipo de culto · data, chips de ensaio e roupa.
Depois: Equipe, Repertório (status), mapa vocal, observações.
Ações do membro fixas embaixo: **Pedir troca**. Ações do líder continuam na tela.

## Base técnica (minhas decisões, ajustáveis pelo builder)
- **Tokens como variáveis CSS** em `src/index.css` (`:root` claro, `.dark` escuro):
  `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-2`, `--muted`,
  `--brand`, `--brand-contrast`, `--accent`, `--danger`, `--success`, `--warning`.
  Tailwind mapeia cores para essas variáveis (`bg-surface`, `text-brand`…), com
  `darkMode: 'class'`.
- **Cores de departamento**: cada departamento tem um par claro/escuro (fundo do chip +
  texto/ícone), definido em `departmentThemes.jsx`, que passa a expor tokens em vez de classes
  `blue-600` soltas. Paleta inicial: Louvor roxo, Mídia coral, Infantil verde, Diaconia âmbar,
  Cantina laranja, Ministros vinho; departamento sem tema usa cinza-lilás.
- **Fonte Sora** auto-hospedada via `@fontsource/sora` (400/600/700) para funcionar offline
  no PWA; não usar Google Fonts por CDN.
- **Modo escuro**: classe `dark` no `<html>`; preferência salva em `localStorage`
  (`auto` segue `prefers-color-scheme`). Aplicar antes da primeira pintura (script no
  `index.html`) para não piscar branco.
- **Peças compartilhadas** em `src/components/ui/`: `Button` (primário/secundário/fantasma),
  `Card`, `PageHeader` (refeito), `BottomNav`, `Pill`/`Badge`, `ListRow`, `Input`, `Select`,
  `Sheet` (painel inferior para o menu ⋯). Todos com elementos acessíveis de verdade
  (`button`, `aria-label` nos só-ícone) — corrige o problema atual de `div` clicável.
- `BottomNav` aparece só logado e esconde em telas de foco (gerar escala, check-in,
  impressão). Respeita a área segura do iPhone (`env(safe-area-inset-bottom)`).
- **Desktop (≥ 768px)** — minha decisão: o menu de baixo vira uma barra lateral esquerda
  com as mesmas 4 abas; conteúdo centralizado com largura máxima ~720px.
- `GlobalUserMenu` (botões flutuantes no topo) é substituído pelo sino + avatar do topo e
  pelas abas Avisos/Perfil.

## Ordem de entrega
1. **Fundação**: tokens claro/escuro, Sora, Tailwind, peças `ui/`, `BottomNav`, seletor de
   aparência. Nenhuma tela muda ainda além do menu.
2. **Telas principais**: Login, Início, nova aba Escalas, Departamento, Detalhes da escala,
   Perfil, Avisos.
3. **Demais telas**, uma por vez (Equipe, Gerar escala, Músicas, Dias off, Trocas, Check-in,
   Cantina, Ministros, Gestão, Painel do Dono…), cada uma inteira de uma vez.

Cada etapa termina com o app funcionando e testado (claro e escuro, 375px e desktop).

## Deixado para quem construir
- Valores exatos de espaçamento, tamanhos de fonte e sombras, seguindo os mockups.
- Ícones de cada aba e de cada departamento (lucide-react).
- Microanimações (curtas e discretas).
- Estados vazios e carregamento (skeletons) no novo visual.
