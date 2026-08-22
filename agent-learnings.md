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

### 2026-08-21 - limite de arquivo do cadastro precisa anteceder a conversão base64
- Descoberta:
  - A tela de cadastro transforma o arquivo em `base64_content`, portanto deve impedir arquivos acima de 100 MiB antes de alocar a representação maior em memória.
  - O e2e do cadastro deve verificar o corpo efetivamente enviado, e não só a presença do livro na lista.
- Evidencias:
  - `src/service/bookUpload.ts`
  - `src/service/AdminService.ts`
  - `src/service/PublisherAdminService.ts`
  - `tests/e2e/book-upload-ui.spec.ts`
- Acao aplicada:
  - Centralizei o teto de 100 MiB no serviço de upload, apresentei-o nos dois formulários e acrescentei cobertura Playwright que seleciona um arquivo, salva e confere o base64 enviado ao `POST /books`.
- Impacto esperado:
  - O usuário recebe erro antes da conversão de um arquivo grande e o contrato real de envio da interface fica protegido contra regressões.

### 2026-08-21 - edição administrativa a partir do detalhe público
- Descoberta:
  - O detalhe `/book/:id` é público; a ação de edição só deve ser exibida após validar a permissão global no `profile` autenticado.
  - Para abrir o cadastro correto sem depender de busca textual ambígua, a rota deve transmitir o identificador do livro e o painel deve consultá-lo antes de abrir o modal.
- Evidencias:
  - `src/view/BookDetailsView.tsx`
  - `src/view/AdminView.tsx`
  - `src/controller/AdminController.ts`
  - `src/service/postLoginRoute.ts`
- Acao aplicada:
  - O botão de edição global encaminha para `/admin?book=<id>&mode=edit`; a tela administrativa seleciona a aba de livros, preenche a busca pelo título e abre o modal de edição a partir da consulta pelo ID.
- Impacto esperado:
  - Administradores alcançam diretamente o registro exibido, enquanto leitores e administradores de editora não recebem acesso indevido ao painel global.

### 2026-08-12 - leitura no atalho de ebook deve respeitar o tipo do livro
- Descoberta:
  - A rota protegida `/ebook/:id` não pode assumir que todo livro é uma cópia comprada com LCP; livros `external` devem registrar o acesso e abrir `external_url`, como no detalhe `/book/:id`.
  - O selo e a ação `Ler versão web` da rota `/ebook/:id` precisam usar as mesmas regras de tipo e `html_version_url` da tela `/book/:id`.
  - A equivalência do atalho de ebook também inclui os estados de empréstimo, compra e indisponibilidade: rótulos de leitura, devolução, checkout, expiração e último acesso não podem ficar restritos ao detalhe completo.
  - Capas com URLs ausentes ou inválidas precisam usar o mesmo ícone de fallback, sem ocultar a ação de leitura.
  - A cobertura e2e que localiza o PostgreSQL deve reconhecer imagens `pgvector/pgvector`, usadas pela stack local.
- Evidencias:
  - `src/view/EbookMiniView.tsx`
  - `src/view/BookDetailsView.tsx`
  - `tests/e2e/ebook-mini-view.spec.ts`
  - `tests/e2e/support.ts`
- Acao aplicada:
  - Ação principal, selo de tipo, estados de empréstimo/compra, versão web e fallback de capa do ebook passaram a seguir o detalhe completo; o e2e valida abertura das URLs externa e web, status de compra e fallback após registro de acesso.
- Impacto esperado:
  - Links do OPALS para livros externos não passam pelo endpoint de compra e continuam registrando a leitura, enquanto cópias protegidas preservam os controles de empréstimo, devolução e compra.
