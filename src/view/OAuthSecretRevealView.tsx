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
