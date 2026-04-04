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

### 2026-04-04 - campos opcionais de livro com `null` + validacao em lote
- Descoberta:
  - Campos com `min=1` e sem `not_null=True` no DTO (ex.: `year`) devem ser enviados como `null` quando vazios; enviar `""` gera erro de validação no backend.
  - Validação que retorna no primeiro erro aumenta retrabalho no modal, porque o usuário corrige um campo por vez.
- Evidencias:
  - src/controller/AdminController.ts
  - src/service/AdminService.ts
  - src/view/AdminView.tsx
  - /home/sergio/@pessoal/biblioweb-api/fronesis/dto/book_post_dto.py
- Acao aplicada:
  - Payload de salvar livro agora converte campos vazios para `null` antes do `POST/PUT`.
  - `year` deixou de ser obrigatório no frontend.
  - Validação de livros e usuários passou a agregar todos os erros obrigatórios de uma vez e destacar todos os campos simultaneamente.
- Impacto esperado:
  - Menos erro de contrato com backend por `""` em campo opcional e UX de correção mais rápida no modal.

### 2026-04-03 - IDs de livro devem ser usados sem mutacao
- Descoberta:
  - Heuristica de alterar formato do ID (ex.: prefixar/remover `0`) aumenta ambiguidade e pode induzir `NOT FOUND` em `/books/:id`.
- Evidencias:
  - src/service/AdminService.ts
  - src/controller/AdminController.ts
  - src/view/AdminView.tsx
- Acao aplicada:
  - Resolucao de ID foi simplificada para usar apenas valores recebidos da API (`book_id`, `id`, `book`) sem transformar o conteúdo.
  - Fluxos de editar/remover passaram a priorizar `book_id` quando disponível.
- Impacto esperado:
  - Comportamento previsivel e alinhado ao contrato da API, reduzindo erros introduzidos por heuristica no frontend.

### 2026-04-03 - fallback de id com `libraries_books` no editar livro
- Descoberta:
  - Alguns itens da listagem administrativa não resolvem direto em `GET /books/:id` (404), pois o identificador disponível pode representar vínculo de `libraries_books` e não o `book_id` canônico.
- Evidencias:
  - src/service/AdminService.ts
  - src/controller/AdminController.ts
- Acao aplicada:
  - `AdminService` passou a tentar múltiplos candidatos de ID brutos recebidos da API (sem mutar formato) em `GET/PUT/DELETE /books/:id`.
  - Adicionado resolver `resolveBookIdByLibraryBookId` consultando `/libraries_books/:id` para extrair `book_id`.
  - `openEditBookModal` agora tenta esse fallback antes de cair no preenchimento com dados da listagem.
- Impacto esperado:
  - Menor incidência de erro "NOT FOUND" ao abrir/editar livros com ID ambíguo no payload da listagem.

### 2026-04-03 - feedback de validacao em modal admin
- Descoberta:
  - Erro global em tela de admin fica oculto atras do modal durante cadastro/edicao, o que reduz clareza para o usuario.
  - Para evitar retrabalho, validacao precisa combinar 3 sinais no modal: toaster, mensagem local e destaque visual de campo.
- Evidencias:
  - src/controller/AdminController.ts
  - src/view/AdminView.tsx
  - src/styles/AdminView.css
- Acao aplicada:
  - Controller passou a manter erros por campo e erro por modal para livros e usuarios.
  - Erros de validacao/API no save agora disparam `message.error` e tambem aparecem dentro do modal.
  - Inputs de admin receberam `status=\"error\"` e estilo de borda discreta/padrao para todos os campos.
- Impacto esperado:
  - Usuario identifica erro imediatamente, sem perder contexto de edicao/cadastro.

### 2026-04-03 - validacao de campos obrigatorios no salvar livro (admin)
- Descoberta:
  - Quando o fallback do modal de edicao usa dados da listagem, campos obrigatórios podem chegar vazios (ex.: `edition`), gerando 400 na API.
- Evidencias:
  - src/controller/AdminController.ts
  - logs da API em `PUT /books/:id` com validacao de `edition` minimo 1
- Acao aplicada:
  - Incluida validacao local de campos obrigatorios antes de salvar livro (titulo, autor, editora, edicao e URL para tipo externo).
  - Payload de save agora é enviado com `trim()` para evitar strings apenas com espaços.
- Impacto esperado:
  - Menos round-trip com erro 400 e feedback imediato para o usuario na tela de administracao.

### 2026-04-03 - aba contextual no admin global
- Descoberta:
  - A UX do admin ficou mais previsível ao separar livros e usuários em abas com um único card por contexto, e usar um botão único de atualização baseado na aba ativa.
  - Para API de livros administrativos, vale suportar `publisher_name` no payload/listagem para exibir e filtrar por nome da editora sem depender de ID.
- Evidencias:
  - src/view/AdminView.tsx
  - src/controller/AdminController.ts
  - src/service/AdminService.ts
- Acao aplicada:
  - Implementadas abas `Livros` e `Usuários` em `/admin`, com busca no topo e listagem no corpo do card.
  - Adicionado `refreshCurrentTab` no controller para atualizar livros ou usuários conforme aba ativa.
  - `AdminService` passou a enviar `publisher_name` no filtro e normalizar `publisher_name`/`publisher_id` no DTO.
- Impacto esperado:
  - Menor ambiguidade operacional no painel e filtro de editora alinhado ao nome exibido para o usuário.

### 2026-04-02 - detalhes de livro por endpoint unitário
- Descoberta:
  - A tela de detalhes buscava o livro varrendo a listagem, o que gera custo e comportamento incorreto para detalhe unitário.
- Evidencias:
  - src/service/BookService.ts
  - src/view/BookDetailsWrapper.tsx
- Acao aplicada:
  - `fetchBookDetails` passou a usar `GET /libraries_books/:id` diretamente e tratar fallback para `null` em erro.
- Impacto esperado:
  - Menor latência e contrato REST correto para página de detalhe.

### 2026-04-02 - nova tela `/admin` com modais unificados
- Descoberta:
  - O fluxo de manutenção separado (criar x editar) gerava fricção; um modal único por entidade reduz cliques e mantém consistência entre livros e usuários.
  - Na listagem administrativa de livros, o backend já pagina via `nsj-rest-lib`, então o front deve usar `limit` + URL de `next` (sem paginação custom por página).
- Evidencias:
  - src/view/AdminView.tsx
  - src/controller/AdminController.ts
  - src/service/AdminService.ts
  - src/App.tsx
- Acao aplicada:
  - Implementada rota protegida `/admin` com listagem paginada de livros (`next` + botão \"Carregar mais\"), busca/filtros e CRUD de livros e usuários em modal único (salvar/cancelar), consumindo `limit` no `GET /books`.
- Impacto esperado:
  - Operação administrativa mais rápida e previsível, sem alterar o fluxo legado de `/publisher-admin`.

### 2026-03-30 - refresh de token centralizado
- Descoberta: O front agora centraliza acesso ao `access_token`, com renovacao automatica quando faltar 30s.
- Evidencias:
  - src/contexts/AuthContext.tsx
  - src/view/BookDetailsView.tsx
  - src/controller/PublisherAdminController.ts
  - README.md
- Acao aplicada: Adicionado `getAccessToken` e persistencia de `refresh_token`/`token_expires_at`; chamadas autenticadas passaram a usar o getter.
- Impacto esperado: Evitar erros de "Token expirado" ao consumir endpoints autenticados.
