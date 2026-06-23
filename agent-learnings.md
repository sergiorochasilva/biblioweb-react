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

### 2026-06-09 - preserve book_library id so purchase price updates the existing link
- Descoberta:
  - O formulário de edição já carregava `book_library.id`, mas o payload de save descartava esse identificador.
  - Sem o `id` do vínculo, o `rest_lib` tende a tratar a linha como inserção nova, e o preço editado pode não reaparecer na próxima leitura do livro.
- Evidencias:
  - src/model/BookLibrary.ts
  - src/controller/AdminController.ts
  - src/controller/PublisherAdminController.ts
- Acao aplicada:
  - O payload de `BookLibraryPayload` passou a enviar `id` quando disponível, preservando o vínculo existente no `PUT` de livro.
- Impacto esperado:
  - O preço de compra editado por acervo atualiza a linha correta no banco e volta a aparecer ao reabrir o livro.

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
