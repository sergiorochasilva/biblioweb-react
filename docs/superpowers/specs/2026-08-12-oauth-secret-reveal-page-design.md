# Design: página pública `/oauth-clients/secret-reveal` (fase 2)

**Data:** 2026-08-12
**Branch:** `feature/oauth-ui-integration` (continuação da fase 1, mesmo squash final combinado)
**Contexto:** fase 1 (spec `docs/superpowers/specs/2026-08-10-oauth-ui-integration-design.md`) implementou as 3 telas autenticadas da integração OAuth2/OIDC e deixou a página pública de revelação de segredo como opcional/fora de escopo. Esta é a fase 2: construir essa página no `biblioweb-react`, substituindo a página HTML estática hoje servida pelo `biblioweb-api`.

## 1. Pré-requisito resolvido no `biblioweb-api`

O `secret_reveal_url` devolvido por `POST /oauth-clients` e `POST /oauth-clients/<id>/rotate-secret` era montado a partir de `OAUTH_ISSUER` (identidade do emissor OIDC, correta ficar no domínio da API) em vez de `APP_PUBLIC_URL` (domínio do front, como já fazia `OAUTH_CONSENT_URL`). Isso foi corrigido em outra sessão trabalhando no `biblioweb-api`: nova constante `OAUTH_SECRET_REVEAL_URL` em `settings.py`, derivada de `APP_PUBLIC_URL`/`APP_BASE_URL`, usada nos dois pontos de `oauth_client_admin_controller.py`. Verificado end-to-end (após restart do container pra recarregar o código): `secret_reveal_url` agora aponta para o domínio do front. Nenhuma mudança adicional no `biblioweb-api` faz parte deste trabalho.

Nota lateral (não bloqueante, decisão já aceita): a correção removeu o fail-fast de produção que exigia `OAUTH_CONSENT_URL` explícito, estendendo o mesmo tratamento "sem fail-fast" para `OAUTH_SECRET_REVEAL_URL` — decisão tomada e documentada na outra sessão, fora do escopo deste trabalho.

## 2. Escopo

Uma página nova, pública, sem autenticação:

- **Rota:** `/oauth-clients/secret-reveal`, fora de `ProtectedRoute`, mesmo nível de `/login` em `App.tsx`.
- **Token:** vem no **fragmento** da URL (`#<token>`, via `window.location.hash`), nunca da query string — isso é proposital no backend (não aparece em log de acesso de proxy/servidor).

### Fluxo

1. Ao montar, extrai o token do fragmento. Ausente → tela de erro estática ("Link inválido."), sem chamar a API.
2. Estado inicial: nome genérico da ação ("Revelar segredo de client OAuth"), aviso de uso único, botão **"Revelar segredo"**. Nenhuma chamada à API até o clique — mantém a garantia documentada de que um `GET` simples na rota não tem efeito colateral (evita que pré-fetchers de e-mail/chat queimem o link).
3. Clique → `POST /oauth-clients/secret-reveal` com corpo `{"token": "<token>"}`, **sem** header de autenticação (rota pública, protegida só pela posse do token de alta entropia).
4. Sucesso (`200 { "client_secret": "..." }`) → mostra o segredo em texto selecionável com botão "Copiar", aviso forte de que é a única vez que aparece. Fica visível indefinidamente (até o parceiro navegar ou fechar a aba) — sem timer de ocultação automática.
5. Erro (`404`) → mensagem genérica única, cobrindo os três casos que a API não distingue de propósito (token inválido, expirado, ou já revelado antes): "Este link de revelação é inválido, expirou ou já foi usado. Peça ao administrador do BiblioWeb para rotacionar o segredo novamente."

### Arquivos

- **Criar:** `src/view/OAuthSecretRevealView.tsx` — reaproveita `AuthLayout` (mesmo componente/visual de `LoginView`/`PasswordLoginView`), sem `HeaderView`.
- **Modificar:** `src/service/oauthClientAdminService.ts` — adiciona `revealOAuthClientSecret(token: string): Promise<{ client_secret: string }>`, via `api.post("/oauth-clients/secret-reveal", { token })` (sem token de auth — `api.post`'s terceiro parâmetro fica `undefined`).
- **Modificar:** `src/model/OAuthClient.ts` — tipo `OAuthClientSecretRevealPayload` (`{ client_secret: string }`), se ainda não coberto por tipo existente.
- **Modificar:** `App.tsx` — nova rota pública, fora de `ProtectedRoute`.

### Fora do escopo

- Qualquer mudança no `biblioweb-api` além da já feita (pré-requisito, seção 1).
- Remover a página estática atual do backend — decisão de quem mantém aquele repositório, não deste trabalho.
- `private_key_jwt` — evolução futura, fora de escopo.
