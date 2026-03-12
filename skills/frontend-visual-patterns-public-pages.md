# Skill: frontend-visual-patterns-public-pages

## Quando usar
Use esta skill para criar ou ajustar telas publicas (home, busca, detalhes, login e selecao).

## Objetivo
Manter consistencia visual do front-end com o tema atual (glass + azul), tipografia e comportamento responsivo.

## Tokens e base visual
Fonte e identidade atual estao em `src/styles/global.css`:
- Fontes:
  - Corpo: `Manrope`
  - Titulos: `Sora`
- Cores principais:
  - `--text-strong`, `--text-muted`
  - `--accent` (azul)
- Superficie:
  - `--glass-bg`, `--glass-border`, `--glass-shadow`
  - `--glass-input-bg`

## Regras de UI
1. Use `page-shell`, `page-content`, `page-section` como estrutura padrao.
2. Para blocos principais, use `glass-panel` ou `glass-card`.
3. Inputs/selects e botoes devem preservar estilo de `global.css`.
4. Titulos de secao devem usar `section-title`.
5. Evite criar novas variaveis CSS sem necessidade; reutilize as ja existentes.
6. Preserve comportamento mobile em `@media (max-width: 720px)`.
7. Nao introduza tema paralelo (novas paletas conflitantes, tipografia divergente).

## Regras de composicao por tela
- Header:
  - Reutilizar `glass-header`, `header-inner`, `logo-image`.
- Home/carrossel:
  - Reutilizar `carousel-shell`, `book-carousel`, `book-card`.
- Busca:
  - Reutilizar grid/lista consistente com cards de livro.
- Detalhes:
  - Reutilizar `details-hero`, `details-card`, `book-details-*`.
- Login/verify/selection:
  - Reutilizar `AuthLayout` e classes `auth-*`.

## Antipadroes
- Hardcode de cor/fonte em cada componente.
- Uso de layout totalmente diferente entre telas publicas.
- Duplicar CSS existente com nomes diferentes para o mesmo papel.

## Validacao minima
- `npm run build`
- Revisao visual manual:
  - desktop e mobile
  - contraste e legibilidade
  - consistencia entre home/busca/detalhes/login/selecao

## Criterios de pronto
- UI nova/alterada segue o tema atual sem quebra de identidade.
- Nenhuma regressao visual evidente nas telas publicas.
