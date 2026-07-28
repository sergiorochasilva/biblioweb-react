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

### 2026-07-27 - recuperação do chat deve ser vinculada à rodada atual
- Descoberta:
  - Uma conversa pode conter respostas anteriores, portanto a conclusão do fallback precisa ser procurada depois do `message_id` da mensagem atual.
  - O SSE da rodada deve continuar ativo quando o usuário troca de conversa; ao voltar, o front precisa sincronizar e reabrir o stream se ele estiver fechado.
  - Callbacks do `EventSource` podem preservar estado de uma renderização antiga; IDs e rótulos usados na recuperação precisam estar disponíveis em refs atualizadas.
  - O `done` sintético com status `timeout` não representa sucesso e deve mostrar erro ao usuário.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/src/view/BibliotecarioView.tsx
  - /home/sergio/@pessoal/biblioweb-api/fronesis/controller/chat_controller.py
- Acao aplicada:
  - Vinculei a detecção de conclusão ao `message_id` atual, mantive o stream durante a troca de conversa, corrigi o rótulo de tool para considerar somente a rodada atual e tratei timeout do SSE como erro recuperável para a próxima tentativa.
- Impacto esperado:
  - O fallback não encerra a segunda mensagem usando a resposta anterior, a conversa não fica abandonada ao navegar pelo histórico e a UI não exibe tool antiga nem interpreta timeout como conclusão.

### 2026-07-25 - status tecnico do chat nao deve aparecer no loading visual
- Descoberta:
  - Eventos ou snapshots do backend podem trazer status tecnico (`running`, `queued`, `done`) enquanto a UI precisa traduzir apenas os estados de execucao para `Analisando...` ou `Em fila...`.
  - `open` e `done` representam o ciclo de vida da conversa, nao uma etapa de espera da resposta; durante uma rodada, a tag local deve indicar conversa aberta/em andamento sem alimentar o loading.
  - O scroll automatico precisa cobrir tanto a mensagem do usuario quanto a resposta do assistente.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/src/view/BibliotecarioView.tsx
  - producao: conversa `965255b6-40d0-415d-b09f-c44afb45e31f`
- Acao aplicada:
  - Normalizei `queued` para `Em fila...` e `running` para `Analisando...`; ignorei `open`/`done` no loading, sobrepus a tag da conversa ativa para `Aberta` enquanto ha `loadingConversationId` e adicionei scroll para a ultima mensagem do usuario.
- Impacto esperado:
  - A UI deixa de mostrar `running`, nao marca visualmente a conversa ativa como concluida durante nova rodada e mantem o foco no inicio da mensagem recem-criada.

### 2026-07-24 - chat do bibliotecario bloqueia novo envio durante rodada ativa
- Descoberta:
  - A rodada do bibliotecario continua ativa enquanto a UI aguarda o SSE/resposta final, mesmo depois de o `POST /chat/conversations` retornar.
  - O historico deve exibir status tecnico em portugues, como tag discreta, sem ocupar uma linha propria do item.
  - O SSE pode cair antes da resposta final; o loading precisa estar vinculado a conversa em processamento e a UI deve recuperar o snapshot por polling apenas como fallback apos queda do stream.
  - Quando a resposta do assistente chega, a conversa deve rolar para o inicio do balao da resposta, nao permanecer parada nem pular para o fim.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/src/view/BibliotecarioView.tsx
  - /home/sergio/@pessoal/biblioweb-react/src/styles/BibliotecarioView.css
- Acao aplicada:
  - O envio por botao, Enter e "Nova conversa" passou a respeitar `loading || loadingConversation`; os status `done`, `queued`, `open`, `error` e `running` foram traduzidos e renderizados em tag flutuante.
  - Adicionei `loadingConversationId`, guards por conversa nos eventos/snapshots e polling de snapshot a cada 5s somente depois de `EventSource.onerror` acionar recuperacao do stream.
  - Adicionei scroll automatico para o topo da nova resposta do assistente quando ela entra no historico.
- Impacto esperado:
  - A UI nao permite mensagens no meio da mesma rodada, nao mistura loading entre conversas e recupera a resposta quando o SSE cai antes do `done`.

### 2026-07-24 - e2e do bibliotecario deve cobrir segunda mensagem real com provider OpenAI
- Descoberta:
  - O runner e2e ainda forcava `CHAT_PROVIDER=local`, mas o backend atual rejeita provider local; o e2e precisa herdar `CHAT_PROVIDER`, `CHAT_MODEL` e `OPENAI_API_KEY` do `.env` da API quando nao houver override explicito.
  - O fluxo que regrediu em producao e especificamente a segunda mensagem da mesma conversa pedindo indicacao de livros, entao precisa existir teste Playwright com duas mensagens reais e validacao de cards.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/scripts/run-e2e-stack.mjs
  - /home/sergio/@pessoal/biblioweb-react/tests/e2e/chat-bibliotecario.spec.ts
  - producao: conversa `4b813dbb-50c4-41e3-9438-a8ab359e25db` terminou no banco, mas o SSE caiu antes da resposta aparecer no navegador
- Acao aplicada:
  - Ajustei o runner para usar o provider real da API local e adicionei teste Playwright da sequencia "O que calvino..." seguida de "Pode me indicar livros sobre isso?".
- Impacto esperado:
  - Proximos deploys do bibliotecario passam a validar a segunda mensagem com stack real antes de chegar em producao.

### 2026-07-24 - uso de IA do usuario deve ficar no modal de edicao
- Descoberta:
  - O grid de usuarios do `/admin` deve manter apenas dados cadastrais; uso diario de IA do bibliotecario e uma informacao operacional que deve aparecer somente ao editar um usuario.
  - O reset de tokens diarios fica no topo do modal de edicao, junto ao card "Uso de IA (Blibliotecario)", e atualiza apenas o estado do modal.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/src/service/AdminService.ts
  - /home/sergio/@pessoal/biblioweb-react/src/controller/AdminController.ts
  - /home/sergio/@pessoal/biblioweb-react/src/view/AdminView.tsx
- Acao aplicada:
  - `fetchUsers` voltou a carregar apenas usuarios; `openEditUserModal` consulta `/users/chat-token-usage` para o e-mail selecionado e o botao do modal chama o reset.
- Impacto esperado:
  - A listagem fica mais leve e a gestao de uso de IA fica concentrada no contexto de edicao do usuario.

### 2026-07-24 - bibliotecario precisa recuperar SSE encerrado antes do done
- Descoberta:
  - Em producao, o worker pode finalizar e persistir a resposta corretamente depois de a conexao SSE do navegador/proxy cair; nesse caso a conversa fica `done` no banco, mas a UI permanece visualmente em analise se nao sincronizar o snapshot.
  - O `EventSource.onerror` precisa disparar recuperacao do estado da conversa, deduplicar eventos ja recebidos e reabrir o stream apenas quando o backend ainda nao terminou.
- Evidencias:
  - /home/sergio/@pessoal/biblioweb-react/src/service/ChatService.ts
  - /home/sergio/@pessoal/biblioweb-react/src/view/BibliotecarioView.tsx
  - producao: conversa `80084fdf-9b28-48c2-93c5-0ea71a7d38f7`, stream fechou antes da mensagem final persistida
- Acao aplicada:
  - Adicionei callback de erro ao SSE, sincronizacao de snapshot na queda, reabertura controlada do stream e deduplicacao por id de evento.
- Impacto esperado:
  - O bibliotecario deixa de ficar preso em `Analisando...` quando a resposta foi concluida no backend, mesmo se a conexao SSE cair antes do evento final.

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
