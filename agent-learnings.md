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

### 2026-04-09 - contrato de usuário/admin com `reading_pass_hint`
- Descoberta:
  - O front administrativo precisa tolerar transição de contrato (`pass_hint` legado vs `reading_pass_hint` novo) para não quebrar edição/listagem.
  - O fluxo de geração de link de venda deve enviar os campos canônicos de leitura (`reading_pass_hint`/`reading_pass_hash`).
- Evidencias:
  - src/service/AdminService.ts
  - src/controller/AdminController.ts
  - src/service/PublisherAdminService.ts
  - src/controller/PublisherAdminController.ts
  - src/view/AdminView.tsx
- Acao aplicada:
  - `AdminUser` foi atualizado para `reading_pass_hint`, com fallback de normalização para `pass_hint`.
  - Listagem/edição de usuário no admin passou a usar `reading_pass_hint`.
  - Payload de `books-purchase-links` passou a enviar `reading_pass_hint` e `reading_pass_hash`.
- Impacto esperado:
  - Compatibilidade com backend atualizado sem regressão visual/funcional no painel admin.

### 2026-04-08 - CRUD admin com endpoints que retornam corpo vazio em create/update
- Descoberta:
  - Em manutenção administrativa (`libraries`, `publishers`, `authors`), alguns ambientes retornam sucesso sem body (`202/204` ou `{}`), e validar estrutura do objeto no front gera falso negativo ("Resposta inválida ...").
  - A listagem administrativa deve usar nomenclatura de negócio ("Acervos") em vez de termos técnicos de entidade ("Libraries").
- Evidencias:
  - src/service/AdminService.ts
  - src/view/AdminView.tsx
- Acao aplicada:
  - `create/update` de bibliotecas, editoras e autores passaram a tratar sucesso HTTP sem exigir payload de retorno.
  - Aba `Libraries` foi renomeada para `Acervos` e o título correspondente para `Manitenção de acervos`.
- Impacto esperado:
  - Fluxo de salvar entidades no admin sem erro falso por resposta vazia e interface mais alinhada ao domínio.

### 2026-04-08 - detalhes do livro com exportacao MARC21 e referencia bibliografica
- Descoberta:
  - A API expõe MARC21 por `GET /books-marc/:id`, mas o ID da tela de detalhe pode vir como vínculo de `libraries_books`; para robustez, o front deve tentar resolver `book_id` antes do fallback final.
  - Geração de referência no front precisa montar segmentos condicionais para não exibir campos ausentes em APA/ABNT.
- Evidencias:
  - src/service/BookService.ts
  - src/view/BookDetailsView.tsx
  - src/styles/BookDetailsView.css
  - /home/sergio/@pessoal/biblioweb-api/fronesis/controller/book_marc_controller.py
- Acao aplicada:
  - Adicionado `fetchBookMarc21` no `BookService` com fallback de IDs e mensagem consistente para 401/403.
  - Tela de detalhes recebeu botões secundários e modais para visualizar/copiar MARC21 e alternar referência entre APA/ABNT.
  - README atualizado com as novas ações da página de detalhe.
- Impacto esperado:
  - Exportação MARC21 operacional no fluxo de visualização e referência bibliográfica pronta sem depender de backend adicional.

### 2026-04-04 - home usa `order=access_count desc` na mesma rota de livros
- Descoberta:
  - A listagem de "Mais acessados" fica mais estável usando `GET /libraries_books` com `order=access_count desc`, evitando dependência de endpoint dedicado não disponível.
  - O menu de perfil pode não exibir "Administração" quando o contexto ainda não hidratou `/profile` após login por código.
- Evidencias:
  - src/service/BookService.ts
  - src/view/HeaderView.tsx
  - logs da API com `404` em `/libraries_books_most_accessed`
- Acao aplicada:
  - `fetchMostAccessedPublications` passou a consultar `/libraries_books` com `fields` incluindo `access_count`, `order=access_count desc` e `limit=20`.
  - Header passou a hidratar `/profile` automaticamente quando autenticado e sem profile sincronizado, além de fallback explícito para usuário `admin`.
- Impacto esperado:
  - Carrossel de mais acessados deixa de falhar por rota inexistente e link de Admin passa a aparecer de forma consistente no menu do perfil.

### 2026-04-04 - header público com perfil/categorias e descoberta por acesso/assunto
- Descoberta:
  - O header público agora concentra navegação transversal: botão central `Categorias`, busca e menu de perfil por iniciais.
  - A Home passou a depender de duas fontes de listagem por biblioteca: recentes (`/libraries_books`) e populares (`/libraries_books_most_accessed`).
  - A nova tela de categorias funciona melhor quando a seleção de assuntos inicia com até 5 itens e carrega carrosséis independentes por assunto.
- Evidencias:
  - src/view/HeaderView.tsx
  - src/view/HomeView.tsx
  - src/view/CategoriesView.tsx
  - src/view/ProfileView.tsx
  - src/service/BookService.ts
  - /home/sergio/@pessoal/biblioweb-api/fronesis/controller/book_controller.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/controller/library_book_controller.py
- Acao aplicada:
  - Incluídas rotas `/categories` (pública) e `/profile` (protegida), com botão e menu no header.
  - Adicionado consumo de `POST /books/:id/access` ao clicar em `Ler agora`.
  - Implementado novo carrossel `Mais acessados` na Home e página `Categorias` com multiselect (máximo 5) + carrosséis por assunto.
- Impacto esperado:
  - Navegação mais direta para descoberta de conteúdo e ranking de livros baseado em uso real.

### 2026-04-04 - admin global com abas de manutenção e vínculos N:N de usuário
- Descoberta:
  - O admin global agora possui 4 contextos independentes (`Livros`, `Usuários`, `Libraries`, `Editoras`) e todos os campos de referência devem usar combos carregados por API.
  - Para livros, `library` no front é obrigatório e não deve mais usar fallback implícito no save; o filtro já nasce com a primeira library disponível e o modal de criação também.
  - Cadastro/edição de usuário precisa carregar e persistir associações N:N de `libraries` e `publishers`.
- Evidencias:
  - src/controller/AdminController.ts
  - src/service/AdminService.ts
  - src/view/AdminView.tsx
  - /home/sergio/@pessoal/biblioweb-api/fronesis/controller/library_controller.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/controller/publisher_controller.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/service/user_service.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/dao/user_account_dao.py
- Acao aplicada:
  - Front passou a consumir CRUD/list de libraries e editoras no `AdminService`, com duas novas abas no `AdminView` e modais de criação/edição.
  - `AdminController` passou a orquestrar os 4 domínios, inicializar o filtro de library com a primeira opção e exigir `library` no modal de livro.
  - Modal de usuário passou a persistir arrays `libraries` e `publishers`; edição busca detalhe via `GET /users/:id`.
- Impacto esperado:
  - Fluxo administrativo consistente com o contrato atual da API e menor chance de livros sem associação de biblioteca.

### 2026-04-04 - carrossel da home depende de vínculo `book_library`
- Descoberta:
  - A Home busca publicações recentes por `GET /libraries_books?library=<id>`, então livro salvo sem vínculo em `book_library` não aparece no carrossel, mesmo existindo em `book`.
  - No admin global, o `library` é obrigatório no formulário e deve ser enviado explicitamente no payload de create/update.
- Evidencias:
  - src/service/BookService.ts
  - src/view/HomeView.tsx
  - src/controller/AdminController.ts
  - /home/sergio/@pessoal/biblioweb-api/fronesis/service/book_custom_service.py
- Acao aplicada:
  - `AdminController` passou a enviar `library` no payload de create/update sem fallback no momento do save.
  - Modal de criação passou a pré-preencher biblioteca com o filtro ativo.
- Impacto esperado:
  - Menor chance de cadastro sem vínculo e coerência entre contexto filtrado da tela e dados persistidos.

### 2026-04-04 - regras condicionais de cadastro de livro por `type`
- Descoberta:
  - Para manter contrato entre front/back, campos de livro precisam validar de forma condicional por `type`: em `external`, `external_url` é obrigatório e arquivo/metadados binários deixam de ser obrigatórios.
  - Em DTO do backend com validator de assinatura `(dto_field, value)`, validação entre campos exigiu leitura do contexto da instância durante o ciclo de set do descriptor.
- Evidencias:
  - src/controller/AdminController.ts
  - src/controller/PublisherAdminController.ts
  - src/view/AdminView.tsx
  - src/view/PublisherAdminView.tsx
  - /home/sergio/@pessoal/biblioweb-api/fronesis/dto/book_dto_validators.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/dto/book_post_dto.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/dto/book_list_dto.py
- Acao aplicada:
  - Front passou a validar `subject` obrigatório, `external_url` obrigatório só em `external`, e `file_name`/arquivo obrigatórios apenas quando não `external`.
  - Back passou a validar as mesmas regras via `validator` em `DTOField`, aceitar `image_url` nulo e pular upload binário no pós-insert quando `type` for `external`.
- Impacto esperado:
  - Menos rejeição 400 por inconsistência de regra entre camadas e cadastro de livros externos sem arquivo físico.

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
