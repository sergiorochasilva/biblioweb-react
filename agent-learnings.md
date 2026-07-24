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

### 2026-07-24 - diagnostico de producao do bibliotecario travado por timeout do provider
- Descoberta:
  - A ultima conversa de producao do bibliotecario pode parecer travada quando o job RQ do chat estoura o timeout de 180s dentro do adapter OpenAI antes de persistir qualquer tool call.
  - Reindexacao semantica pode ser necessaria para cobertura, mas nao explica sozinha esse travamento quando o banco mostra `tool_names=[]`, `books=[]` e erro `Task exceeded maximum timeout value (180 seconds)`.
  - Em 2026-07-24, o indice semantico de producao estava parcial: 559 livros no catalogo, 72 livros em `book_embedding_summary` e 50 livros em `book_embedding_chunk`, sem backlog Redis pendente.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-infra/inventories/prod/group_vars/all/all.yml
  - producao: container `fronesischatworker`, fila Redis `chat-llm`, tabelas `chat_conversation` e `chat_message`
  - producao: tabelas `book_embedding_summary` e `book_embedding_chunk`
- Acao aplicada:
  - Diagnostiquei logs, containers, Redis e Postgres em modo leitura; nao reiniciei servicos nem enfileirei reindexacao.
- Impacto esperado:
  - Proximas investigacoes devem separar timeout do provider, stream SSE e cobertura do indice antes de assumir que reindexar livros e a causa raiz.

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
