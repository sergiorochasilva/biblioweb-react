import { useCallback, useState } from "react";
import { CopyOutlined, SafetyOutlined } from "@ant-design/icons";
import { Alert, App as AntdApp, Button, Typography } from "antd";
import AuthLayout from "../components/AuthLayout";
import { OAUTH_SECRET_REVEAL_COPY } from "../model/OAuthSecretRevealPresentation";
import { ApiError } from "../service/api";
import { getErrorMessage } from "../service/errorMessage";
import { revealOAuthClientSecret } from "../service/oauthClientAdminService";
import "../styles/OAuthSecretRevealView.css";

const GENERIC_INVALID_MESSAGE = OAUTH_SECRET_REVEAL_COPY.invalidOrUsedMessage;
const NETWORK_ERROR_MESSAGE = OAUTH_SECRET_REVEAL_COPY.networkErrorMessage;

type ViewState =
    | { status: "missing_token" }
    | { status: "ready" }
    | { status: "revealing" }
    | { status: "revealed"; secret: string }
    | { status: "error"; message: string; retryable: boolean };

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
    const { message } = AntdApp.useApp();
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
            if (status === 404) {
                setViewState({
                    status: "error",
                    message: GENERIC_INVALID_MESSAGE,
                    retryable: false,
                });
                return;
            }

            if (status === undefined) {
                // A requisição não chegou a receber resposta do servidor
                // (offline, DNS, CORS, TLS, etc.) — não expor o texto bruto
                // do erro de fetch (ex.: "Failed to fetch") ao parceiro.
                setViewState({
                    status: "error",
                    message: NETWORK_ERROR_MESSAGE,
                    retryable: true,
                });
                return;
            }

            setViewState({
                status: "error",
                message: getErrorMessage(error, GENERIC_INVALID_MESSAGE),
                retryable: true,
            });
        }
    }, [token]);

    /**
     * Retorna do estado de erro recuperável para a etapa de revelação.
     *
     * @returns void.
     */
    const handleRetry = useCallback((): void => {
        setViewState({ status: "ready" });
    }, []);

    /**
     * Copia o segredo já revelado para a área de transferência e informa o resultado.
     *
     * @param secret Segredo OAuth exibido na tela.
     * @returns Promise<void>.
     */
    const handleCopySecret = useCallback(
        async (secret: string): Promise<void> => {
            try {
                await navigator.clipboard.writeText(secret);
                message.success("Segredo copiado.");
            } catch (error) {
                console.error("Failed to copy OAuth client secret", error);
                message.error(
                    "Não foi possível copiar automaticamente. Selecione e copie o segredo manualmente."
                );
            }
        },
        [message]
    );

    if (viewState.status === "missing_token") {
        return (
            <AuthLayout title="Link inválido" className="oauth-secret-reveal-layout">
                <Alert
                    type="error"
                    showIcon
                    message={OAUTH_SECRET_REVEAL_COPY.missingTokenMessage}
                    description={OAUTH_SECRET_REVEAL_COPY.missingTokenDescription}
                />
            </AuthLayout>
        );
    }

    if (viewState.status === "error") {
        return (
            <AuthLayout title="Revelação indisponível" className="oauth-secret-reveal-layout">
                <div className="oauth-secret-reveal-stack">
                    <Alert type="error" showIcon message={viewState.message} />
                    {viewState.retryable ? (
                        <Button type="primary" block onClick={handleRetry}>
                            Tentar novamente
                        </Button>
                    ) : null}
                </div>
            </AuthLayout>
        );
    }

    if (viewState.status === "revealed") {
        return (
            <AuthLayout
                title={OAUTH_SECRET_REVEAL_COPY.revealedTitle}
                className="oauth-secret-reveal-layout"
            >
                <div className="oauth-secret-reveal-stack">
                    <Alert
                        type="warning"
                        showIcon
                        className="oauth-secret-reveal-warning"
                        message={OAUTH_SECRET_REVEAL_COPY.revealedWarning}
                    />

                    <div className="oauth-secret-reveal-field">
                        <Typography.Text className="oauth-secret-reveal-label">
                            Segredo
                        </Typography.Text>
                        <div className="oauth-secret-reveal-value">
                            <Typography.Text code>{viewState.secret}</Typography.Text>
                        </div>
                    </div>

                    <Button
                        type="primary"
                        block
                        icon={<CopyOutlined />}
                        onClick={() => void handleCopySecret(viewState.secret)}
                    >
                        Copiar segredo
                    </Button>

                    <div className="oauth-secret-storage-hint">
                        <SafetyOutlined aria-hidden="true" />
                        <Typography.Text type="secondary">
                            {OAUTH_SECRET_REVEAL_COPY.revealedStorageHint}
                        </Typography.Text>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title={OAUTH_SECRET_REVEAL_COPY.readyTitle}
            subtitle={OAUTH_SECRET_REVEAL_COPY.readySubtitle}
            className="oauth-secret-reveal-layout"
        >
            <div className="oauth-secret-reveal-stack">
                <Alert
                    type="info"
                    showIcon
                    className="oauth-secret-single-use-alert"
                    message={OAUTH_SECRET_REVEAL_COPY.uniqueUseTitle}
                    description={OAUTH_SECRET_REVEAL_COPY.uniqueUseMessage}
                />
                <Button
                    type="primary"
                    block
                    loading={viewState.status === "revealing"}
                    onClick={() => void handleReveal()}
                >
                    Revelar segredo
                </Button>
            </div>
        </AuthLayout>
    );
}
