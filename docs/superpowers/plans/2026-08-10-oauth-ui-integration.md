# OAuth2/OIDC UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `biblioweb-react` counterpart of the `biblioweb-api` OAuth2/OIDC integration: the `/oauth/consent` screen (built from scratch), a "connected apps" section in `/profile`, and an "OAuth Clients" admin tab.

**Architecture:** Three independent UI features sharing one scope-translation module (`src/model/OAuthScopes.ts`) and two thin services (`src/service/oauthConsentService.ts`, `src/service/oauthClientAdminService.ts`) built directly on the existing `api.ts` helper. Each feature follows an established pattern already in the repo: `/oauth/consent` mirrors `LoginView`/`AuthLayout`; the connected-apps section extends `ProfileView.tsx`'s existing local-state pattern; the admin tab extends `AdminController.ts`/`AdminView.tsx`'s existing per-resource CRUD pattern (mirroring the "Editoras" tab).

**Tech Stack:** React + TypeScript + Vite, Ant Design (antd), React Router, Playwright for e2e.

## Global Constraints

- Nothing in `biblioweb-api` is touched. This plan only changes `biblioweb-react`.
- `client_secret` in plaintext is never fetched or displayed anywhere in this codebase — only `secret_reveal_url` is ever shown, and only inline/ephemeral (never persisted, never re-fetchable).
- `already_granted_scopes`/`new_scopes` from `GET /oauth/authorize/requests/<id>` are **space-separated strings** (confirmed in `biblioweb-api` `fronesis/service/oauth_authorize_service.py:187-188`) — parse with `.split(" ")`, not as an array.
- `scopes` from `GET /oauth/consents` is already an **array** (confirmed in `biblioweb-api` `fronesis/dao/oauth_user_consent_dao.py:153`).
- `granted_at`/`updated_at` timestamps have no timezone suffix and must be treated as UTC (`new Date(value + "Z")`), never as local time.
- `DELETE /oauth/consents/<client_id>` returns `204` on success or `404` when nothing was connected — both must be treated as success in the UI (idempotent revoke, no alarming error).
- Every new/changed function needs JSDoc (params + return), per `AGENTS.md` section 4.
- `npm run build` and `npm run lint` must pass before this work is considered done (`AGENTS.md` section 6).
- Follow existing patterns: `api.ts` for all HTTP calls, `glass-card`/`glass-panel` styling tokens from `src/styles/global.css`, JSX/state conventions already used in `ProfileView.tsx` and `AdminController.ts`/`AdminView.tsx`.

---

## File Structure

New files:
- `src/model/OAuthScopes.ts` — allowed scopes/grant types + friendly-label translation, shared by all three features.
- `src/model/OAuthConsent.ts` — TS types for the consent screen and connected-apps list.
- `src/model/OAuthClient.ts` — TS types for the admin OAuth-clients CRUD.
- `src/service/oauthConsentService.ts` — `GET/POST /oauth/authorize/requests/*`, `GET/DELETE /oauth/consents*`.
- `src/service/oauthClientAdminService.ts` — `GET/POST/PUT/DELETE /oauth-clients*`, `POST /oauth-clients/<id>/rotate-secret`.
- `src/view/OAuthConsentView.tsx` — the `/oauth/consent` screen.
- `src/styles/OAuthConsentView.css` — styles specific to the consent screen.
- `tests/e2e/oauth-consent.spec.ts`, `tests/e2e/oauth-connected-apps.spec.ts`, `tests/e2e/oauth-clients-admin.spec.ts`.

Modified files:
- `src/App.tsx` — new protected route `/oauth/consent`.
- `src/view/ProfileView.tsx` — new "Apps conectados" section.
- `src/styles/ProfileView.css` — styles for the connected-apps cards.
- `src/controller/AdminController.ts` — new `oauth-clients` tab state/actions.
- `src/view/AdminView.tsx` — new `oauth-clients` tab UI + modal.
- `src/styles/AdminView.css` — styles for the OAuth-clients form/list.
- `tests/e2e/support.ts` — new API helpers (`createOAuthClientApi`, `deactivateOAuthClientApi`, `buildOAuthAuthorizeUrl`).

---

### Task 1: Scope/grant model shared by all three features

**Files:**
- Create: `src/model/OAuthScopes.ts`

**Interfaces:**
- Produces: `ALLOWED_OAUTH_SCOPES: readonly string[]`, `OAuthScope` (union type), `ALLOWED_OAUTH_GRANT_TYPES: readonly string[]`, `OAuthGrantType` (union type), `translateOAuthScope(scope: string): string`, `parseScopeString(value: string): string[]` — used by Tasks 4, 6, 8, 9.

- [ ] **Step 1: Write the file**

```ts
/**
 * Escopos e grant types OAuth2/OIDC permitidos, espelhando
 * `fronesis/oauth/scopes.py` do `biblioweb-api` (ALLOWED_SCOPES /
 * ALLOWED_GRANT_TYPES).
 */

export const ALLOWED_OAUTH_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "biblioweb.profile.read",
    "biblioweb.libraries.read",
    "biblioweb.catalog.read",
    "biblioweb.loans.read",
    "biblioweb.loans.write",
    "biblioweb.licenses.read",
    "biblioweb.integration.read",
] as const;

export type OAuthScope = (typeof ALLOWED_OAUTH_SCOPES)[number];

export const ALLOWED_OAUTH_GRANT_TYPES = [
    "authorization_code",
    "refresh_token",
    "client_credentials",
] as const;

export type OAuthGrantType = (typeof ALLOWED_OAUTH_GRANT_TYPES)[number];

const OAUTH_SCOPE_LABELS: Record<string, string> = {
    openid: "Confirmar sua identidade",
    profile: "Ver seu nome",
    email: "Ver seu e-mail",
    offline_access: "Continuar conectado sem precisar logar de novo",
    "biblioweb.profile.read": "Ver seu perfil BiblioWeb",
    "biblioweb.libraries.read": "Ver as bibliotecas às quais você tem acesso",
    "biblioweb.catalog.read": "Ver o catálogo das suas bibliotecas",
    "biblioweb.loans.read": "Ver seus empréstimos",
    "biblioweb.loans.write": "Criar e devolver empréstimos em seu nome",
    "biblioweb.licenses.read": "Baixar licenças dos seus empréstimos",
};

/**
 * Traduz um código de escopo OAuth para um texto amigável.
 *
 * Escopos sem tradução (ex: `biblioweb.integration.read`, que não está
 * na tabela de tradução do handoff) caem no fallback: o próprio código.
 *
 * @param scope Código do escopo (ex: "biblioweb.loans.read").
 * @returns Texto amigável, ou o próprio código quando não houver tradução.
 */
export function translateOAuthScope(scope: string): string {
    return OAUTH_SCOPE_LABELS[scope] || scope;
}

/**
 * Converte uma string de escopos separados por espaço em uma lista.
 *
 * @param value String bruta vinda da API (ex: "openid biblioweb.profile.read").
 * @returns Lista de códigos de escopo, sem entradas vazias.
 */
export function parseScopeString(value: string): string[] {
    return value
        .split(" ")
        .map((item) => item.trim())
        .filter(Boolean);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors referencing `OAuthScopes.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/model/OAuthScopes.ts
git commit -m "feat(oauth): add shared scope/grant-type model and label translation"
```

---

### Task 2: Consent/connected-apps types and service

**Files:**
- Create: `src/model/OAuthConsent.ts`
- Create: `src/service/oauthConsentService.ts`

**Interfaces:**
- Consumes: `api` from `src/service/api.ts` (`api.get/post/delete<T>(endpoint, token)`).
- Produces: `getAuthorizeRequest(requestId, token): Promise<OAuthAuthorizeRequestInfo>`, `approveAuthorizeRequest(requestId, token): Promise<OAuthAuthorizeDecisionResponse>`, `denyAuthorizeRequest(requestId, token): Promise<OAuthAuthorizeDecisionResponse>`, `listConsents(token): Promise<OAuthConnectedApp[]>`, `revokeConsent(clientId, token): Promise<void>` — used by Tasks 4, 6.

- [ ] **Step 1: Write the types file**

`src/model/OAuthConsent.ts`:

```ts
/**
 * Resposta de `GET /oauth/authorize/requests/<id>`. `scope`,
 * `already_granted_scopes` e `new_scopes` são strings de escopos
 * separados por espaço — usar `parseScopeString` (OAuthScopes.ts) para
 * converter em lista.
 */
export type OAuthAuthorizeRequestInfo = {
    client_id: string;
    client_name: string | null;
    scope: string;
    consent_required: boolean;
    already_granted_scopes: string;
    new_scopes: string;
};

export type OAuthAuthorizeDecisionResponse = {
    redirect_uri: string;
};

/** Item de `GET /oauth/consents`. `scopes` já vem como lista (array). */
export type OAuthConnectedApp = {
    client_id: string;
    client_name: string;
    scopes: string[];
    granted_at: string;
    updated_at: string;
};

export type OAuthConsentsListResponse = {
    items: OAuthConnectedApp[];
};
```

- [ ] **Step 2: Write the service file**

`src/service/oauthConsentService.ts`:

```ts
import { api } from "./api";
import {
    OAuthAuthorizeDecisionResponse,
    OAuthAuthorizeRequestInfo,
    OAuthConnectedApp,
    OAuthConsentsListResponse,
} from "../model/OAuthConsent";

/**
 * Busca os dados de uma solicitação de autorização OAuth pendente.
 *
 * @param requestId Identificador da solicitação (query `request_id`).
 * @param token Token JWT de login normal do BiblioWeb (nunca token OAuth).
 * @returns Dados do client, escopos pedidos e estado de consentimento.
 */
export async function getAuthorizeRequest(
    requestId: string,
    token: string
): Promise<OAuthAuthorizeRequestInfo> {
    return api.get<OAuthAuthorizeRequestInfo>(
        `/oauth/authorize/requests/${encodeURIComponent(requestId)}`,
        token
    );
}

/**
 * Aprova uma solicitação de autorização OAuth pendente.
 *
 * @param requestId Identificador da solicitação.
 * @param token Token JWT de login normal do BiblioWeb.
 * @returns URL de redirecionamento para o app parceiro.
 */
export async function approveAuthorizeRequest(
    requestId: string,
    token: string
): Promise<OAuthAuthorizeDecisionResponse> {
    return api.post<OAuthAuthorizeDecisionResponse>(
        `/oauth/authorize/requests/${encodeURIComponent(requestId)}/approve`,
        {},
        token
    );
}

/**
 * Nega uma solicitação de autorização OAuth pendente.
 *
 * @param requestId Identificador da solicitação.
 * @param token Token JWT de login normal do BiblioWeb.
 * @returns URL de redirecionamento para o app parceiro.
 */
export async function denyAuthorizeRequest(
    requestId: string,
    token: string
): Promise<OAuthAuthorizeDecisionResponse> {
    return api.post<OAuthAuthorizeDecisionResponse>(
        `/oauth/authorize/requests/${encodeURIComponent(requestId)}/deny`,
        {},
        token
    );
}

/**
 * Lista os apps parceiros que o usuário autenticado já autorizou.
 *
 * @param token Token JWT de login normal do BiblioWeb.
 * @returns Lista de apps conectados com escopos e datas.
 */
export async function listConsents(token: string): Promise<OAuthConnectedApp[]> {
    const response = await api.get<OAuthConsentsListResponse>("/oauth/consents", token);
    return response.items || [];
}

/**
 * Revoga o consentimento de um app parceiro para o usuário autenticado.
 *
 * `404` (nenhum consentimento ativo para este client) é tratado como
 * sucesso idempotente — o resultado desejado já vale.
 *
 * @param clientId Identificador do client a desconectar.
 * @param token Token JWT de login normal do BiblioWeb.
 * @returns Promise<void>.
 */
export async function revokeConsent(clientId: string, token: string): Promise<void> {
    try {
        await api.delete(`/oauth/consents/${encodeURIComponent(clientId)}`, token);
    } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
            return;
        }
        throw error;
    }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors referencing `OAuthConsent.ts` or `oauthConsentService.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/model/OAuthConsent.ts src/service/oauthConsentService.ts
git commit -m "feat(oauth): add consent/connected-apps types and service"
```

---

### Task 3: OAuth-client admin types and service

**Files:**
- Create: `src/model/OAuthClient.ts`
- Create: `src/service/oauthClientAdminService.ts`

**Interfaces:**
- Consumes: `api` from `src/service/api.ts`; `OAuthGrantType`, `OAuthScope` from Task 1's `src/model/OAuthScopes.ts`.
- Produces: `OAuthClient`, `OAuthClientCreatePayload`, `OAuthClientCreateResponse` types; `listOAuthClients(token)`, `createOAuthClient(token, payload)`, `updateOAuthClient(token, clientId, payload)`, `deactivateOAuthClient(token, clientId)`, `rotateOAuthClientSecret(token, clientId)` — used by Tasks 8, 9.

- [ ] **Step 1: Write the types file**

`src/model/OAuthClient.ts`:

```ts
import { OAuthGrantType, OAuthScope } from "./OAuthScopes";

/** Client OAuth tal como devolvido pela API administrativa (sem segredo). */
export type OAuthClient = {
    id: string;
    name: string;
    redirect_uris: string[];
    grant_types: string[];
    scopes: string[];
    is_confidential: boolean;
    active: boolean;
    created_at: string | null;
};

export type OAuthClientListResponse = {
    items: OAuthClient[];
};

export type OAuthClientCreatePayload = {
    name: string;
    redirect_uris: string[];
    grant_types: OAuthGrantType[];
    scopes: OAuthScope[];
    is_confidential: boolean;
};

export type OAuthClientUpdatePayload = OAuthClientCreatePayload;

/** `client_secret` nunca aparece aqui — só o link de revelação única. */
export type OAuthClientSecretRevealResponse = {
    secret_reveal_url: string;
};

export type OAuthClientCreateResponse = OAuthClient & OAuthClientSecretRevealResponse;
```

- [ ] **Step 2: Write the service file**

`src/service/oauthClientAdminService.ts`:

```ts
import { api } from "./api";
import {
    OAuthClient,
    OAuthClientCreatePayload,
    OAuthClientCreateResponse,
    OAuthClientListResponse,
    OAuthClientSecretRevealResponse,
    OAuthClientUpdatePayload,
} from "../model/OAuthClient";

/**
 * Lista todos os clients OAuth cadastrados (ativos e inativos).
 *
 * @param token Token JWT de administrador global (`admin=true`).
 * @returns Lista completa de clients.
 */
export async function listOAuthClients(token: string): Promise<OAuthClient[]> {
    const response = await api.get<OAuthClientListResponse>("/oauth-clients", token);
    return response.items || [];
}

/**
 * Cria um novo client OAuth.
 *
 * @param token Token JWT de administrador global.
 * @param payload Dados do client a criar.
 * @returns Client criado e o link de revelação única do segredo.
 */
export async function createOAuthClient(
    token: string,
    payload: OAuthClientCreatePayload
): Promise<OAuthClientCreateResponse> {
    return api.post<OAuthClientCreateResponse>("/oauth-clients", payload, token);
}

/**
 * Atualiza os campos editáveis de um client OAuth existente.
 *
 * @param token Token JWT de administrador global.
 * @param clientId Identificador do client.
 * @param payload Novos valores dos campos editáveis.
 * @returns Client atualizado.
 */
export async function updateOAuthClient(
    token: string,
    clientId: string,
    payload: OAuthClientUpdatePayload
): Promise<OAuthClient> {
    return api.put<OAuthClient>(`/oauth-clients/${encodeURIComponent(clientId)}`, payload, token);
}

/**
 * Desativa um client OAuth (remoção lógica; não há endpoint de reversão).
 *
 * @param token Token JWT de administrador global.
 * @param clientId Identificador do client.
 * @returns Promise<void>.
 */
export async function deactivateOAuthClient(token: string, clientId: string): Promise<void> {
    await api.delete(`/oauth-clients/${encodeURIComponent(clientId)}`, token);
}

/**
 * Gera um novo `client_secret` para um client existente, invalidando o
 * anterior imediatamente.
 *
 * @param token Token JWT de administrador global.
 * @param clientId Identificador do client.
 * @returns Link de revelação única do novo segredo.
 */
export async function rotateOAuthClientSecret(
    token: string,
    clientId: string
): Promise<OAuthClientSecretRevealResponse> {
    return api.post<OAuthClientSecretRevealResponse>(
        `/oauth-clients/${encodeURIComponent(clientId)}/rotate-secret`,
        {},
        token
    );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors referencing `OAuthClient.ts` or `oauthClientAdminService.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/model/OAuthClient.ts src/service/oauthClientAdminService.ts
git commit -m "feat(oauth): add admin OAuth-client types and service"
```

---

### Task 4: `/oauth/consent` screen

**Files:**
- Create: `src/view/OAuthConsentView.tsx`
- Create: `src/styles/OAuthConsentView.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`getAccessToken`) from `src/contexts/useAuth.ts`; `getErrorMessage` from `src/service/errorMessage.ts`; `getAuthorizeRequest/approveAuthorizeRequest/denyAuthorizeRequest` (Task 2); `parseScopeString/translateOAuthScope` (Task 1); `AuthLayout` from `src/components/AuthLayout.tsx`.
- Produces: `OAuthConsentView` default export, mounted at route `/oauth/consent`.

- [ ] **Step 1: Write the view**

`src/view/OAuthConsentView.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Spin, Tag, Typography } from "antd";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../contexts/useAuth";
import { getErrorMessage } from "../service/errorMessage";
import {
    approveAuthorizeRequest,
    denyAuthorizeRequest,
    getAuthorizeRequest,
} from "../service/oauthConsentService";
import { OAuthAuthorizeRequestInfo } from "../model/OAuthConsent";
import { parseScopeString, translateOAuthScope } from "../model/OAuthScopes";
import "../styles/OAuthConsentView.css";

const GENERIC_EXPIRED_MESSAGE =
    "Este link de autorização expirou ou já foi usado. Peça para o aplicativo iniciar o processo novamente.";

type ViewState =
    | { status: "missing_request_id" }
    | { status: "loading" }
    | { status: "auto_approving" }
    | { status: "deciding" }
    | { status: "error"; message: string }
    | { status: "ready"; info: OAuthAuthorizeRequestInfo };

/**
 * Tela de consentimento OAuth2/OIDC: recebe `request_id` via query string
 * (redirecionado pelo `biblioweb-api`) e conduz aprovar/negar um app
 * parceiro que pede acesso à conta BiblioWeb do usuário logado.
 *
 * Rota protegida por `ProtectedRoute` — usuário não autenticado já é
 * redirecionado para `/login?next=...` antes deste componente montar.
 *
 * @returns Componente da tela de consentimento.
 */
export default function OAuthConsentView() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { getAccessToken } = useAuth();
    const requestId = searchParams.get("request_id");
    const [viewState, setViewState] = useState<ViewState>(
        requestId ? { status: "loading" } : { status: "missing_request_id" }
    );

    /**
     * Navega o navegador (fora do SPA) para o `redirect_uri` do app parceiro.
     *
     * @param redirectUri URL de callback do app parceiro.
     * @returns void.
     */
    const redirectToPartner = useCallback((redirectUri: string): void => {
        window.location.href = redirectUri;
    }, []);

    const loadRequest = useCallback(async (): Promise<void> => {
        if (!requestId) {
            return;
        }

        try {
            const token = await getAccessToken();
            if (!token) {
                navigate(
                    `/login?next=${encodeURIComponent(`/oauth/consent?request_id=${requestId}`)}`
                );
                return;
            }

            const info = await getAuthorizeRequest(requestId, token);

            if (!info.consent_required) {
                setViewState({ status: "auto_approving" });
                const decision = await approveAuthorizeRequest(requestId, token);
                redirectToPartner(decision.redirect_uri);
                return;
            }

            setViewState({ status: "ready", info });
        } catch (error) {
            setViewState({
                status: "error",
                message: getErrorMessage(error, GENERIC_EXPIRED_MESSAGE),
            });
        }
    }, [getAccessToken, navigate, redirectToPartner, requestId]);

    useEffect(() => {
        void loadRequest();
    }, [loadRequest]);

    /**
     * Envia a decisão do usuário (permitir/negar) e segue o redirecionamento
     * retornado pela API.
     *
     * @param decision `"approve"` ou `"deny"`.
     * @returns Promise<void>.
     */
    async function handleDecision(decision: "approve" | "deny"): Promise<void> {
        if (!requestId) {
            return;
        }

        setViewState({ status: "deciding" });
        try {
            const token = await getAccessToken();
            if (!token) {
                navigate(
                    `/login?next=${encodeURIComponent(`/oauth/consent?request_id=${requestId}`)}`
                );
                return;
            }

            const response =
                decision === "approve"
                    ? await approveAuthorizeRequest(requestId, token)
                    : await denyAuthorizeRequest(requestId, token);
            redirectToPartner(response.redirect_uri);
        } catch (error) {
            setViewState({
                status: "error",
                message: getErrorMessage(error, GENERIC_EXPIRED_MESSAGE),
            });
        }
    }

    if (viewState.status === "missing_request_id") {
        return (
            <AuthLayout title="Autorização inválida">
                <Alert
                    type="error"
                    showIcon
                    message="Link de autorização incompleto. Peça para o aplicativo iniciar o processo novamente."
                />
            </AuthLayout>
        );
    }

    if (viewState.status === "loading" || viewState.status === "deciding") {
        return (
            <AuthLayout title="Autorização">
                <div className="oauth-consent-loading">
                    <Spin size="large" />
                </div>
            </AuthLayout>
        );
    }

    if (viewState.status === "auto_approving") {
        return (
            <AuthLayout title="Conectando…">
                <div className="oauth-consent-loading">
                    <Spin size="large" />
                    <Typography.Text>Conectando ao aplicativo…</Typography.Text>
                </div>
            </AuthLayout>
        );
    }

    if (viewState.status === "error") {
        return (
            <AuthLayout title="Autorização indisponível">
                <Alert type="error" showIcon message={viewState.message} />
            </AuthLayout>
        );
    }

    const { info } = viewState;
    const newScopes = parseScopeString(info.new_scopes).filter((scope) => scope !== "openid");
    const alreadyGrantedScopes = parseScopeString(info.already_granted_scopes).filter(
        (scope) => scope !== "openid"
    );
    const isScopeUpgrade = alreadyGrantedScopes.length > 0;
    const clientName = info.client_name || "Um aplicativo parceiro";

    return (
        <AuthLayout
            title={isScopeUpgrade ? `${clientName} já está conectado` : "Autorizar aplicativo"}
            subtitle={
                isScopeUpgrade
                    ? `${clientName} está pedindo acesso a permissões adicionais:`
                    : `${clientName} quer acessar sua conta BiblioWeb:`
            }
        >
            <div className="oauth-scope-list">
                {newScopes.map((scope) => (
                    <Tag key={scope} color="blue" className="oauth-scope-item">
                        {translateOAuthScope(scope)}
                    </Tag>
                ))}
            </div>

            {isScopeUpgrade && (
                <div className="oauth-secondary-scopes">
                    <Typography.Text type="secondary">
                        Você já havia autorizado:{" "}
                        {alreadyGrantedScopes.map((scope) => translateOAuthScope(scope)).join(", ")}
                    </Typography.Text>
                </div>
            )}

            <div className="oauth-consent-actions">
                <Button onClick={() => void handleDecision("deny")}>Negar</Button>
                <Button type="primary" onClick={() => void handleDecision("approve")}>
                    Permitir
                </Button>
            </div>
        </AuthLayout>
    );
}
```

- [ ] **Step 2: Write the stylesheet**

`src/styles/OAuthConsentView.css`:

```css
.oauth-consent-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 160px;
}

.oauth-scope-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0;
}

.oauth-scope-item {
    font-size: 13px;
    padding: 4px 10px;
}

.oauth-secondary-scopes {
    margin-bottom: 16px;
}

.oauth-consent-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
}
```

- [ ] **Step 3: Wire the route**

In `src/App.tsx`, add the import next to the other view imports:

```tsx
import OAuthConsentView from "./view/OAuthConsentView";
```

(insert after `import ProfileView from "./view/ProfileView";`)

Then add the route inside the existing `<Route element={<ProtectedRoute />}>` block, next to `/profile`:

```tsx
                <Route path="/profile" element={<ProfileView />} />
                <Route path="/meus-livros" element={<ProfileView />} />
                <Route path="/oauth/consent" element={<OAuthConsentView />} />
```

(replace the two existing lines with these three, inside the `<Route element={<ProtectedRoute />}>` block)

- [ ] **Step 4: Verify it builds and lints**

Run: `npm run build && npm run lint`
Expected: both succeed with no new errors.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, then open `http://127.0.0.2:5173/oauth/consent` (no `request_id`) while logged out.
Expected: redirected to `/login?next=...`; after logging in, redirected back to `/oauth/consent` showing "Link de autorização incompleto..." (since there's no `request_id`).

- [ ] **Step 6: Commit**

```bash
git add src/view/OAuthConsentView.tsx src/styles/OAuthConsentView.css src/App.tsx
git commit -m "feat(oauth): build the /oauth/consent authorization screen"
```

---

### Task 5: e2e coverage for the consent flow

**Files:**
- Modify: `tests/e2e/support.ts`
- Create: `tests/e2e/oauth-consent.spec.ts`

**Interfaces:**
- Consumes: `API_BASE_URL`, `FRONT_BASE_URL`, `loginAsAdminApi`, `createTestUser`, `deleteUser`, `loginWithPassword` (all already in `support.ts`).
- Produces: `createOAuthClientApi(request, token, overrides?)`, `deactivateOAuthClientApi(request, token, clientId)`, `buildOAuthAuthorizeUrl(clientId, redirectUri, scope)` — reused by Tasks 7 and 10.

- [ ] **Step 1: Add API helpers to `support.ts`**

Add these functions to `tests/e2e/support.ts`, right after the existing `createPublisher` function (before `async function fetchFirstIdFromCollection`):

```ts
/**
 * Cria um client OAuth de teste via API administrativa.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param overrides Campos para sobrescrever os valores padrão do client.
 * @returns Client criado, incluindo `id` e `secret_reveal_url`.
 */
export async function createOAuthClientApi(
    request: APIRequestContext,
    token: string,
    overrides: {
        name?: string;
        redirect_uris?: string[];
        grant_types?: string[];
        scopes?: string[];
        is_confidential?: boolean;
    } = {}
): Promise<{ id: string; name: string; secret_reveal_url: string }> {
    const response = await request.post(`${API_BASE_URL}/oauth-clients`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        data: {
            name: overrides.name || `E2E OAuth Client ${randomUUID()}`,
            redirect_uris: overrides.redirect_uris || [`${FRONT_BASE_URL}/oauth-test-callback`],
            grant_types: overrides.grant_types || ["authorization_code", "refresh_token"],
            scopes: overrides.scopes || ["openid", "biblioweb.profile.read"],
            is_confidential: overrides.is_confidential ?? true,
        },
    });

    expect(response.ok()).toBeTruthy();
    return (await response.json()) as { id: string; name: string; secret_reveal_url: string };
}

/**
 * Desativa um client OAuth de teste via API administrativa.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param clientId Identificador do client a desativar.
 * @returns void
 */
export async function deactivateOAuthClientApi(
    request: APIRequestContext,
    token: string,
    clientId: string
): Promise<void> {
    const response = await request.delete(
        `${API_BASE_URL}/oauth-clients/${encodeURIComponent(clientId)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    expect([204, 404]).toContain(response.status());
}

/**
 * Monta a URL de início do fluxo `GET /oauth/authorize` para um client de teste.
 *
 * @param clientId Identificador público do client.
 * @param redirectUri URI de callback registrada no client.
 * @param scope Escopos pedidos, separados por espaço (deve incluir "openid").
 * @returns URL absoluta do endpoint `/oauth/authorize` na API.
 */
export function buildOAuthAuthorizeUrl(
    clientId: string,
    redirectUri: string,
    scope: string
): string {
    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state: randomUUID().replace(/-/g, ""),
        nonce: randomUUID().replace(/-/g, ""),
        code_challenge: randomUUID().replace(/-/g, ""),
        code_challenge_method: "S256",
    });
    return `${API_BASE_URL}/oauth/authorize?${params.toString()}`;
}
```

- [ ] **Step 2: Write the spec**

`tests/e2e/oauth-consent.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
    FRONT_BASE_URL,
    buildOAuthAuthorizeUrl,
    createOAuthClientApi,
    createTestUser,
    deactivateOAuthClientApi,
    deleteUser,
    loginAsAdminApi,
    loginWithPassword,
} from "./support";

const TEST_REDIRECT_URI = `${FRONT_BASE_URL}/oauth-test-callback`;

test.describe.serial("Fluxo de consentimento OAuth", () => {
    test("usuário aprova um app parceiro pela primeira vez e é redirecionado com o code", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid", "biblioweb.profile.read"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);

            const authorizeUrl = buildOAuthAuthorizeUrl(
                client.id,
                TEST_REDIRECT_URI,
                "openid biblioweb.profile.read"
            );
            await page.goto(authorizeUrl);

            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);
            await expect(page.getByText(client.name)).toBeVisible();
            await expect(page.getByText("Ver seu perfil BiblioWeb")).toBeVisible();

            await Promise.all([
                page.waitForURL(/oauth-test-callback\?/),
                page.getByRole("button", { name: "Permitir" }).click(),
            ]);

            const finalUrl = new URL(page.url());
            expect(finalUrl.searchParams.get("code")).toBeTruthy();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });

    test("usuário nega um app parceiro e é redirecionado com access_denied", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);

            const authorizeUrl = buildOAuthAuthorizeUrl(client.id, TEST_REDIRECT_URI, "openid");
            await page.goto(authorizeUrl);
            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);

            await Promise.all([
                page.waitForURL(/oauth-test-callback\?/),
                page.getByRole("button", { name: "Negar" }).click(),
            ]);

            const finalUrl = new URL(page.url());
            expect(finalUrl.searchParams.get("error")).toBe("access_denied");
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });

    test("segunda autorização com mesmo escopo pula a tela; escopo maior mostra só o delta", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid", "biblioweb.profile.read", "biblioweb.loans.write"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);

            const firstAuthorizeUrl = buildOAuthAuthorizeUrl(
                client.id,
                TEST_REDIRECT_URI,
                "openid biblioweb.profile.read"
            );
            await page.goto(firstAuthorizeUrl);
            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);
            await Promise.all([
                page.waitForURL(/oauth-test-callback\?/),
                page.getByRole("button", { name: "Permitir" }).click(),
            ]);

            const sameScopeUrl = buildOAuthAuthorizeUrl(
                client.id,
                TEST_REDIRECT_URI,
                "openid biblioweb.profile.read"
            );
            await page.goto(sameScopeUrl);
            await page.waitForURL(/oauth-test-callback\?/);
            const skippedUrl = new URL(page.url());
            expect(skippedUrl.searchParams.get("code")).toBeTruthy();

            const upgradedScopeUrl = buildOAuthAuthorizeUrl(
                client.id,
                TEST_REDIRECT_URI,
                "openid biblioweb.profile.read biblioweb.loans.write"
            );
            await page.goto(upgradedScopeUrl);
            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);
            await expect(
                page.getByText("Criar e devolver empréstimos em seu nome")
            ).toBeVisible();
            await expect(page.getByText(/já está conectado/i)).toBeVisible();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });
});
```

- [ ] **Step 3: Run the suite against the real stack**

Per `AGENTS.md` section 6.1, this touches login + a new authenticated flow, so it needs the real stack (front + `biblioweb-api` + Postgres). Run:

```bash
npm run test:e2e -- oauth-consent.spec.ts
```

Expected: all 3 tests pass. If a selector doesn't match (e.g. `Popconfirm` text collisions or timing), adjust the spec to match the actual rendered DOM — this is expected TDD iteration, not a plan defect.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/support.ts tests/e2e/oauth-consent.spec.ts
git commit -m "test(oauth): add e2e coverage for the /oauth/consent flow"
```

---

### Task 6: "Apps conectados" section in `/profile`

**Files:**
- Modify: `src/view/ProfileView.tsx`
- Modify: `src/styles/ProfileView.css`

**Interfaces:**
- Consumes: `listConsents`, `revokeConsent` (Task 2); `translateOAuthScope` (Task 1); `OAuthConnectedApp` type (Task 2).

- [ ] **Step 1: Add imports**

In `src/view/ProfileView.tsx`, find:

```tsx
import BookCard from "../components/BookCard";
import LoanedBookCard from "../components/LoanedBookCard";
import "../styles/AdminView.css";
import "../styles/ProfileView.css";
```

Replace with:

```tsx
import BookCard from "../components/BookCard";
import LoanedBookCard from "../components/LoanedBookCard";
import { listConsents, revokeConsent } from "../service/oauthConsentService";
import { OAuthConnectedApp } from "../model/OAuthConsent";
import { translateOAuthScope } from "../model/OAuthScopes";
import "../styles/AdminView.css";
import "../styles/ProfileView.css";
```

- [ ] **Step 2: Add date-formatting helpers**

Find (near the top of the file, right after `getUserIdFromToken`):

```tsx
function getUserIdFromToken(token: string | null): string | null {
    const payload = getTokenPayload(token);
    const value = payload?.sub;
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
```

Add immediately after it:

```tsx

/**
 * Converte um timestamp UTC "cru" (sem `Z`/offset) vindo da API em `Date`.
 *
 * @param value Timestamp no formato `YYYY-MM-DDTHH:mm:ss`, sem indicador de fuso.
 * @returns Instância de `Date` correta em UTC.
 */
function parseUtcTimestamp(value: string): Date {
    return new Date(`${value}Z`);
}

/**
 * Formata a data de conexão/atualização de um app conectado.
 *
 * @param value Timestamp UTC cru vindo da API.
 * @returns Data e hora locais formatadas em pt-BR, ou o valor bruto se inválido.
 */
function formatConnectedAppDate(value: string): string {
    const parsed = parseUtcTimestamp(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleString("pt-BR");
}
```

- [ ] **Step 3: Add `modal` to the antd App hook and new state**

Find:

```tsx
    const { message } = AntdApp.useApp();
```

Replace with:

```tsx
    const { message, modal } = AntdApp.useApp();
```

Find:

```tsx
    const [returnLoadingId, setReturnLoadingId] = useState<string | null>(null);
    const isMountedRef = useRef(true);
```

Replace with:

```tsx
    const [returnLoadingId, setReturnLoadingId] = useState<string | null>(null);
    const [connectedApps, setConnectedApps] = useState<OAuthConnectedApp[]>([]);
    const [isLoadingConnectedApps, setIsLoadingConnectedApps] = useState(false);
    const [revokingConnectedAppClientId, setRevokingConnectedAppClientId] = useState<
        string | null
    >(null);
    const isMountedRef = useRef(true);
```

- [ ] **Step 4: Load connected apps (only outside `/meus-livros`)**

Find:

```tsx
    useEffect(() => {
        isMountedRef.current = true;
        void loadProfile();

        return () => {
            isMountedRef.current = false;
        };
    }, [loadProfile]);
```

Replace with:

```tsx
    useEffect(() => {
        isMountedRef.current = true;
        void loadProfile();

        return () => {
            isMountedRef.current = false;
        };
    }, [loadProfile]);

    const loadConnectedApps = useCallback(async (): Promise<void> => {
        setIsLoadingConnectedApps(true);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                return;
            }

            const apps = await listConsents(accessToken);
            if (isMountedRef.current) {
                setConnectedApps(apps);
            }
        } catch (error) {
            if (isMountedRef.current) {
                message.error("Erro ao carregar apps conectados.");
            }
            console.error("Failed to load connected apps", error);
        } finally {
            if (isMountedRef.current) {
                setIsLoadingConnectedApps(false);
            }
        }
    }, [getAccessToken, message]);

    useEffect(() => {
        if (isBooksOnlyView) {
            return;
        }

        void loadConnectedApps();
    }, [isBooksOnlyView, loadConnectedApps]);
```

- [ ] **Step 5: Add the revoke handler**

Find the end of `confirmReturnLoanedBook` (it ends with `});\n    }` right before the `return (` that starts the JSX):

```tsx
            onOk: async () => {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                    navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
                    return;
                }

                setReturnLoadingId(bookId);
                try {
                    await returnBookLoan(bookId, libraryId, accessToken);
                    message.success("Livro devolvido com sucesso.");
                    await loadProfile();
                } catch (error) {
                    console.error("Failed to return loaned book", error);
                    message.error("Não foi possível devolver este livro.");
                } finally {
                    setReturnLoadingId(null);
                }
            },
        });
    }

    return (
```

Replace with:

```tsx
            onOk: async () => {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                    navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
                    return;
                }

                setReturnLoadingId(bookId);
                try {
                    await returnBookLoan(bookId, libraryId, accessToken);
                    message.success("Livro devolvido com sucesso.");
                    await loadProfile();
                } catch (error) {
                    console.error("Failed to return loaned book", error);
                    message.error("Não foi possível devolver este livro.");
                } finally {
                    setReturnLoadingId(null);
                }
            },
        });
    }

    /**
     * Exibe confirmação e, se aprovada, revoga o consentimento de um app.
     *
     * @param app App conectado a desconectar.
     * @returns void.
     */
    function confirmRevokeConnectedApp(app: OAuthConnectedApp): void {
        modal.confirm({
            title: "Desconectar aplicativo",
            content: `Desconectar "${app.client_name}"? O acesso será removido imediatamente. Para reconectar, será preciso autorizar de novo.`,
            okText: "Desconectar",
            okButtonProps: { danger: true },
            cancelText: "Cancelar",
            onOk: async () => {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                    navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
                    return;
                }

                setRevokingConnectedAppClientId(app.client_id);
                try {
                    await revokeConsent(app.client_id, accessToken);
                    setConnectedApps((previous) =>
                        previous.filter((item) => item.client_id !== app.client_id)
                    );
                    message.success("Aplicativo desconectado.");
                } catch (error) {
                    console.error("Failed to revoke OAuth consent", error);
                    message.error("Não foi possível desconectar este aplicativo.");
                } finally {
                    setRevokingConnectedAppClientId(null);
                }
            },
        });
    }

    return (
```

- [ ] **Step 6: Add the JSX section**

Find:

```tsx
                                <div className="profile-actions">
                                    {!isBooksOnlyView && (
                                        <Button type="primary" onClick={openSelfPasswordModal}>
```

Replace with:

```tsx
                                {!isBooksOnlyView && (
                                    <div className="profile-block">
                                        <Typography.Text className="profile-block-title">
                                            Apps conectados
                                        </Typography.Text>
                                        {isLoadingConnectedApps ? (
                                            <Spin size="small" />
                                        ) : connectedApps.length === 0 ? (
                                            <Typography.Text type="secondary">
                                                Nenhum app conectado à sua conta.
                                            </Typography.Text>
                                        ) : (
                                            <div className="connected-app-list">
                                                {connectedApps.map((app) => (
                                                    <div key={app.client_id} className="connected-app-card">
                                                        <div className="connected-app-info">
                                                            <Typography.Text strong>
                                                                {app.client_name}
                                                            </Typography.Text>
                                                            <div className="profile-tag-list connected-app-scopes">
                                                                {app.scopes
                                                                    .filter((scope) => scope !== "openid")
                                                                    .map((scope) => (
                                                                        <Tag key={scope} color="blue">
                                                                            {translateOAuthScope(scope)}
                                                                        </Tag>
                                                                    ))}
                                                            </div>
                                                            <Typography.Text
                                                                type="secondary"
                                                                className="connected-app-meta"
                                                            >
                                                                Conectado em{" "}
                                                                {formatConnectedAppDate(app.granted_at)}
                                                                {app.updated_at !== app.granted_at
                                                                    ? ` · atualizado em ${formatConnectedAppDate(app.updated_at)}`
                                                                    : ""}
                                                            </Typography.Text>
                                                        </div>
                                                        <Button
                                                            danger
                                                            loading={
                                                                revokingConnectedAppClientId === app.client_id
                                                            }
                                                            onClick={() => confirmRevokeConnectedApp(app)}
                                                        >
                                                            Desconectar
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="profile-actions">
                                    {!isBooksOnlyView && (
                                        <Button type="primary" onClick={openSelfPasswordModal}>
```

- [ ] **Step 7: Add the stylesheet rules**

Append to `src/styles/ProfileView.css`:

```css

.connected-app-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.connected-app-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--glass-bg);
}

.connected-app-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.connected-app-scopes {
    margin: 0;
}

.connected-app-meta {
    font-size: 12px;
}
```

- [ ] **Step 8: Verify it builds and lints**

Run: `npm run build && npm run lint`
Expected: both succeed. Watch specifically for unused-import or missing-dependency lint warnings on the new `useCallback`.

- [ ] **Step 9: Manual smoke check**

Run: `npm run dev`, log in, open `/profile`.
Expected: "Apps conectados" section shows "Nenhum app conectado à sua conta." (no test app connected yet); section does not appear on `/meus-livros`.

- [ ] **Step 10: Commit**

```bash
git add src/view/ProfileView.tsx src/styles/ProfileView.css
git commit -m "feat(oauth): add connected-apps management to /profile"
```

---

### Task 7: e2e coverage for connected apps

**Files:**
- Create: `tests/e2e/oauth-connected-apps.spec.ts`

**Interfaces:**
- Consumes: `createOAuthClientApi`, `deactivateOAuthClientApi`, `buildOAuthAuthorizeUrl` (Task 5); `createTestUser`, `deleteUser`, `loginWithPassword`, `loginAsAdminApi`, `FRONT_BASE_URL` (existing `support.ts`).

- [ ] **Step 1: Write the spec**

`tests/e2e/oauth-connected-apps.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
    FRONT_BASE_URL,
    buildOAuthAuthorizeUrl,
    createOAuthClientApi,
    createTestUser,
    deactivateOAuthClientApi,
    deleteUser,
    loginAsAdminApi,
    loginWithPassword,
} from "./support";

const TEST_REDIRECT_URI = `${FRONT_BASE_URL}/oauth-test-callback`;

/**
 * Conecta um app de teste à conta do usuário, aprovando a tela de
 * consentimento uma vez (pré-condição dos testes de apps conectados).
 */
async function connectTestApp(
    page: import("@playwright/test").Page,
    clientId: string
): Promise<void> {
    const authorizeUrl = buildOAuthAuthorizeUrl(
        clientId,
        TEST_REDIRECT_URI,
        "openid biblioweb.profile.read"
    );
    await page.goto(authorizeUrl);
    await Promise.all([
        page.waitForURL(/oauth-test-callback\?/),
        page.getByRole("button", { name: "Permitir" }).click(),
    ]);
}

test.describe.serial("Apps conectados em /profile", () => {
    test("usuário vê o app conectado e consegue desconectar", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid", "biblioweb.profile.read"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);
            await connectTestApp(page, client.id);

            await page.goto("/profile");
            await expect(page.getByText(client.name)).toBeVisible();
            await expect(page.getByText("Ver seu perfil BiblioWeb")).toBeVisible();

            await page.getByRole("button", { name: "Desconectar" }).click();
            await page.getByRole("button", { name: "Desconectar" }).last().click();

            await expect(page.getByText(client.name)).not.toBeVisible();
            await expect(page.getByText("Nenhum app conectado à sua conta.")).toBeVisible();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });

    test("apps conectados não aparecem em /meus-livros", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid", "biblioweb.profile.read"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);
            await connectTestApp(page, client.id);

            await page.goto("/meus-livros");
            await expect(page.getByText("Apps conectados")).not.toBeVisible();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });
});
```

- [ ] **Step 2: Run against the real stack**

```bash
npm run test:e2e -- oauth-connected-apps.spec.ts
```

Expected: both tests pass. Adjust selectors if the actual confirmation dialog's button text/order differs.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/oauth-connected-apps.spec.ts
git commit -m "test(oauth): add e2e coverage for connected apps in /profile"
```

---

### Task 8: Admin controller state/actions for the OAuth-clients tab

**Files:**
- Modify: `src/controller/AdminController.ts`

**Interfaces:**
- Consumes: `OAuthClient`, `OAuthClientCreatePayload` (Task 3); `listOAuthClients/createOAuthClient/updateOAuthClient/deactivateOAuthClient/rotateOAuthClientSecret` (Task 3); `ALLOWED_OAUTH_GRANT_TYPES`, `ALLOWED_OAUTH_SCOPES` (Task 1).
- Produces (new fields on the hook's returned `state`/`actions`, consumed by Task 9): `state.oauthClients: OAuthClient[]`, `state.showInactiveOAuthClients: boolean`, `state.revealedSecretUrlByClientId: Record<string, string>`, `state.isLoadingOAuthClients: boolean`, `state.isSavingOAuthClient: boolean`, `state.oauthClientModalOpen/Mode/Form/Error/FormErrors`; `actions.setShowInactiveOAuthClients`, `actions.openCreateOAuthClientModal`, `actions.openEditOAuthClientModal(client)`, `actions.closeOAuthClientModal`, `actions.setOAuthClientForm(updater)`, `actions.clearOAuthClientFieldError(field)`, `actions.saveOAuthClient(event)`, `actions.removeOAuthClient(clientId)`, `actions.rotateOAuthClientSecretById(clientId)`.

- [ ] **Step 1: Add imports**

Find:

```ts
import { validateStrongPassword } from "../service/passwordPolicy";
```

Replace with:

```ts
import { validateStrongPassword } from "../service/passwordPolicy";
import { OAuthClient, OAuthClientCreatePayload } from "../model/OAuthClient";
import { ALLOWED_OAUTH_GRANT_TYPES, ALLOWED_OAUTH_SCOPES } from "../model/OAuthScopes";
import {
    createOAuthClient,
    deactivateOAuthClient,
    listOAuthClients,
    rotateOAuthClientSecret,
    updateOAuthClient,
} from "../service/oauthClientAdminService";
```

- [ ] **Step 2: Add the tab key and form type**

Find:

```ts
type AdminTabKey =
    | "books"
    | "users"
    | "libraries"
    | "publishers"
    | "subjects"
    | "authors";
```

Replace with:

```ts
type AdminTabKey =
    | "books"
    | "users"
    | "libraries"
    | "publishers"
    | "subjects"
    | "authors"
    | "oauth-clients";

type OAuthClientFormState = {
    name: string;
    redirect_uris: string[];
    grant_types: string[];
    scopes: string[];
    is_confidential: boolean;
};

type OAuthClientFieldErrorKey = keyof OAuthClientFormState;

const emptyOAuthClientForm: OAuthClientFormState = {
    name: "",
    redirect_uris: [""],
    grant_types: ["authorization_code"],
    scopes: ["openid"],
    is_confidential: true,
};
```

- [ ] **Step 3: Add the validation function**

Find (the closing of `validatePublisherForm`, right before `validateSubjectForm`'s JSDoc):

```ts
    if (Object.keys(fieldErrors).length > 0) {
        return {
            message: "Preencha os campos obrigatórios destacados.",
            fieldErrors,
        };
    }

    return null;
}

/**
 * Valida campos do formulário de assunto.
```

Replace with:

```ts
    if (Object.keys(fieldErrors).length > 0) {
        return {
            message: "Preencha os campos obrigatórios destacados.",
            fieldErrors,
        };
    }

    return null;
}

/**
 * Valida campos do formulário de client OAuth.
 *
 * @param form Estado atual do formulário.
 * @returns Estrutura de erro com mensagem/campos inválidos ou ``null``.
 */
function validateOAuthClientForm(
    form: OAuthClientFormState
): ValidationResult<OAuthClientFieldErrorKey> | null {
    const fieldErrors: Partial<Record<OAuthClientFieldErrorKey, string>> = {};

    if (!form.name.trim()) {
        fieldErrors.name = "Nome obrigatório.";
    }

    const redirectUris = form.redirect_uris.map((uri) => uri.trim()).filter(Boolean);
    if (redirectUris.length === 0) {
        fieldErrors.redirect_uris = "Informe ao menos uma URI de redirecionamento.";
    }

    if (form.grant_types.length === 0) {
        fieldErrors.grant_types = "Selecione ao menos um grant type.";
    }

    if (form.scopes.length === 0) {
        fieldErrors.scopes = "Selecione ao menos um escopo.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            message: "Preencha os campos obrigatórios destacados.",
            fieldErrors,
        };
    }

    return null;
}

/**
 * Valida campos do formulário de assunto.
```

- [ ] **Step 4: Add loading/saving flags and data arrays**

Find:

```ts
    const [isLoadingAuthors, setIsLoadingAuthors] = useState(false);
    const [isSavingBook, setIsSavingBook] = useState(false);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const [isSavingLibrary, setIsSavingLibrary] = useState(false);
    const [isSavingPublisher, setIsSavingPublisher] = useState(false);
    const [isSavingSubject, setIsSavingSubject] = useState(false);
    const [isSavingAuthor, setIsSavingAuthor] = useState(false);
```

Replace with:

```ts
    const [isLoadingAuthors, setIsLoadingAuthors] = useState(false);
    const [isLoadingOAuthClients, setIsLoadingOAuthClients] = useState(false);
    const [isSavingBook, setIsSavingBook] = useState(false);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const [isSavingLibrary, setIsSavingLibrary] = useState(false);
    const [isSavingPublisher, setIsSavingPublisher] = useState(false);
    const [isSavingSubject, setIsSavingSubject] = useState(false);
    const [isSavingAuthor, setIsSavingAuthor] = useState(false);
    const [isSavingOAuthClient, setIsSavingOAuthClient] = useState(false);
```

Find:

```ts
    const [authorRows, setAuthorRows] = useState<AdminAuthor[]>([]);
```

Replace with:

```ts
    const [authorRows, setAuthorRows] = useState<AdminAuthor[]>([]);
    const [oauthClients, setOAuthClients] = useState<OAuthClient[]>([]);
    const [showInactiveOAuthClients, setShowInactiveOAuthClients] = useState(false);
    const [revealedSecretUrlByClientId, setRevealedSecretUrlByClientId] = useState<
        Record<string, string>
    >({});
```

- [ ] **Step 5: Add modal state**

Find:

```ts
    const [authorModalOpen, setAuthorModalOpen] = useState(false);
    const [authorModalMode, setAuthorModalMode] = useState<"create" | "edit">("create");
    const [authorForm, setAuthorForm] = useState<AuthorFormState>(emptyAuthorForm);
    const [authorModalError, setAuthorModalError] = useState("");
    const [authorFormErrors, setAuthorFormErrors] =
        useState<Partial<Record<AuthorFieldErrorKey, string>>>({});

    const hasMoreBooks = useMemo(() => Boolean(booksNext), [booksNext]);
```

Replace with:

```ts
    const [authorModalOpen, setAuthorModalOpen] = useState(false);
    const [authorModalMode, setAuthorModalMode] = useState<"create" | "edit">("create");
    const [authorForm, setAuthorForm] = useState<AuthorFormState>(emptyAuthorForm);
    const [authorModalError, setAuthorModalError] = useState("");
    const [authorFormErrors, setAuthorFormErrors] =
        useState<Partial<Record<AuthorFieldErrorKey, string>>>({});

    const [oauthClientModalOpen, setOAuthClientModalOpen] = useState(false);
    const [oauthClientModalMode, setOAuthClientModalMode] = useState<"create" | "edit">("create");
    const [oauthClientEditingId, setOAuthClientEditingId] = useState<string | null>(null);
    const [oauthClientForm, setOAuthClientForm] =
        useState<OAuthClientFormState>(emptyOAuthClientForm);
    const [oauthClientModalError, setOAuthClientModalError] = useState("");
    const [oauthClientFormErrors, setOAuthClientFormErrors] =
        useState<Partial<Record<OAuthClientFieldErrorKey, string>>>({});

    const hasMoreBooks = useMemo(() => Boolean(booksNext), [booksNext]);
```

- [ ] **Step 6: Add `loadOAuthClients` and wire it into tab-switch effects and `refreshCurrentTab`**

Find:

```ts
    const loadPublisherRows = useCallback(async (): Promise<void> => {
```

Insert immediately before it:

```ts
    const loadOAuthClients = useCallback(async (): Promise<void> => {
        setIsLoadingOAuthClients(true);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await listOAuthClients(token);
            setOAuthClients(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar clients OAuth."));
        } finally {
            setIsLoadingOAuthClients(false);
        }
    }, [getAccessToken]);

    const loadPublisherRows = useCallback(async (): Promise<void> => {
```

Find:

```ts
        if (activeTab === "authors") {
            await loadReferenceData();
            await loadAuthorRows();
            return;
        }

        await loadReferenceData();
        await loadBooks();
    }, [
        activeTab,
        loadBooks,
        loadAuthorRows,
        loadLibraryRows,
        loadPublisherRows,
        loadReferenceData,
        loadSubjectRows,
        loadUsers,
    ]);
```

Replace with:

```ts
        if (activeTab === "authors") {
            await loadReferenceData();
            await loadAuthorRows();
            return;
        }

        if (activeTab === "oauth-clients") {
            await loadOAuthClients();
            return;
        }

        await loadReferenceData();
        await loadBooks();
    }, [
        activeTab,
        loadBooks,
        loadAuthorRows,
        loadLibraryRows,
        loadOAuthClients,
        loadPublisherRows,
        loadReferenceData,
        loadSubjectRows,
        loadUsers,
    ]);
```

Find:

```ts
    useEffect(() => {
        if (!isAuthenticated || activeTab !== "authors") {
            return;
        }

        void loadAuthorRows();
    }, [activeTab, isAuthenticated, loadAuthorRows]);
```

Insert immediately after it:

```ts

    useEffect(() => {
        if (!isAuthenticated || activeTab !== "oauth-clients") {
            return;
        }

        void loadOAuthClients();
    }, [activeTab, isAuthenticated, loadOAuthClients]);
```

- [ ] **Step 7: Add the modal open/close/save/remove/rotate functions**

Find the end of `removeAuthor` (right before the final `return {` that builds the hook's return value):

```ts
    async function removeAuthor(authorId: string): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deleteAuthor(token, authorId);
            await loadReferenceData();
            await loadAuthorRows();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao remover autor."));
        }
    }

    return {
```

Replace with:

```ts
    async function removeAuthor(authorId: string): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deleteAuthor(token, authorId);
            await loadReferenceData();
            await loadAuthorRows();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao remover autor."));
        }
    }

    /**
     * Abre modal de criação de client OAuth.
     *
     * @returns void.
     */
    function openCreateOAuthClientModal(): void {
        setOAuthClientModalMode("create");
        setOAuthClientEditingId(null);
        setOAuthClientForm(emptyOAuthClientForm);
        setOAuthClientModalError("");
        setOAuthClientFormErrors({});
        setOAuthClientModalOpen(true);
    }

    /**
     * Abre modal de edição de client OAuth.
     *
     * @param item Client selecionado.
     * @returns void.
     */
    function openEditOAuthClientModal(item: OAuthClient): void {
        setOAuthClientModalMode("edit");
        setOAuthClientEditingId(item.id);
        setOAuthClientForm({
            name: item.name,
            redirect_uris: item.redirect_uris.length > 0 ? item.redirect_uris : [""],
            grant_types: item.grant_types,
            scopes: item.scopes,
            is_confidential: item.is_confidential,
        });
        setOAuthClientModalError("");
        setOAuthClientFormErrors({});
        setOAuthClientModalOpen(true);
    }

    /**
     * Fecha modal de client OAuth.
     *
     * @returns void.
     */
    function closeOAuthClientModal(): void {
        setOAuthClientModalOpen(false);
        setOAuthClientEditingId(null);
        setOAuthClientModalError("");
        setOAuthClientFormErrors({});
    }

    /**
     * Remove erro de um campo do formulário de client OAuth.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearOAuthClientFieldError(field: OAuthClientFieldErrorKey): void {
        setOAuthClientModalError("");
        setOAuthClientFormErrors((previous) => {
            if (!previous[field]) {
                return previous;
            }
            const next = { ...previous };
            delete next[field];
            return next;
        });
    }

    /**
     * Persiste formulário de client OAuth (criação ou edição). Ao criar,
     * guarda o `secret_reveal_url` retornado para exibição efêmera inline
     * na lista — nunca o `client_secret` em si.
     *
     * @param event Evento de submit.
     * @returns Promise<void>.
     */
    async function saveOAuthClient(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setOAuthClientModalError("");
        setOAuthClientFormErrors({});

        const validationError = validateOAuthClientForm(oauthClientForm);
        if (validationError) {
            setOAuthClientModalError(validationError.message);
            setOAuthClientFormErrors(validationError.fieldErrors);
            return;
        }

        setIsSavingOAuthClient(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                setOAuthClientModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const payload: OAuthClientCreatePayload = {
                name: oauthClientForm.name.trim(),
                redirect_uris: oauthClientForm.redirect_uris
                    .map((uri) => uri.trim())
                    .filter(Boolean),
                grant_types: oauthClientForm.grant_types as OAuthClientCreatePayload["grant_types"],
                scopes: oauthClientForm.scopes as OAuthClientCreatePayload["scopes"],
                is_confidential: oauthClientForm.is_confidential,
            };

            if (oauthClientModalMode === "edit" && oauthClientEditingId) {
                await updateOAuthClient(token, oauthClientEditingId, payload);
            } else {
                const created = await createOAuthClient(token, payload);
                setRevealedSecretUrlByClientId((previous) => ({
                    ...previous,
                    [created.id]: created.secret_reveal_url,
                }));
            }

            setOAuthClientModalOpen(false);
            setOAuthClientEditingId(null);
            setOAuthClientForm(emptyOAuthClientForm);
            await loadOAuthClients();
        } catch (err) {
            setOAuthClientModalError(normalizeErrorMessage(err, "Erro ao salvar client OAuth."));
        } finally {
            setIsSavingOAuthClient(false);
        }
    }

    /**
     * Desativa um client OAuth (remoção lógica; não há endpoint de reversão).
     *
     * @param clientId ID do client.
     * @returns Promise<void>.
     */
    async function removeOAuthClient(clientId: string): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deactivateOAuthClient(token, clientId);
            setRevealedSecretUrlByClientId((previous) => {
                const next = { ...previous };
                delete next[clientId];
                return next;
            });
            await loadOAuthClients();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao desativar client OAuth."));
        }
    }

    /**
     * Rotaciona o segredo de um client OAuth, substituindo qualquer link
     * de revelação anterior pelo novo.
     *
     * @param clientId ID do client.
     * @returns Promise<void>.
     */
    async function rotateOAuthClientSecretById(clientId: string): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await rotateOAuthClientSecret(token, clientId);
            setRevealedSecretUrlByClientId((previous) => ({
                ...previous,
                [clientId]: result.secret_reveal_url,
            }));
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao rotacionar segredo do client OAuth."));
        }
    }

    return {
```

- [ ] **Step 8: Expose the new state/actions**

Find:

```ts
            authorModalOpen,
            authorModalMode,
            authorForm,
            authorModalError,
            authorFormErrors,
        },
```

Replace with:

```ts
            authorModalOpen,
            authorModalMode,
            authorForm,
            authorModalError,
            authorFormErrors,
            oauthClients,
            showInactiveOAuthClients,
            revealedSecretUrlByClientId,
            isLoadingOAuthClients,
            isSavingOAuthClient,
            oauthClientModalOpen,
            oauthClientModalMode,
            oauthClientForm,
            oauthClientModalError,
            oauthClientFormErrors,
        },
```

Find:

```ts
            openCreateAuthorModal,
            openEditAuthorModal,
            closeAuthorModal,
            setAuthorForm,
            saveAuthor,
            removeAuthor,
        },
    };
```

Replace with:

```ts
            openCreateAuthorModal,
            openEditAuthorModal,
            closeAuthorModal,
            setAuthorForm,
            saveAuthor,
            removeAuthor,
            setShowInactiveOAuthClients,
            loadOAuthClients,
            openCreateOAuthClientModal,
            openEditOAuthClientModal,
            closeOAuthClientModal,
            setOAuthClientForm,
            clearOAuthClientFieldError,
            saveOAuthClient,
            removeOAuthClient,
            rotateOAuthClientSecretById,
        },
    };
```

- [ ] **Step 9: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors in `AdminController.ts` (Task 9 will add the JSX that actually consumes these fields — some "declared but never read" warnings are expected until then and will disappear after Task 9).

- [ ] **Step 10: Commit**

```bash
git add src/controller/AdminController.ts
git commit -m "feat(oauth): add OAuth-clients tab state and actions to AdminController"
```

---

### Task 9: Admin view — "Clients OAuth" tab UI

**Files:**
- Modify: `src/view/AdminView.tsx`
- Modify: `src/styles/AdminView.css`

**Interfaces:**
- Consumes: everything produced by Task 8 (`state.oauthClients` etc., `actions.openCreateOAuthClientModal` etc.); `translateOAuthScope`, `ALLOWED_OAUTH_GRANT_TYPES`, `ALLOWED_OAUTH_SCOPES` (Task 1).

- [ ] **Step 1: Add imports**

Find:

```tsx
import {
    Alert,
    Button,
    Card,
    Empty,
    Input,
    Layout,
    List,
    Modal,
    Popconfirm,
    Select,
    Switch,
    Tabs,
    Typography,
    Upload,
} from "antd";
import {
    DeleteOutlined,
    EditOutlined,
    LockOutlined,
    PlusOutlined,
    ReloadOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import HeaderView from "./HeaderView";
import BookLibraryPolicyGrid from "../components/BookLibraryPolicyGrid";
import LibraryLimitGrid from "../components/LibraryLimitGrid";
import { useAdminController } from "../controller/AdminController";
import { getBookAuthorsText } from "../model/Book";
import "../styles/AdminView.css";
```

Replace with:

```tsx
import {
    Alert,
    Button,
    Card,
    Checkbox,
    Empty,
    Input,
    Layout,
    List,
    Modal,
    Popconfirm,
    Select,
    Switch,
    Tabs,
    Tag,
    Typography,
    Upload,
} from "antd";
import {
    DeleteOutlined,
    EditOutlined,
    KeyOutlined,
    LockOutlined,
    PlusOutlined,
    ReloadOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import HeaderView from "./HeaderView";
import BookLibraryPolicyGrid from "../components/BookLibraryPolicyGrid";
import LibraryLimitGrid from "../components/LibraryLimitGrid";
import { useAdminController } from "../controller/AdminController";
import { getBookAuthorsText } from "../model/Book";
import { ALLOWED_OAUTH_GRANT_TYPES, ALLOWED_OAUTH_SCOPES, translateOAuthScope } from "../model/OAuthScopes";
import "../styles/AdminView.css";
```

- [ ] **Step 2: Extend `isRefreshingCurrentTab`**

Find:

```tsx
    const isRefreshingCurrentTab =
        state.activeTab === "users"
            ? state.isLoadingUsers
            : state.activeTab === "libraries"
                ? state.isLoadingLibraries
                : state.activeTab === "publishers"
                    ? state.isLoadingPublishers
                    : state.activeTab === "subjects"
                        ? state.isLoadingSubjects
                        : state.activeTab === "authors"
                            ? state.isLoadingAuthors
                    : state.isLoadingBooks;
```

Replace with:

```tsx
    const isRefreshingCurrentTab =
        state.activeTab === "users"
            ? state.isLoadingUsers
            : state.activeTab === "libraries"
                ? state.isLoadingLibraries
                : state.activeTab === "publishers"
                    ? state.isLoadingPublishers
                    : state.activeTab === "subjects"
                        ? state.isLoadingSubjects
                        : state.activeTab === "authors"
                            ? state.isLoadingAuthors
                            : state.activeTab === "oauth-clients"
                                ? state.isLoadingOAuthClients
                    : state.isLoadingBooks;
```

- [ ] **Step 3: Add the tab item**

Find:

```tsx
                                    </Card>
                                ),
                            },
                        ]}
                    />
                </section>
            </Content>
```

Replace with:

```tsx
                                    </Card>
                                ),
                            },
                            {
                                key: "oauth-clients",
                                label: "Clients OAuth",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card"
                                        title="Clients OAuth"
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreateOAuthClientModal}
                                            >
                                                Novo client
                                            </Button>
                                        }
                                    >
                                        <div className="users-toolbar">
                                            <Switch
                                                checked={state.showInactiveOAuthClients}
                                                onChange={actions.setShowInactiveOAuthClients}
                                            />
                                            <span>Mostrar inativos</span>
                                        </div>

                                        {(() => {
                                            const visibleClients = state.oauthClients.filter(
                                                (client) => state.showInactiveOAuthClients || client.active
                                            );

                                            if (visibleClients.length === 0 && !state.isLoadingOAuthClients) {
                                                return <Empty description="Nenhum client OAuth encontrado." />;
                                            }

                                            return (
                                                <List
                                                    className="admin-list"
                                                    loading={state.isLoadingOAuthClients}
                                                    dataSource={visibleClients}
                                                    renderItem={(client) => {
                                                        const revealedUrl =
                                                            state.revealedSecretUrlByClientId[client.id];
                                                        return (
                                                            <List.Item
                                                                className="admin-list-item"
                                                                actions={
                                                                    client.active
                                                                        ? [
                                                                              <Button
                                                                                  key="edit"
                                                                                  icon={<EditOutlined />}
                                                                                  onClick={() =>
                                                                                      actions.openEditOAuthClientModal(client)
                                                                                  }
                                                                              >
                                                                                  Editar
                                                                              </Button>,
                                                                              <Popconfirm
                                                                                  key="rotate"
                                                                                  title="Rotacionar segredo"
                                                                                  description="O segredo atual deixa de funcionar imediatamente."
                                                                                  okText="Rotacionar"
                                                                                  cancelText="Cancelar"
                                                                                  onConfirm={() => {
                                                                                      void actions.rotateOAuthClientSecretById(
                                                                                          client.id
                                                                                      );
                                                                                  }}
                                                                              >
                                                                                  <Button icon={<KeyOutlined />}>
                                                                                      Rotacionar segredo
                                                                                  </Button>
                                                                              </Popconfirm>,
                                                                              <Popconfirm
                                                                                  key="delete"
                                                                                  title="Desativar client"
                                                                                  description="Essa ação não pode ser desfeita."
                                                                                  okText="Desativar"
                                                                                  cancelText="Cancelar"
                                                                                  onConfirm={() => {
                                                                                      void actions.removeOAuthClient(client.id);
                                                                                  }}
                                                                              >
                                                                                  <Button danger icon={<DeleteOutlined />}>
                                                                                      Desativar
                                                                                  </Button>
                                                                              </Popconfirm>,
                                                                          ]
                                                                        : []
                                                                }
                                                            >
                                                                <List.Item.Meta
                                                                    title={
                                                                        <span>
                                                                            {client.name}
                                                                            {!client.active && (
                                                                                <Tag color="default" style={{ marginLeft: 8 }}>
                                                                                    Inativo
                                                                                </Tag>
                                                                            )}
                                                                        </span>
                                                                    }
                                                                    description={
                                                                        <div className="oauth-client-meta">
                                                                            <span>ID: {client.id}</span>
                                                                            <div className="profile-tag-list">
                                                                                {client.scopes.map((scope) => (
                                                                                    <Tag key={scope} color="blue">
                                                                                        {translateOAuthScope(scope)}
                                                                                    </Tag>
                                                                                ))}
                                                                            </div>
                                                                            {revealedUrl && (
                                                                                <Alert
                                                                                    type="warning"
                                                                                    showIcon
                                                                                    className="oauth-secret-reveal-banner"
                                                                                    message="Link de revelação do segredo (válido por 72h, abre uma única vez)"
                                                                                    description={
                                                                                        <Typography.Text
                                                                                            code
                                                                                            copyable={{ text: revealedUrl }}
                                                                                        >
                                                                                            {revealedUrl}
                                                                                        </Typography.Text>
                                                                                    }
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    }
                                                                />
                                                            </List.Item>
                                                        );
                                                    }}
                                                />
                                            );
                                        })()}
                                    </Card>
                                ),
                            },
                        ]}
                    />
                </section>
            </Content>
```

- [ ] **Step 4: Add the create/edit modal**

Find:

```tsx
                </form>
            </Modal>
        </Layout>
    );
```

Replace with:

```tsx
                </form>
            </Modal>

            <Modal
                title={
                    state.oauthClientModalMode === "create"
                        ? "Novo client OAuth"
                        : "Editar client OAuth"
                }
                open={state.oauthClientModalOpen}
                onCancel={actions.closeOAuthClientModal}
                footer={null}
                width={640}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void actions.saveOAuthClient(event)}>
                    {state.oauthClientModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.oauthClientModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    <div className="form-field">
                        <label className="field-label">Nome (*)</label>
                        <Input
                            className="admin-input"
                            status={state.oauthClientFormErrors.name ? "error" : undefined}
                            value={state.oauthClientForm.name}
                            onChange={(event) => {
                                actions.setOAuthClientForm((previous) => ({
                                    ...previous,
                                    name: event.target.value,
                                }));
                                actions.clearOAuthClientFieldError("name");
                            }}
                        />
                        {state.oauthClientFormErrors.name && (
                            <span className="form-field-error">{state.oauthClientFormErrors.name}</span>
                        )}
                    </div>

                    <div className="form-field">
                        <label className="field-label">URIs de redirecionamento (*)</label>
                        {state.oauthClientForm.redirect_uris.map((uri, index) => (
                            <div key={`redirect-uri-${index}`} className="oauth-redirect-uri-row">
                                <Input
                                    className="admin-input"
                                    value={uri}
                                    placeholder="https://parceiro.example/callback"
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        actions.setOAuthClientForm((previous) => {
                                            const next = [...previous.redirect_uris];
                                            next[index] = value;
                                            return { ...previous, redirect_uris: next };
                                        });
                                        actions.clearOAuthClientFieldError("redirect_uris");
                                    }}
                                />
                                <Button
                                    danger
                                    disabled={state.oauthClientForm.redirect_uris.length <= 1}
                                    onClick={() => {
                                        actions.setOAuthClientForm((previous) => ({
                                            ...previous,
                                            redirect_uris: previous.redirect_uris.filter(
                                                (_, itemIndex) => itemIndex !== index
                                            ),
                                        }));
                                    }}
                                >
                                    Remover
                                </Button>
                            </div>
                        ))}
                        <Button
                            onClick={() => {
                                actions.setOAuthClientForm((previous) => ({
                                    ...previous,
                                    redirect_uris: [...previous.redirect_uris, ""],
                                }));
                            }}
                        >
                            + Adicionar URI
                        </Button>
                        {state.oauthClientFormErrors.redirect_uris && (
                            <span className="form-field-error">
                                {state.oauthClientFormErrors.redirect_uris}
                            </span>
                        )}
                    </div>

                    <div className="form-field">
                        <label className="field-label">Grant types (*)</label>
                        <Checkbox.Group
                            options={ALLOWED_OAUTH_GRANT_TYPES.map((grantType) => ({
                                label: grantType,
                                value: grantType,
                            }))}
                            value={state.oauthClientForm.grant_types}
                            onChange={(values) => {
                                actions.setOAuthClientForm((previous) => ({
                                    ...previous,
                                    grant_types: values as string[],
                                }));
                                actions.clearOAuthClientFieldError("grant_types");
                            }}
                        />
                        {state.oauthClientFormErrors.grant_types && (
                            <span className="form-field-error">
                                {state.oauthClientFormErrors.grant_types}
                            </span>
                        )}
                    </div>

                    <div className="form-field">
                        <label className="field-label">Escopos (*)</label>
                        <div className="oauth-scope-checkbox-list">
                            {ALLOWED_OAUTH_SCOPES.map((scope) => (
                                <Checkbox
                                    key={scope}
                                    checked={state.oauthClientForm.scopes.includes(scope)}
                                    onChange={(event) => {
                                        const checked = event.target.checked;
                                        actions.setOAuthClientForm((previous) => ({
                                            ...previous,
                                            scopes: checked
                                                ? [...previous.scopes, scope]
                                                : previous.scopes.filter((item) => item !== scope),
                                        }));
                                        actions.clearOAuthClientFieldError("scopes");
                                    }}
                                >
                                    {scope} — {translateOAuthScope(scope)}
                                </Checkbox>
                            ))}
                        </div>
                        {state.oauthClientFormErrors.scopes && (
                            <span className="form-field-error">{state.oauthClientFormErrors.scopes}</span>
                        )}
                    </div>

                    <div className="form-field">
                        <label className="field-label">Client confidencial</label>
                        <Switch
                            checked={state.oauthClientForm.is_confidential}
                            onChange={(checked) => {
                                actions.setOAuthClientForm((previous) => ({
                                    ...previous,
                                    is_confidential: checked,
                                }));
                            }}
                        />
                    </div>

                    <div className="modal-actions">
                        <Button onClick={actions.closeOAuthClientModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingOAuthClient}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>
        </Layout>
    );
```

- [ ] **Step 5: Add stylesheet rules**

Append to `src/styles/AdminView.css`:

```css

.oauth-redirect-uri-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
}

.oauth-redirect-uri-row .admin-input {
    flex: 1;
}

.oauth-scope-checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.oauth-client-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.oauth-secret-reveal-banner {
    margin-top: 8px;
}
```

- [ ] **Step 6: Verify it builds and lints**

Run: `npm run build && npm run lint`
Expected: both succeed with no new errors.

- [ ] **Step 7: Manual smoke check**

Run: `npm run dev`, log in as global admin, open `/admin`, click "Clients OAuth" tab.
Expected: empty state or list renders; "Novo client" opens the modal with redirect-URI list, grant-type checkboxes, and scope checkboxes; saving shows the client in the list with the secret-reveal banner; switching tabs and back makes the banner disappear (not persisted).

- [ ] **Step 8: Commit**

```bash
git add src/view/AdminView.tsx src/styles/AdminView.css
git commit -m "feat(oauth): add Clients OAuth tab UI to the admin area"
```

---

### Task 10: e2e coverage for the admin OAuth-clients CRUD

**Files:**
- Create: `tests/e2e/oauth-clients-admin.spec.ts`

**Interfaces:**
- Consumes: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `loginAsAdminApi`, `loginWithPassword`, `locateListRow`, `fillFormField` (existing `support.ts`); `deactivateOAuthClientApi` (Task 5).

- [ ] **Step 1: Write the spec**

`tests/e2e/oauth-clients-admin.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    deactivateOAuthClientApi,
    fillFormField,
    loginAsAdminApi,
    loginWithPassword,
    locateListRow,
} from "./support";

test.describe.serial("Administração de clients OAuth", () => {
    test("admin cria, edita, rotaciona segredo e desativa um client OAuth", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const clientName = `E2E OAuth Client ${Date.now()}`;
        let createdClientId: string | null = null;

        try {
            await loginWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
            await page.goto("/admin");
            await page.getByRole("tab", { name: "Clients OAuth" }).click();

            await page.getByRole("button", { name: "Novo client" }).click();
            await fillFormField(page, "Nome (*)", clientName);
            await fillFormField(
                page,
                "URIs de redirecionamento (*)",
                "https://partner.example.com/callback"
            );
            await page.getByText("openid — Confirmar sua identidade").click();
            await page.getByText("biblioweb.profile.read — Ver seu perfil BiblioWeb").click();
            await page.getByRole("button", { name: "Salvar" }).click();

            const row = locateListRow(page, clientName);
            await expect(row).toBeVisible();
            await expect(row.getByText(/Link de revelação do segredo/)).toBeVisible();

            const clientIdText = await row.getByText(/^ID: /).innerText();
            createdClientId = clientIdText.replace("ID: ", "").trim();

            await page.getByRole("tab", { name: "Editoras" }).click();
            await page.getByRole("tab", { name: "Clients OAuth" }).click();
            await expect(row.getByText(/Link de revelação do segredo/)).not.toBeVisible();

            await row.getByRole("button", { name: "Rotacionar segredo" }).click();
            await page
                .getByRole("button", { name: "Rotacionar", exact: true })
                .last()
                .click();
            await expect(row.getByText(/Link de revelação do segredo/)).toBeVisible();

            await row.getByRole("button", { name: "Editar" }).click();
            await fillFormField(page, "Nome (*)", `${clientName} editado`);
            await page.getByRole("button", { name: "Salvar" }).click();
            await expect(page.getByText(`${clientName} editado`)).toBeVisible();

            const editedRow = locateListRow(page, `${clientName} editado`);
            await editedRow.getByRole("button", { name: "Desativar" }).click();
            await page
                .getByRole("button", { name: "Desativar", exact: true })
                .last()
                .click();
            await expect(page.getByText(`${clientName} editado`)).not.toBeVisible();

            await page.locator(".users-toolbar").getByRole("switch").click();
            await expect(page.getByText(`${clientName} editado`)).toBeVisible();
            await expect(page.getByText("Inativo")).toBeVisible();
        } finally {
            if (createdClientId) {
                await deactivateOAuthClientApi(request, adminToken, createdClientId);
            }
        }
    });
});
```

- [ ] **Step 2: Run against the real stack**

```bash
npm run test:e2e -- oauth-clients-admin.spec.ts
```

Expected: the test passes. If the two "Rotacionar"/"Desativar" button-text collisions (`Popconfirm`'s trigger button vs. its own confirm button) cause ambiguous-locator failures, disambiguate with `.last()` (already used above) or by scoping to the `.ant-popover` root — this is expected TDD iteration against the real rendered DOM.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/oauth-clients-admin.spec.ts
git commit -m "test(oauth): add e2e coverage for the admin OAuth-clients CRUD"
```

---

### Task 11: Final validation and repo hygiene

**Files:**
- Modify: `agent-learnings.md` (per `AGENTS.md` section 7 checklist)

**Interfaces:**
- None (validation-only task).

- [ ] **Step 1: Full build and lint**

```bash
npm run build
npm run lint
```

Expected: both succeed with zero errors.

- [ ] **Step 2: Full e2e suite (real stack)**

```bash
npm run test:e2e
```

Expected: all specs pass, including the three new OAuth specs and the pre-existing suite (no regressions).

- [ ] **Step 3: Walk the `AGENTS.md` section 7 checklist**

Confirm each item:
- [ ] Requisito funcional implementado (all 3 fronts).
- [ ] `/publisher-admin` e `/admin` continuam protegidas (unchanged — verify no accidental edits to `RoleProtectedRoute` usage).
- [ ] Rotas públicas continuam acessíveis sem login (unchanged).
- [ ] Fluxo de empréstimo pós-login funciona ponta a ponta (unchanged — sanity check via existing e2e suite passing).
- [ ] Contratos de API preservados (this plan never assumed a different contract than the confirmed `biblioweb-api` behavior in Task descriptions' Global Constraints).
- [ ] JSDoc adicionado em todos os pontos alterados (every new/modified function above has a docblock).
- [ ] Build executado com sucesso.
- [ ] Lint executado.
- [ ] Documentação relevante atualizada — add a short entry to `agent-learnings.md` (see Step 4) and, if this reveals a durable convention worth keeping (e.g. "OAuth admin tabs never get a reactivate action because the API doesn't support it"), consider whether it belongs in `AGENTS.md` instead of the ephemeral log.

- [ ] **Step 4: Add an `agent-learnings.md` entry and sweep old ones**

Add an entry at the top of the `## Entradas` section following the template in that file, e.g.:

```md
### 2026-08-10 - contraparte de UI OAuth2/OIDC (consent, apps conectados, admin clients)
- Descoberta:
  - O handoff `docs/oauth-consent-screen-handoff.md` descrevia a tela `/oauth/consent` como já implementada, mas nenhum código OAuth existia em `src/` — a tela precisou ser construída do zero.
  - `already_granted_scopes`/`new_scopes` de `GET /oauth/authorize/requests/<id>` são strings espaço-separadas (não array); `scopes` de `GET /oauth/consents` já é array.
  - A API de `/oauth-clients` não tem endpoint de reativação — só desativa.
- Evidencias:
  - src/view/OAuthConsentView.tsx
  - src/view/ProfileView.tsx
  - src/controller/AdminController.ts
  - docs/superpowers/specs/2026-08-10-oauth-ui-integration-design.md
- Acao aplicada:
  - Implementadas as 3 frentes de UI OAuth2/OIDC descritas na spec, com testes e2e cobrindo os fluxos principais.
- Impacto esperado:
  - `biblioweb-api` PR `info-biblioweb/biblioweb-api#1` deixa de estar bloqueado pela contraparte de UI.
```

Per `AGENTS.md` section 7, also sweep the rest of the file: remove entries no longer needed, and purge/consolidate any entry older than 14 days that hasn't been folded into `AGENTS.md` or a skill yet.

- [ ] **Step 5: Commit**

```bash
git add agent-learnings.md
git commit -m "docs: log OAuth UI integration in agent-learnings and sweep stale entries"
```
