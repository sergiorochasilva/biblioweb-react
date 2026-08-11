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
  - O selo e a ação `Ler versão web` da rota `/ebook/:id` precisam usar as mesmas regras de tipo e `html_version_url` da tela `/book/:id`.
  - A cobertura e2e que localiza o PostgreSQL deve reconhecer imagens `pgvector/pgvector`, usadas pela stack local.
- Evidencias:
  - `src/view/EbookMiniView.tsx`
  - `src/view/BookDetailsView.tsx`
  - `tests/e2e/ebook-mini-view.spec.ts`
  - `tests/e2e/support.ts`
- Acao aplicada:
  - Ação principal, selo de tipo e versão web do ebook passaram a seguir os tipos protegido, comprado, externo e gratuito; o e2e valida abertura das URLs externa e web após registro de acesso.
- Impacto esperado:
  - Links do OPALS para livros externos não passam pelo endpoint de compra e continuam registrando a leitura.
### 2026-08-10 - contraparte de UI OAuth2/OIDC (consent, apps conectados, admin clients)
- Descoberta:
  - O handoff `docs/oauth-consent-screen-handoff.md` descrevia a tela `/oauth/consent` como já implementada, mas nenhum código OAuth existia em `src/` — a tela precisou ser construída do zero, junto com a seção "Apps conectados" em `/profile` e a aba "Clients OAuth" no `/admin`.
  - `already_granted_scopes`/`new_scopes` de `GET /oauth/authorize/requests/<id>` são strings espaço-separadas (não array); `scopes` de `GET /oauth/consents` já é array — os dois formatos coexistem na mesma API e precisam de parsing distinto.
  - A API de `/oauth-clients` não tem endpoint de reativação — só desativa (`DELETE`); a UI admin reflete isso não oferecendo ação de reativar.
  - `AdminController.ts` cresceu de forma puramente aditiva (nova aba `oauth-clients`, novo form state, novas actions) sem tocar na lógica de publisher/permissions já existente.
- Evidencias:
  - src/view/OAuthConsentView.tsx
  - src/view/ProfileView.tsx
  - src/view/AdminView.tsx
  - src/controller/AdminController.ts
  - src/service/oauthConsentService.ts
  - src/service/oauthClientAdminService.ts
  - tests/e2e/oauth-consent.spec.ts, oauth-connected-apps.spec.ts, oauth-clients-admin.spec.ts
  - docs/superpowers/specs/2026-08-10-oauth-ui-integration-design.md (referida no handoff; caminho real no repo pode variar)
- Acao aplicada:
  - Implementadas as 3 frentes de UI OAuth2/OIDC (consent, apps conectados, admin clients), com testes e2e cobrindo os fluxos principais e validação final via suite completa (`npm run test:e2e:playwright`, 23 specs) contra a stack real — sem regressão nas partes tocadas pela branch.
- Impacto esperado:
  - `biblioweb-api` PR `info-biblioweb/biblioweb-api#1` deixa de estar bloqueado pela contraparte de UI.
  - Padrão de streaming SSE do bibliotecário (recorrente em múltiplas entradas antigas) foi consolidado em `AGENTS.md` (seção 6.4) nesta varredura, então deixou de precisar de registro avulso aqui.
