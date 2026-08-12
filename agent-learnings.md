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

### 2026-08-12 - leitura no atalho de ebook deve respeitar o tipo do livro
- Descoberta:
  - A rota protegida `/ebook/:id` não pode assumir que todo livro é uma cópia comprada com LCP; livros `external` devem registrar o acesso e abrir `external_url`, como no detalhe `/book/:id`.
  - A cobertura e2e que localiza o PostgreSQL deve reconhecer imagens `pgvector/pgvector`, usadas pela stack local.
- Evidencias:
  - `src/view/EbookMiniView.tsx`
  - `src/view/BookDetailsView.tsx`
  - `tests/e2e/ebook-mini-view.spec.ts`
  - `tests/e2e/support.ts`
- Acao aplicada:
  - Ação principal do ebook passou a seguir os tipos protegido, comprado, externo e gratuito; o e2e valida abertura da URL externa após registro de acesso.
- Impacto esperado:
  - Links do OPALS para livros externos não passam pelo endpoint de compra e continuam registrando a leitura.
