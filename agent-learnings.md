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

### 2026-07-04 - busca semântica precisa de loading explícito e e2e com API/base URL corretas
- Descoberta:
  - Os resultados da busca semântica só podem vir de livros já presentes em `book_embedding_summary` e/ou `book_embedding_chunk`; no fluxo atual o merge deduplica por `book_id` e o score final prevalente é o maior entre resumo e conteúdo.
  - A UI de busca pública precisava de shimmer próprio para o carregamento, porque o retorno rápido da API deixava o usuário sem feedback visual enquanto os resultados eram buscados.
  - O Playwright deste repo usa `PLAYWRIGHT_API_BASE_URL` e `PLAYWRIGHT_BASE_URL`; sem isso, a suíte tenta falar com `127.0.0.1:5000` e falha quando o ambiente real está em outra porta.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-api/fronesis/embedding_search/service.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/embedding_search/semantic_search.py
  - /home/sergio/@pessoal/biblioweb-react/src/view/SearchView.tsx
  - /home/sergio/@pessoal/biblioweb-react/src/styles/SearchView.css
  - /home/sergio/@pessoal/biblioweb-react/playwright.config.ts
  - /home/sergio/@pessoal/biblioweb-react/tests/e2e/semantic-search.spec.ts
- Acao aplicada:
  - Adicionei shimmer de carregamento na tela de busca, deixei o E2E verificar esse estado e rodei a suíte contra a API local com as URLs explícitas.
- Impacto esperado:
  - O usuário percebe que a pesquisa está em andamento e o time evita diagnósticos errados quando a suíte e2e está apontando para a base URL errada.

### 2026-07-03 - busca semantica do front depende do stack real e do browser Playwright
- Descoberta:
  - O front precisa chamar `POST /books/search-semantic` na pesquisa normal, e o E2E so valida de verdade quando roda contra a API e o preview do Vite com browser real.
  - O ambiente local nem sempre tem o Chromium do Playwright baixado; a execucao do `test:e2e` fica mais auto-suficiente quando o repo instala o browser automaticamente antes da suite.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/src/service/BookService.ts
  - /home/sergio/@pessoal/biblioweb-react/src/view/SearchView.tsx
  - /home/sergio/@pessoal/biblioweb-react/scripts/run-e2e-stack.mjs
  - /home/sergio/@pessoal/biblioweb-react/tests/e2e/semantic-search.spec.ts
  - /home/sergio/@pessoal/biblioweb-react/package.json
- Acao aplicada:
  - Troquei a busca da tela para o endpoint semantico, adicionei o fluxo E2E real e deixei o `test:e2e` instalar/verificar o Chromium automaticamente antes de rodar.
- Impacto esperado:
  - A pesquisa na interface usa a mesma API nova do backend, e a validação automatizada nao depende de preparos manuais de browser.

### 2026-06-19 - e2e publisher-admin precisa limpar licenças locais antes de excluir livro
- Descoberta:
  - O fluxo de venda no Publisher Admin cria registros locais em `license`, `license_status`, `content` e tabelas relacionadas.
  - Depois de gerar a URL de venda e baixar a licença, o `DELETE /books/{id}` pode voltar `400` no teardown se esses vínculos não forem removidos antes.
- Evidencias:
  - tests/e2e/support.ts
  - tests/e2e/publisher-admin.spec.ts
  - fronesis/client/readium_client.py
- Acao aplicada:
  - O helper de Playwright passou a limpar os vínculos do livro no Postgres e a tentar o delete novamente antes de falhar.
- Impacto esperado:
  - O e2e de administração da editora fica estável mesmo depois de exercitar o caminho completo de compra/download.

### 2026-06-19 - publisher admin só opera livros protected e Playwright deve capturar ids pela resposta
- Descoberta:
  - O Publisher Admin final ficou restrito a livros `protected`; cadastro e edição de externos/free precisavam ser bloqueados na UI e no backend.
  - Em Playwright, procurar o livro recém-criado no endpoint de listagem logo após salvar era instável; a resposta de `POST /books` já devolve `id`, e a de `PUT /books/{id}` confirma a edição.
- Evidencias:
  - src/view/PublisherAdminView.tsx
  - src/controller/PublisherAdminController.ts
  - tests/e2e/publisher-admin.spec.ts
- Acao aplicada:
  - Removi a edição do tipo de livro na interface do Publisher Admin e forcei o fluxo protegido.
  - Os testes e2e passaram a capturar o `id` diretamente das respostas de criação e atualização, em vez de depender da listagem.
- Impacto esperado:
  - A regra de negócio fica consistente entre UI e API, e os testes de CRUD da editora deixam de falhar por corrida de leitura logo após o save.
