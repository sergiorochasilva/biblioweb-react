# OAuth Secret-Reveal Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public, unauthenticated `/oauth-clients/secret-reveal` page in `biblioweb-react` (fase 2 of the OAuth2/OIDC UI integration), replacing the static HTML page today served by `biblioweb-api`.

**Architecture:** One new public route/view reusing the existing `AuthLayout` shell (same pattern as `LoginView`), one new service function on the already-existing `oauthClientAdminService.ts`, one new type on `OAuthClient.ts`. No state management beyond local `useState` — this is a single-purpose, no-auth page with a simple linear flow (missing token → ready → revealing → revealed/error).

**Tech Stack:** React + TypeScript + Vite, Ant Design (antd), React Router.

## Global Constraints

- The `biblioweb-api` prerequisite (`secret_reveal_url` now derives from `APP_PUBLIC_URL` instead of `OAUTH_ISSUER`) is already done in another session/repo — nothing in `biblioweb-api` is touched by this plan.
- The reveal token comes from the URL **fragment** (`window.location.hash`), never the query string — read it client-side only, never send it anywhere except in the `POST` body.
- A plain page load (no click) must **never** call `POST /oauth-clients/secret-reveal` — the reveal only happens after an explicit "Revelar segredo" click.
- Once revealed, the secret stays visible indefinitely (no auto-hide timer) until the user navigates away or closes the tab.
- `404` from the reveal endpoint must show one generic message covering all three cases the API deliberately conflates (invalid/expired/already-used token) — never try to distinguish them.
- The route is public — outside `ProtectedRoute`, no login assumed, no `Authorization` header sent on the reveal call.
- Every new/changed function needs JSDoc (params + return), per `AGENTS.md` section 4.
- `npm run build` and `npm run lint` must pass.
- Follow existing patterns: `api.ts` for the HTTP call, `AuthLayout`/`glass-card` styling from `src/styles/global.css`, matching `LoginView.tsx`/`OAuthConsentView.tsx` conventions.

---

## File Structure

- Modify: `src/model/OAuthClient.ts` — add `OAuthClientSecretPayload` type (the one place in the codebase where a plaintext `client_secret` legitimately appears).
- Modify: `src/service/oauthClientAdminService.ts` — add `revealOAuthClientSecret(revealToken)`.
- Create: `src/view/OAuthSecretRevealView.tsx` — the page itself.
- Create: `src/styles/OAuthSecretRevealView.css` — page-specific styles.
- Modify: `src/App.tsx` — new public route.

---

### Task 1: Type, service function, and view

**Files:**
- Modify: `src/model/OAuthClient.ts`
- Modify: `src/service/oauthClientAdminService.ts`
- Create: `src/view/OAuthSecretRevealView.tsx`
- Create: `src/styles/OAuthSecretRevealView.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `api.post<T>(endpoint, body, token?)` from `src/service/api.ts` (token omitted for this public call); `ApiError` type from `src/service/api.ts`; `getErrorMessage` from `src/service/errorMessage.ts`; `AuthLayout` from `src/components/AuthLayout.tsx`.
- Produces: `OAuthClientSecretPayload` type, `revealOAuthClientSecret(revealToken: string): Promise<OAuthClientSecretPayload>`, `OAuthSecretRevealView` default export mounted at `/oauth-clients/secret-reveal`.

- [ ] **Step 1: Add the type**

In `src/model/OAuthClient.ts`, find:

```ts
/** `client_secret` nunca aparece aqui — só o link de revelação única. */
export type OAuthClientSecretRevealResponse = {
    secret_reveal_url: string;
};

export type OAuthClientCreateResponse = OAuthClient & OAuthClientSecretRevealResponse;
```

Replace with:

```ts
/** `client_secret` nunca aparece aqui — só o link de revelação única. */
export type OAuthClientSecretRevealResponse = {
    secret_reveal_url: string;
};

export type OAuthClientCreateResponse = OAuthClient & OAuthClientSecretRevealResponse;

/**
 * Resposta de `POST /oauth-clients/secret-reveal` — a única estrutura no
 * codebase onde um `client_secret` em texto puro aparece legitimamente,
 * e só na página pública de revelação única (nunca na área administrativa
 * logada).
 */
export type OAuthClientSecretPayload = {
    client_secret: string;
};
```

- [ ] **Step 2: Add the service function**

In `src/service/oauthClientAdminService.ts`, find:

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
```

Replace with:

```ts
import { api } from "./api";
import {
    OAuthClient,
    OAuthClientCreatePayload,
    OAuthClientCreateResponse,
    OAuthClientListResponse,
    OAuthClientSecretPayload,
    OAuthClientSecretRevealResponse,
    OAuthClientUpdatePayload,
} from "../model/OAuthClient";
```

Find the end of the file:

```ts
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

Append immediately after it:

```ts

/**
 * Revela o `client_secret` em texto puro a partir do token de um link de
 * revelação única — endpoint público, sem autenticação (protegido só pela
 * posse do token de alta entropia). Funciona uma única vez; chamadas
 * subsequentes com o mesmo token retornam `404`.
 *
 * @param revealToken Token extraído do fragmento da URL de revelação.
 * @returns O `client_secret` em texto puro.
 */
export async function revealOAuthClientSecret(
    revealToken: string
): Promise<OAuthClientSecretPayload> {
    return api.post<OAuthClientSecretPayload>("/oauth-clients/secret-reveal", {
        token: revealToken,
    });
}
```

- [ ] **Step 3: Write the view**

`src/view/OAuthSecretRevealView.tsx`:

```tsx
import { useCallback, useState } from "react";
import { Alert, Button, Typography } from "antd";
import AuthLayout from "../components/AuthLayout";
import { ApiError } from "../service/api";
import { getErrorMessage } from "../service/errorMessage";
import { revealOAuthClientSecret } from "../service/oauthClientAdminService";
import "../styles/OAuthSecretRevealView.css";

const GENERIC_INVALID_MESSAGE =
    "Este link de revelação é inválido, expirou ou já foi usado. Peça ao administrador do BiblioWeb para rotacionar o segredo novamente.";

type ViewState =
    | { status: "missing_token" }
    | { status: "ready" }
    | { status: "revealing" }
    | { status: "revealed"; secret: string }
    | { status: "error"; message: string };

/**
 * Extrai o token de revelação do fragmento da URL (nunca da query string
 * — proposital no backend, para o token nunca aparecer em log de acesso
 * de proxy/servidor).
 *
 * @returns Token extraído, ou string vazia se ausente.
 */
function extractRevealToken(): string {
    return window.location.hash.replace(/^#/, "").trim();
}

/**
 * Tela pública de revelação única de `client_secret` de um client OAuth.
 * Sem autenticação — protegida só pela posse do token de alta entropia no
 * fragmento da URL. Um carregamento simples desta rota nunca revela nada
 * por design; a revelação só acontece após clique explícito no botão.
 *
 * @returns Componente da tela de revelação de segredo.
 */
export default function OAuthSecretRevealView() {
    const [token] = useState<string>(extractRevealToken);
    const [viewState, setViewState] = useState<ViewState>(
        token ? { status: "ready" } : { status: "missing_token" }
    );

    /**
     * Dispara a revelação do segredo a partir do token já extraído.
     *
     * @returns Promise<void>.
     */
    const handleReveal = useCallback(async (): Promise<void> => {
        setViewState({ status: "revealing" });
        try {
            const result = await revealOAuthClientSecret(token);
            setViewState({ status: "revealed", secret: result.client_secret });
        } catch (error) {
            const status = (error as ApiError).status;
            setViewState({
                status: "error",
                message:
                    status === 404
                        ? GENERIC_INVALID_MESSAGE
                        : getErrorMessage(error, GENERIC_INVALID_MESSAGE),
            });
        }
    }, [token]);

    if (viewState.status === "missing_token") {
        return (
            <AuthLayout title="Link inválido">
                <Alert
                    type="error"
                    showIcon
                    message="Este link não contém um token de revelação válido."
                />
            </AuthLayout>
        );
    }

    if (viewState.status === "error") {
        return (
            <AuthLayout title="Revelação indisponível">
                <Alert type="error" showIcon message={viewState.message} />
            </AuthLayout>
        );
    }

    if (viewState.status === "revealed") {
        return (
            <AuthLayout title="Segredo do client OAuth">
                <Alert
                    type="warning"
                    showIcon
                    className="oauth-secret-reveal-warning"
                    message="Esta é a única vez que este segredo será exibido. Copie e guarde-o agora em um local seguro (gerenciador de senhas)."
                />
                <div className="oauth-secret-reveal-value">
                    <Typography.Text code copyable={{ text: viewState.secret }}>
                        {viewState.secret}
                    </Typography.Text>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Revelar segredo de client OAuth"
            subtitle="Este link revela um client_secret uma única vez. Ao clicar em Revelar, o segredo ficará visível até você sair desta página."
        >
            <Button
                type="primary"
                block
                loading={viewState.status === "revealing"}
                onClick={() => void handleReveal()}
            >
                Revelar segredo
            </Button>
        </AuthLayout>
    );
}
```

- [ ] **Step 4: Write the stylesheet**

`src/styles/OAuthSecretRevealView.css`:

```css
.oauth-secret-reveal-warning {
    margin-bottom: 16px;
}

.oauth-secret-reveal-value {
    padding: 12px;
    border-radius: 8px;
    background: var(--glass-bg);
    word-break: break-all;
}
```

- [ ] **Step 5: Wire the public route**

In `src/App.tsx`, find:

```tsx
import ProfileView from "./view/ProfileView";
import OAuthConsentView from "./view/OAuthConsentView";
import BibliotecarioView from "./view/BibliotecarioView";
```

Replace with:

```tsx
import ProfileView from "./view/ProfileView";
import OAuthConsentView from "./view/OAuthConsentView";
import OAuthSecretRevealView from "./view/OAuthSecretRevealView";
import BibliotecarioView from "./view/BibliotecarioView";
```

Find:

```tsx
            <Route path="/bibliotecario" element={<BibliotecarioView />} />

            <Route element={<ProtectedRoute />}>
```

Replace with:

```tsx
            <Route path="/bibliotecario" element={<BibliotecarioView />} />
            <Route path="/oauth-clients/secret-reveal" element={<OAuthSecretRevealView />} />

            <Route element={<ProtectedRoute />}>
```

(This route sits alongside the other public routes — `/login`, `/search`, etc. — outside `ProtectedRoute`, matching the backend's contract that this page requires no BiblioWeb login.)

- [ ] **Step 6: Verify it builds and lints**

Run: `npm run build && npm run lint`
Expected: both succeed with no new errors.

- [ ] **Step 7: Manual smoke check**

Run: `npm run dev`, then:
1. Open `/oauth-clients/secret-reveal` with no fragment. Expected: "Este link não contém um token de revelação válido."
2. Create a test OAuth client via the admin "Clients OAuth" tab (or via `curl` against a running `biblioweb-api`), copy the `secret_reveal_url` it returns, and open that exact URL (with its real `#token`) in the browser. Expected: "Revelar segredo de client OAuth" screen with a button; clicking it shows the actual `client_secret` with a working "Copiar" button; reloading the same URL and clicking again shows the generic invalid/expired/used error (since the token is now consumed).

- [ ] **Step 8: Commit**

```bash
git add src/model/OAuthClient.ts src/service/oauthClientAdminService.ts src/view/OAuthSecretRevealView.tsx src/styles/OAuthSecretRevealView.css src/App.tsx
git commit -m "feat(oauth): build the public /oauth-clients/secret-reveal page"
```

---

## Self-Review

**Spec coverage:** The design doc (`docs/superpowers/specs/2026-08-12-oauth-secret-reveal-page-design.md`) lists route, token-from-fragment, click-to-reveal (not auto), no-timeout display, generic 404 message, and the file list — all covered by Task 1's single set of steps (this is a small enough feature that one task suffices; no decomposition needed).

**Placeholder scan:** No TBD/TODO; all code is complete and copy-pasteable.

**Type consistency:** `OAuthClientSecretPayload.client_secret: string` used consistently in the service return type and the view's `result.client_secret` access. `ApiError` imported from `../service/api` matches its actual export (`Error & { status?: number; body?: unknown }`), same pattern already used in `OAuthConsentView.tsx`.
