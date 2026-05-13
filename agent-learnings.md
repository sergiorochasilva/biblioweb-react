# Agent Learnings

Base de memoria incremental para reduzir retrabalho entre agentes e interacoes.

## Modelo de entrada

```md
### YYYY-MM-DD - <contexto/task>
- Descoberta:
- Evidencias:
  - <arquivo/caminho>
- Acao aplicada:
- Impacto esperado:
```

## Entradas

<!-- Adicione entradas novas no topo desta secao. -->

### 2026-05-12 - book html_version_url propagated across details and admin forms
- Descoberta:
  - The book details flow needs `html_version_url` in the `fields` list and in the book model so the web-version button can open the stored public URL.
  - The admin and publisher admin book modals need the same field so manual maintenance stays possible when the HTML mirror changes.
- Evidencias:
  - src/service/BookService.ts
  - src/model/Book.ts
  - src/view/BookDetailsView.tsx
  - src/view/BookDetailsWrapper.tsx
  - src/controller/AdminController.ts
  - src/controller/PublisherAdminController.ts
  - src/view/AdminView.tsx
  - src/view/PublisherAdminView.tsx
- Acao aplicada:
  - Added `html_version_url` to the shared book model and the detail page request fields.
  - Added the `Ler Versão Web` action for external/free books and exposed a manual `URL Versão HTML` input in both admin modals.
- Impacto esperado:
  - The public detail page and both admin UIs stay aligned with the new HTML mirror pipeline without requiring a separate data path.

### 2026-05-01 - login alternativo por senha coexistindo com login por e-mail
- Descoberta:
  - O endpoint `/token` já aceita `type: "credentials"` com `credentials.email` e `credentials.password`, então o front pode oferecer um segundo caminho sem mexer no backend.
  - Para manter `next` e o empréstimo pendente, o fluxo por senha precisa compartilhar a mesma recuperação pós-login do fluxo por código.
- Evidencias:
  - src/view/LoginView.tsx
  - src/view/PasswordLoginView.tsx
  - src/view/CodeVerificationView.tsx
  - src/contexts/AuthContext.tsx
  - src/service/postLoginAction.ts
  - README.md
  - AGENTS.md
- Acao aplicada:
  - Adicionada a rota pública `"/login-password"` com título e textos dedicados ao login por senha.
  - O formulário inicial ganhou o botão secundário `Entrar com senha`, que reaproveita o e-mail informado antes de navegar para a nova tela.
  - O pós-login passou a reutilizar um helper compartilhado para concluir empréstimos pendentes e respeitar `next`.
- Impacto esperado:
  - Login por código e por senha coexistem sem duplicar regra de pós-login e sem quebrar retorno ao contexto anterior.

### 2026-04-28 - manual de leitura com entrada unica e deteccao de ambiente
- Descoberta:
  - O manual de leitura fica mais util como ponto de entrada unico, desde que detecte o ambiente automaticamente e permita override manual quando a heuristica falhar.
  - A versão estática publicada em `public/` pode concentrar todos os fluxos sem depender de subpáginas separadas por SO.
- Evidencias:
  - public/pos-download/manual.html
- Acao aplicada:
  - `manual.html` passou a detectar `windows`, `linux`, `mac`, `android` e `ios` via `navigator.userAgent`, `navigator.platform` e `userAgentData`, com fallback de seleção manual.
  - O conteúdo visível é trocado no próprio ponto de entrada, sem precisar publicar múltiplos HTMLs.
- Impacto esperado:
  - Menos superfície estática para manter e menor chance de link quebrado entre páginas auxiliares de ajuda.
