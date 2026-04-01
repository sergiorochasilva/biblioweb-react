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
### 2026-03-30 - refresh de token centralizado
- Descoberta: O front agora centraliza acesso ao `access_token`, com renovacao automatica quando faltar 30s.
- Evidencias:
  - src/contexts/AuthContext.tsx
  - src/view/BookDetailsView.tsx
  - src/controller/PublisherAdminController.ts
  - README.md
- Acao aplicada: Adicionado `getAccessToken` e persistencia de `refresh_token`/`token_expires_at`; chamadas autenticadas passaram a usar o getter.
- Impacto esperado: Evitar erros de "Token expirado" ao consumir endpoints autenticados.
