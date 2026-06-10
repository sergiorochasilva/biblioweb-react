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
