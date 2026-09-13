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

### 2026-09-12 - chamadas HTTP ao backend devem ter prazo centralizado
- Descoberta:
  - Um `fetch` sem `AbortController` mantém a tela administrativa em estado de carregamento quando uma dependência síncrona do backend deixa de responder.
  - Alguns serviços usavam `fetch` diretamente para paginação e download, fora do cliente HTTP principal.
- Evidencias:
  - `src/service/api.ts`
  - `src/service/BookService.ts`
  - `src/service/ChatService.ts`
  - `src/service/PublisherAdminService.ts`
  - `src/service/AdminService.ts`
- Acao aplicada:
  - Centralizei o prazo configurável de 30 segundos em `fetchApiWithTimeout` e encaminhei as chamadas HTTP diretas para esse wrapper, mantendo SSE fora desse limite.
- Impacto esperado:
  - A interface encerra o carregamento com erro legível se a API não responder, em vez de aguardar indefinidamente.

### 2026-09-09 - detalhe de empréstimo e carregamento da Home
- Descoberta:
  - O endpoint unitário de `libraries_books` é o único que recebe o contexto de empréstimo do usuário; a listagem preserva livros com empréstimo ativo, mas não preenche `loan_state`.
  - Ao atualizar o profile, manter um novo objeto de acervo com o mesmo id faz efeitos dependentes de `library` reiniciarem indefinidamente.
- Evidencias:
  - `src/service/BookService.ts`
  - `src/contexts/AuthContext.tsx`
  - `src/view/EbookMiniView.tsx`
  - `src/view/BookDetailsView.tsx`
  - `tests/e2e/book-loan-state.spec.ts`
  - `tests/e2e/home-carousels.spec.ts`
- Acao aplicada:
  - Passei o detalhe para a rota unitária, recarreguei o livro após emprestar e preservei a identidade do acervo quando o id não muda.
- Impacto esperado:
  - As duas telas de detalhe passam imediatamente para o estado emprestado e os carrosséis da Home deixam de reiniciar o carregamento.

### 2026-09-08 - contexto ativo de acervo do leitor
- Descoberta:
  - O `profile` sem query é a fonte de verdade dos vínculos elegíveis; a biblioteca persistida precisa ser revalidada ao trocar de sessão.
  - Endpoints de leitor devem exigir o `library` vinculado para usuários autenticados e permitir visitantes apenas no catálogo público configurado.
- Evidencias:
  - `src/service/librarySession.ts`
  - `src/components/LibraryContextRoute.tsx`
  - `../biblioweb-api/fronesis/library_context.py`
  - `tests/e2e/multi-library.spec.ts`
- Acao aplicada:
  - Centralizei a seleção pós-login, o guard de rotas de leitor e a autorização de API; a suíte Playwright cobre seleção, troca e acesso direto.
- Impacto esperado:
  - Um usuário nunca mistura dados de acervos sem vínculo, enquanto o catálogo público continua sendo único e acessível anonimamente.
