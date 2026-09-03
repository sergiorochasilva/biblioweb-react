# Design: contraparte de UI da integração OAuth 2.0/OIDC (`biblioweb-react`)

**Data:** 2026-08-10
**Branch:** `feature/oauth-ui-integration`
**Contexto:** `biblioweb-api` concluiu o backend OAuth2/OIDC em `feat/oauth-integration-api` (PR draft `info-biblioweb/biblioweb-api#1`, ainda não mergeado por depender exatamente deste trabalho). Nada no `biblioweb-api` é alterado por este design.

## 1. Escopo

Três frentes, todas neste repositório:

1. **Tela `/oauth/consent`** — fluxo completo de aprovar/negar um app parceiro pedindo acesso à conta BiblioWeb de um usuário. **Descoberta durante o brainstorming:** apesar do handoff (`docs/oauth-consent-screen-handoff.md`) descrever essa tela como já implementada e só precisando dos campos da Fase 9, uma varredura em `src/` (todas as branches) não encontrou nenhum arquivo OAuth existente — a tela nunca foi codificada. Confirmado com o usuário: construir do zero faz parte deste trabalho.
2. **Seção "Apps conectados"** dentro de `/profile` (área logada comum), para listar e revogar consentimentos já concedidos.
3. **Aba "Clients OAuth"** na área de administração (`AdminView.tsx`), CRUD de clients parceiros + rotação de segredo, sem nunca expor `client_secret` em texto puro.

**Fora do escopo** (confirmado com o usuário):
- Página pública `GET/POST /oauth-clients/secret-reveal` — continua servida como HTML estático simples pelo `biblioweb-api`, sem contraparte no React por ora.
- `private_key_jwt` (RFC 7523) — não implementado no backend, não afeta este trabalho.
- Qualquer UI que exiba `client_secret` em texto puro.
- Nada no `biblioweb-api`.

## 2. Discrepâncias resolvidas contra o backend real

Durante o brainstorming, o código de `biblioweb-api` (branch `feat/oauth-integration-api`) foi consultado como fonte de verdade sempre que documentação e prompt divergiam:

- **Formato de `already_granted_scopes`/`new_scopes` em `GET /oauth/authorize/requests/<id>`:** o handoff diz string espaço-separada; o prompt do usuário sugeria array. Confirmado em `fronesis/service/oauth_authorize_service.py:187-188` (`" ".join(sorted(...))`) que é **string espaço-separada** — o handoff está correto, o prompt estava impreciso nesse ponto.
- **Formato de `scopes` em `GET /oauth/consents`:** confirmado em `fronesis/dao/oauth_user_consent_dao.py:153` que é **array** de strings — igual ao que handoff e prompt já diziam.
- **`DELETE /oauth/consents/<client_id>`:** o prompt do usuário mencionava "responde 200"; o código real (`fronesis/controller/oauth_consent_controller.py`) responde **204 sem corpo** no sucesso e **404** quando não havia consentimento ativo (tratado como sucesso idempotente na UI, sem alarmar o usuário) — o handoff já descrevia esse comportamento corretamente.
- **`POST /oauth-clients/<id>/rotate-secret`:** o prompt sugeria resposta igual à de criação; o código real (`fronesis/controller/oauth_client_admin_controller.py:230-233`) devolve só `{ client_id, secret_reveal_url }`, sem o restante dos campos do client (que não mudam). A UI usa os dados já carregados na lista e só atualiza a exibição do `secret_reveal_url`.
- **Reativação de client desativado:** não existe endpoint para reverter `active: false` — `PUT /oauth-clients/<id>` (`update_mutable_fields`) nunca toca o campo `active`; só `DELETE` o desativa. Confirmado com o usuário: clients inativos ficam escondidos por padrão, com toggle "Mostrar inativos" que os revela em modo somente-leitura.
- **Scopes permitidos:** confirmado em `fronesis/oauth/scopes.py` — 11 valores fixos (`openid`, `profile`, `email`, `offline_access`, `biblioweb.profile.read`, `biblioweb.libraries.read`, `biblioweb.catalog.read`, `biblioweb.loans.read`, `biblioweb.loans.write`, `biblioweb.licenses.read`, `biblioweb.integration.read`) e 3 grant types (`authorization_code`, `refresh_token`, `client_credentials`). `biblioweb.integration.read` não está na tabela de tradução do handoff (seção 4) — será usado o código bruto como rótulo de fallback para qualquer escopo sem tradução amigável.

## 3. Peça compartilhada: tabela de tradução de escopos

`src/oauth/scopeLabels.ts` — mapa `Record<string, string>` com os rótulos da seção 4 do handoff, mais fallback (retorna o próprio código) para escopos sem entrada (hoje só `biblioweb.integration.read`). Usado pelas 3 frentes, evitando duplicação.

## 4. Frente 1 — Tela `/oauth/consent`

### 4.1 Arquivos novos
- `src/service/oauthConsentService.ts`: `getAuthorizeRequest(requestId, token)`, `approveAuthorizeRequest(requestId, token)`, `denyAuthorizeRequest(requestId, token)`, `listConsents(token)`, `revokeConsent(clientId, token)` — todos finos sobre `api.get/post/delete` (sem alterar `api.ts`).
- `src/view/OAuthConsentView.tsx`.

### 4.2 Rota
Adicionar em `App.tsx`, dentro do `<Route element={<ProtectedRoute />}>` já existente (mesmo bloco de `/profile`):
```tsx
<Route path="/oauth/consent" element={<OAuthConsentView />} />
```
`ProtectedRoute` já cuida do redirect `/login?next=...` e do retorno pós-login — nenhum código de guarda adicional é necessário.

### 4.3 Fluxo
1. `request_id` ausente na query string → tela de erro estática, sem chamar API.
2. `GET /oauth/authorize/requests/<id>` (via `getAuthorizeRequest`, Bearer do `AuthContext`):
   - `404` → tela de erro genérica ("link expirado ou já usado, peça pro app iniciar de novo").
   - `401` → tratado como erro + volta pro login (não deveria ocorrer sob `ProtectedRoute`).
3. Resposta ok → ramifica por `consent_required`/`already_granted_scopes` (seção 4.1 do handoff):
   - `consent_required === false` → estado "Conectando…" e chama `approve` automaticamente, sem esperar clique; segue o `redirect_uri` retornado. Único caso de navegação automática permitido.
   - `consent_required === true` e `already_granted_scopes` não vazio → "App X já está conectado e agora pede acesso a:", destaque visual em `new_scopes`; `already_granted_scopes` exibido como contexto secundário.
   - `consent_required === true` e `already_granted_scopes` vazio → tela padrão com `new_scopes` (equivalente a `scope`).
4. `scope`/`new_scopes`/`already_granted_scopes` chegam como string espaço-separada → `split(" ").filter(Boolean)` antes de traduzir via `scopeLabels.ts`. `openid` fica implícito, sem item de lista próprio.
5. Permitir/Negar → `POST .../approve` ou `.../deny` → `window.location.href = redirect_uri`. `404` nessas chamadas (expirou entre o GET e o clique) → mesma tela de erro genérica.

### 4.4 Estilo
`glass-card`/`glass-panel`, tokens de `src/styles/global.css`, consistente com `LoginView`/`PasswordLoginView` (seção 5.1 do `AGENTS.md`). Sem `HeaderView` — é uma tela de handoff curta entre o app parceiro e o login do BiblioWeb.

## 5. Frente 2 — "Apps conectados" em `/profile`

### 5.1 Onde
Validado com mockup no companion visual: novo `profile-block` no fim do `Card` já existente em `ProfileView.tsx`, condicionado ao mesmo `!isBooksOnlyView` que já esconde e-mail/bibliotecas/editoras — não aparece em `/meus-livros`.

### 5.2 Dados e comportamento
- Estado novo no hook/controller de `ProfileView` (mesmo padrão do resto do arquivo): `connectedApps`, `isLoadingConnectedApps`, `revokingClientId`. Carregado junto do resto do perfil via `listConsents()`.
- Cada item: `client_name`, badges de `scopes` (array, traduzido via `scopeLabels.ts`), `granted_at`/`updated_at`.
- **Fuso horário:** timestamps vêm sem `Z` (UTC cru). Helper centralizado `parseUtcTimestamp(value: string): Date` (`new Date(value + "Z")`), evitando espalhar esse detalhe pela view.
- Lista vazia → mesma frase padrão dos outros blocos ("Nenhum app conectado à sua conta.").
- Ação "Desconectar" por item → confirmação (`Modal.confirm`/`Popconfirm`, mesmo padrão de outras remoções do repo) avisando que o acesso é removido imediatamente e que reconectar exige nova autorização completa.
- Confirmado → `revokeConsent(clientId)`. `204` e `404` tratados como sucesso idempotente (sem alarmar o usuário); item removido da lista local sem reload de página.
- Erro de rede → `message.error`, mesmo padrão já usado no resto de `ProfileView`.

## 6. Frente 3 — Aba "Clients OAuth" no Admin

### 6.1 Onde
Nova aba em `AdminView.tsx`/`AdminController.ts` (chave `"oauth-clients"`), seguindo o padrão de Editoras (lista + busca + modal criar/editar).

### 6.2 Arquivo novo
`src/service/oauthClientAdminService.ts`: `listOAuthClients`, `getOAuthClient`, `createOAuthClient`, `updateOAuthClient`, `deactivateOAuthClient`, `rotateOAuthClientSecret` — sobre `api.get/post/put/delete`.

### 6.3 Estado no controller
`oauthClients`, `isLoadingOAuthClients`, `oauthClientSearch`, `oauthClientModalOpen/Mode/Form/Errors`, `showInactiveOAuthClients` (toggle), e `revealedSecretUrlByClientId: Record<string, string>` — efêmero, só em memória de sessão, nunca persistido nem re-buscável.

### 6.4 Listagem
- Por padrão mostra só `active: true` (filtro client-side, API não tem parâmetro de filtro).
- Toggle "Mostrar inativos" revela os `active: false`, sem botões de editar/rotacionar/desativar (não há endpoint de reativação).

### 6.5 Modal criar/editar
- `name`: texto.
- `redirect_uris`: lista dinâmica de inputs, com "+ Adicionar"/remover por linha.
- `grant_types`: checkboxes fixos (`authorization_code`, `refresh_token`, `client_credentials`).
- `scopes`: checkboxes fixos, com rótulo amigável de `scopeLabels.ts` ao lado do código técnico, cobrindo os 11 valores de `ALLOWED_SCOPES`.
- `is_confidential`: `Switch`.
- Erros de validação (400 — grant/scope inválido) exibidos no modal, mesmo padrão dos outros formulários administrativos.

### 6.6 Segredo — nunca em texto puro
- `POST` (criar) e `POST rotate-secret` devolvem `secret_reveal_url`. A UI guarda essa URL em `revealedSecretUrlByClientId[id]` e mostra, inline na linha daquele client, um trecho com o link + botão "Copiar" (`navigator.clipboard`) e aviso curto ("expira em 72h, abre uma única vez"). Some ao trocar de aba/navegar/dar reload — não fica salvo em nenhum estado persistente, e a API nunca devolve o segredo depois.
- Nenhuma tela busca ou exibe `client_secret` em texto puro em nenhum momento.

### 6.7 Desativar
`DELETE` com confirmação (`Popconfirm`), remove da lista de ativos (ou passa a aparecer como inativo, se o toggle estiver ligado).

## 7. Testes e validação

Seguindo `AGENTS.md` seções 6/6.1:
- `npm run build` e `npm run lint` obrigatórios.
- Validação manual mínima: fluxo completo de autorização (permitir/negar), reuso de consentimento (`consent_required: false`), ampliação de escopo, revogação em `/profile`, CRUD completo de clients no admin (incluindo rotação de segredo e o link de revelação sumindo ao navegar).
- Quando tocar login/perfil/admin, preferir validação integrada com stack real (seção 6.1 do `AGENTS.md`) se praticável.

## 8. Fora do escopo (reforço)

- `biblioweb-api` não é tocado.
- Página pública de revelação de segredo (fica como está, no backend).
- `private_key_jwt`.
- Exibição de `client_secret` em texto puro.
