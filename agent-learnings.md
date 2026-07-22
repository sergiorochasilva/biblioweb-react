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

### 2026-07-18 - e2e do bibliotecário deve confirmar cards sem assumir único resultado
- Descoberta:
  - A busca do bibliotecário pode retornar vários cards do acervo no mesmo bloco, então asserções de Playwright não devem depender de um único `.book-card`.
  - O fluxo de cards depende do backend aceitar resultados semânticos mesmo quando a etapa de clarificação do catálogo sugere termos aproximados.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/tests/e2e/chat-bibliotecario.spec.ts
  - /home/sergio/@pessoal/biblioweb-api/fronesis/chat_llm/adapters/local_adapter.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/chat_llm/adapters/openai_adapter.py
- Acao aplicada:
  - Ajustei o e2e para localizar o card pelo texto do livro criado e mantive o cenário cobrindo o caminho de busca com sugestões do acervo.
- Impacto esperado:
  - O teste passa a validar o card correto sem ficar frágil quando a resposta traz outras sugestões relevantes do catálogo.

### 2026-07-10 - chat local depende da fila Redis completa no Dev Container
- Descoberta:
  - O `POST /chat/conversations` persiste a mensagem e precisa enfileirar um job RQ antes de responder `202`; sem Redis, retorna `500` e a UI preserva corretamente o texto que não foi aceito.
  - O Dev Container tinha a API e o front, mas não subia `redis`, `worker` e `chat_worker`, apesar de a API resolver `REDIS_URL` para `redis:6379` por padrão.
- Evidencias:
  - /home/sergio/@pessoal/devcontainer-biblioweb/.devcontainer/docker-compose.yml
  - /home/sergio/@pessoal/biblioweb-api/fronesis/chat_llm/queue.py
  - /home/sergio/@pessoal/biblioweb-react/src/view/BibliotecarioView.tsx
- Acao aplicada:
  - O compose e o `runServices` agora sobem Redis e os workers de indexação e chat; o E2E verifica que o campo de mensagem é limpo quando a API aceita o envio.
  - Em falhas, a UI encerra o estado de análise e mantém o texto para nova tentativa.
- Impacto esperado:
  - O chat local processa jobs de ponta a ponta e não fica visualmente preso em “Analisando...” após um erro de infraestrutura.

### 2026-07-10 - layout do chat deve reutilizar o contêiner horizontal padrão
- Descoberta:
  - Usar `Layout.Sider` dentro da tela do chat faz o `Layout` raiz do Ant Design assumir a composição lateral, deslocando o `Header` e o conteúdo para colunas irmãs e criando overflow horizontal.
  - O chat deve manter o mesmo limite de `page-content` (`min(1200px, 92vw)`) das telas públicas; um filho de `1400px` dentro desse contêiner deixa as margens assimétricas.
- Evidencias:
  - src/view/BibliotecarioView.tsx
  - src/styles/BibliotecarioView.css
  - tests/e2e/chat-bibliotecario.spec.ts
- Acao aplicada:
  - Troquei o `Sider` por um `aside` e deixei o grid ocupar `100%` do contêiner padrão.
  - O Playwright passou a validar posição abaixo do cabeçalho, margens laterais simétricas, ausência de overflow e a ordem da navegação.
- Impacto esperado:
  - A tela do bibliotecário preserva a mesma composição horizontal das demais páginas e não regride para um layout lateral acidental.

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

### 2026-07-11 - bibliotecário não deve restaurar a última conversa por padrão e o loading deve refletir apenas eventos reais
- Descoberta:
  - Ao entrar diretamente em `/bibliotecario`, restaurar a conversa anterior do `localStorage` conflita com a expectativa de começar uma nova conversa.
  - O usuário não quer heurística local para o nome da tool; sem evento real, o rótulo deve ficar apenas em `Analisando...`.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/src/view/BibliotecarioView.tsx
  - /home/sergio/@pessoal/biblioweb-react/src/view/HeaderView.tsx
  - /home/sergio/@pessoal/biblioweb-react/tests/e2e/chat-bibliotecario.spec.ts
- Acao aplicada:
  - A tela do bibliotecário passou a abrir vazia quando acessada diretamente, enquanto o atalho da busca cria sempre uma nova conversa com a mensagem do campo.
  - O front passou a iniciar sempre em `Analisando...` e só troca para `Analisando (tool)...` quando o backend realmente publica esse evento.
- Impacto esperado:
  - O fluxo do bibliotecário fica previsível na navegação normal e o estado visual do chat não inventa tools que ainda não rodaram.

### 2026-07-18 - SSE do bibliotecário precisa fechar só após a resposta final
- Descoberta:
  - O stream do chat estava fechando em um `done` intermediário publicado antes da mensagem final do assistente, então a UI só via a resposta depois de recarregar a conversa.
  - O `EventSource.onerror` do front também disparava em encerramento normal, poluindo o console com falso erro.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-api/fronesis/chat_llm/services/chat_service.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/controller/chat_controller.py
  - /home/sergio/@pessoal/biblioweb-api/fronesis/dao/chat_message_dao.py
  - /home/sergio/@pessoal/biblioweb-react/src/service/ChatService.ts
- Acao aplicada:
  - Introduzi `stream_order` na tabela `chat_message`, passei o SSE a ordenar por esse cursor monotônico e removi o `done` intermediário do worker antes da mensagem final.
  - O front agora ignora `onerror` quando o stream já terminou, sem esconder falhas reais.
- Impacto esperado:
  - A resposta do chat aparece em tempo real no fluxo normal, sem refresh, e o console deixa de mostrar erro falso ao encerrar o SSE.
