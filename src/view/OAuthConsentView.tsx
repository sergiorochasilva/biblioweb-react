import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Spin, Tag, Typography } from "antd";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../contexts/useAuth";
import { getErrorMessage } from "../service/errorMessage";
import type { ApiError } from "../service/api";
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

    // `loadRequest` depende de `getAccessToken`, cuja identidade muda quando o
    // token é renovado/backfillado (ver AuthContext). Isso recria `loadRequest`
    // e re-dispara o efeito abaixo. Sem esta guarda, o caminho de auto-aprovação
    // (`consent_required: false`) poderia disparar um segundo `POST /approve`
    // para a mesma `requestId` — que já é de uso único no backend — e o 404
    // resultante sobrescreveria a tela com um erro genérico em cima de um
    // redirecionamento que já pode estar em andamento.
    const startedRequestIdRef = useRef<string | null>(null);

    const loadRequest = useCallback(async (): Promise<void> => {
        if (!requestId || startedRequestIdRef.current === requestId) {
            return;
        }
        startedRequestIdRef.current = requestId;

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
            const status = (error as ApiError).status;
            if (status === 401) {
                navigate(
                    `/login?next=${encodeURIComponent(`/oauth/consent?request_id=${requestId}`)}`
                );
                return;
            }
            setViewState({
                status: "error",
                message:
                    status === 404
                        ? GENERIC_EXPIRED_MESSAGE
                        : getErrorMessage(error, GENERIC_EXPIRED_MESSAGE),
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
            const status = (error as ApiError).status;
            if (status === 401) {
                navigate(
                    `/login?next=${encodeURIComponent(`/oauth/consent?request_id=${requestId}`)}`
                );
                return;
            }
            setViewState({
                status: "error",
                message:
                    status === 404
                        ? GENERIC_EXPIRED_MESSAGE
                        : getErrorMessage(error, GENERIC_EXPIRED_MESSAGE),
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
