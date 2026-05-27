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

### 2026-05-26 - book detail fetch must be single-shot with optional token
- Descoberta:
  - A página de detalhe deve fazer uma única chamada por carregamento: com `access_token` quando houver sessão válida, ou sem token quando não houver.
  - O front não deve “insistir” com fallback após uma falha autenticada; se a API falhar, o erro deve refletir o estado real.
- Evidencias:
  - src/service/BookService.ts
  - src/view/BookDetailsWrapper.tsx
- Acao aplicada:
  - Removi o retry sem token do fetch de detalhe.
  - Mantive apenas a chamada única, parametrizada pelo token disponível no contexto.
- Impacto esperado:
  - Comportamento previsível e alinhado ao contrato do backend, sem mascarar falhas de autenticação/consulta com um fallback no front.

### 2026-05-25 - detail page accepts wrapped book payloads and falls back to public fetch
- Descoberta:
  - A página de detalhes não deve assumir que `GET /libraries_books/<id>` sempre retorna o livro em objeto plano; em alguns fluxos o backend pode envelopar o payload em `result`.
  - O detalhe deve continuar funcionando com e sem sessão, mas a escolha de chamar com token ou sem token deve acontecer uma única vez, sem retry no front.
- Evidencias:
  - src/service/BookService.ts
  - src/view/BookDetailsWrapper.tsx
- Acao aplicada:
  - A normalização do detalhe passou a aceitar `result` como envelope de um único livro.
  - A busca do detalhe usa apenas o token disponível no momento da chamada e não repete a consulta com fallback.
- Impacto esperado:
  - Menos comportamento implícito no front e um contrato mais claro entre o detalhe público/autenticado e o backend.

### 2026-05-23 - book libraries treated as relational links end-to-end in admin forms
- Descoberta:
  - O contrato de livros no front ficou mais consistente quando `libraries` deixou de ser tratado como lista de IDs e passou a circular como vínculo de acervo completo, tanto na listagem quanto nos modais de Admin e Publisher Admin.
  - O seletor em grade continua útil, mas ele deve derivar apenas os IDs visíveis a partir do estado relacional, sem voltar a ser a fonte do dado.
- Evidencias:
  - src/model/Book.ts
  - src/model/BookLibrary.ts
  - src/service/AdminService.ts
  - src/service/PublisherAdminService.ts
  - src/controller/AdminController.ts
  - src/controller/PublisherAdminController.ts
  - src/view/AdminView.tsx
  - src/view/PublisherAdminView.tsx
- Acao aplicada:
  - Atualizei os modelos e services para normalizar `libraries` como vínculos `book x acervo`.
  - O Admin passou a sincronizar seleção e política dos vínculos no próprio estado do formulário.
  - O Publisher Admin passou a usar o mesmo vínculo relacional no fluxo de criação/edição.
- Impacto esperado:
  - Menos conversões soltas entre `number[]` e `string[]`, maior alinhamento com o backend e um contrato único para manter o livro no contexto do acervo.

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

### 2026-05-27 - admin book edit needs library when loading book-library links
- Descoberta:
  - O fallback de edição de livros no Admin e no Publisher Admin ainda podia chamar `/libraries_books?id=...` sem `library`, o que quebra o `ListRoute` do backend com 400.
  - O vínculo de `book_library` precisa do acervo para ser listado/resolveido com segurança, mesmo quando o livro detalhado não traz os vínculos completos.
- Evidencias:
  - src/service/AdminService.ts
  - src/service/PublisherAdminService.ts
  - src/controller/AdminController.ts
  - src/controller/PublisherAdminController.ts
- Acao aplicada:
  - A busca de vínculos passou a receber `libraryId` explícito.
  - O modal de edição do Admin agora deriva o acervo do livro/lista/filtro antes de tentar recarregar os vínculos.
  - O Publisher Admin só consulta vínculos quando já existe um acervo resolvido.
- Impacto esperado:
  - A tela administrativa deixa de gerar 400 por falta de `library` ao abrir edições de livro, e o mesmo contrato fica protegido no fluxo da editora.

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

### 2026-05-27 - lendBook should surface backend error messages
- Descoberta:
  - O backend já devolve o motivo real da falha de empréstimo (por exemplo, limite atingido), mas o front estava sobrescrevendo isso com uma mensagem genérica ao detectar `response.ok === false`.
  - A resposta de erro pode vir como objeto ou como lista com um item contendo `message`.
- Evidencias:
  - src/service/BookService.ts
  - src/view/BookDetailsView.tsx
- Acao aplicada:
  - `lendBook()` passou a ler o corpo da resposta e extrair `message` de objeto ou de lista antes de lançar o erro.
- Impacto esperado:
  - O usuário passa a ver a razão real da falha de empréstimo, como limite excedido ou licença indisponível, em vez do toast genérico.

### 2026-05-27 - admin book enrichment must carry the active library
- Contexto: listagem de livros do Admin ao enriquecer vínculos de acervo.
- Descoberta:
  - A função que enriquece os livros com `libraries` estava consultando `/libraries_books` sem o parâmetro `library`, mas o backend passou a exigir esse particionamento.
  - Mesmo com o filtro de acervo visível na UI, o passo de enriquecimento ainda precisava receber o `library` explicitamente.
- Evidencias:
  - `src/service/AdminService.ts`
  - `src/controller/AdminController.ts`
- Acao aplicada:
  - A rotina de enriquecimento passou a receber o `library` do filtro atual e também o extrai do `next` quando necessário.
- Impacto esperado:
  - A aba de livros do Admin deixa de gerar `400 Missing parameter: library` ao carregar os vínculos de acervo.

### 2026-05-26 - book policy must be edited per library and accumulated uses are read-only
- Contexto: modal de cadastro/edição de livros no Admin e no Publisher Admin.
- Descoberta:
  - Os campos `available_licenses` e `max_uses_per_license` não representam uma política global do livro, e sim política por vínculo livro x acervo.
  - `license_uses_count` é contador de estado, então não deve ser editável pelo usuário.
- Evidencias:
  - `src/controller/AdminController.ts`
  - `src/controller/PublisherAdminController.ts`
  - `src/view/AdminView.tsx`
  - `src/view/PublisherAdminView.tsx`
  - `src/components/BookLibraryPolicyGrid.tsx`
- Acao aplicada:
  - Removi os campos globais do formulário de livro e passei a editar a política dentro de cada acervo selecionado.
  - `license_uses_count` virou somente leitura na UI, mantendo o valor apenas como contexto do vínculo.
- Impacto esperado:
  - O cadastro de livro deixa de sugerir uma política única para todos os acervos e passa a refletir o contrato por biblioteca.
