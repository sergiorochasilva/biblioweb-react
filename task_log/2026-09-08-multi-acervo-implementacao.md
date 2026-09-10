# Implementação multi-acervo

Data: 2026-09-08

## Objetivo

Implementar o fluxo de múltiplos acervos para leitores, mantendo um único catálogo público. Após autenticação, o leitor deve escolher o acervo somente quando possuir mais de um vínculo; com um único vínculo, o acesso é direto.

O plano validado que norteou a implementação está em [`../task_plan/2026-08-22-multi-acervo-deck.html`](../task_plan/2026-08-22-multi-acervo-deck.html).

## Decisões aplicadas

- O catálogo público é o único acervo acessível anonimamente.
- O identificador do catálogo público é configurável por `PUBLIC_LIBRARY_ID`, com valor atual `1`.
- O seletor de acervo fica oculto para quem tem somente um acervo.
- Compras permanecem vinculadas globalmente à conta, com identificação de acervo preservada nos dados retornados.
- Conversas de chat sem acervo, ou vinculadas a acervo inexistente, são associadas ao acervo público pela migração.
- A administração de editoras não foi incluída como etapa no fluxo do leitor.

## Front-end (`biblioweb-react`)

### Sessão e seleção

- Criado `src/service/librarySession.ts` para normalizar a lista de acervos elegíveis, validar a biblioteca persistida e sanitizar o parâmetro `next`.
- Atualizado `AuthContext` para revalidar o acervo persistido ao carregar um novo perfil e evitar que uma sessão anterior interfira na sessão recém-autenticada.
- O carregamento pós-login consulta `GET /profile` sem filtro de biblioteca. Com um acervo, ele o seleciona automaticamente; com múltiplos, direciona para `/selection`.
- A ação pendente de empréstimo é retomada somente após o acervo ser definido. Para um único acervo, o identificador selecionado também é repassado à ação pendente.

### Rotas e telas

- A rota `/selection` passou a ser autenticada e exibe exclusivamente os acervos vinculados ao leitor.
- Criado `LibraryContextRoute`, que exige um acervo válido para `/ebook/:id`, `/profile` e `/meus-livros`.
- Mantidas públicas as rotas de home, busca e detalhe de livro. Usuários autenticados com múltiplos vínculos são conduzidos à seleção antes de utilizar fluxos dependentes do acervo.
- Adicionado seletor de acervo no cabeçalho para usuários com dois ou mais vínculos. A troca atualiza a sessão e retorna à home do acervo selecionado.
- Perfil e chat passaram a propagar o identificador do acervo ativo em suas chamadas.

## API (`biblioweb-api`)

### Autorização de acervo

- Criado `fronesis/library_context.py` com parsing estrito de `library`, resolução do acervo público e autorização por vínculo em `user_library`.
- Usuários autenticados recebem `400` quando o parâmetro obrigatório está ausente ou inválido e `403` quando não possuem vínculo com o acervo solicitado.
- Visitantes só podem utilizar o acervo público configurado; solicitações a outros acervos retornam `403`.
- O guard foi aplicado às APIs públicas/de-leitor de catálogo, detalhe, acesso, empréstimo, devolução, compra, download de compra, perfil, pesquisa semântica e chat.

### Dados e chat

- `ProfileDAO` passou a expor a verificação de vínculo e o perfil aceita contexto de acervo opcional para a carga inicial após login.
- Consultas de conversas do chat passaram a filtrar por acervo; carregamento, envio e stream verificam a conversa no mesmo escopo e dono/chave de cliente.
- Criada a migração `20260907120000 - Chat conversation library integrity.sql`, que:
  - associa registros nulos ou inválidos ao acervo público;
  - torna `chat_conversation.library` obrigatório;
  - cria a chave estrangeira para `library`;
  - adiciona índices para consultas por usuário/chave e acervo.

### Compatibilidade

- Respostas dos endpoints de pesquisa e reindexação semântica passaram a declarar `Content-Type: application/json`.
- A suíte de regressão HTTP foi adaptada para injetar o contexto de acervo nos stubs, sem eliminar a cobertura do guard em testes dedicados.

## Infraestrutura (`biblioweb-infra`)

- Incluído `PUBLIC_LIBRARY_ID: "1"` no `api_env` de produção, disponibilizado para API e workers pela role de serviços em execução.
- O `ansible-playbook --syntax-check` foi executado com sucesso.

## Testes executados

| Camada | Comando/escopo | Resultado |
| --- | --- | --- |
| Front-end | `npm run build` | Aprovado |
| Front-end | `npm run lint` | Sem erros; permanece um aviso pré-existente em `SearchView.tsx` |
| API | `test_library_context.py` | 4 testes aprovados |
| API | `test_00_http_route_regressions.py` | 36 testes aprovados |
| Infra | `make syntax` | Aprovado |
| E2E | Playwright Chromium, API e PostgreSQL reais | 2 testes aprovados |

Os cenários Playwright cobrem:

1. Login de leitor com dois acervos, seleção explícita e troca pelo cabeçalho.
2. Login de leitor com apenas um acervo, sem passagem pela tela de seleção e sem seletor no cabeçalho.

## Ambiente local e limpeza

- A migração foi executada no ambiente local durante a validação.
- Dados temporários de usuários e acervos criados pelos testes foram removidos ao final.
- Os containers locais foram encerrados com `docker compose down`; volumes e dados persistentes do projeto foram preservados.
- Nenhum commit ou push foi realizado nesta etapa.
