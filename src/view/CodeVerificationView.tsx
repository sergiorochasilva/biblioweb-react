import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { App as AntdApp, Button, Form, Input } from "antd";
import AuthLayout from "../components/AuthLayout";
import { api } from "../service/api";
import type { AuthTokenResponse } from "../service/authTypes";
import { getErrorMessage } from "../service/errorMessage";
import { useAuth } from "../contexts/useAuth";
import { handlePendingLendActionAfterLogin } from "../service/postLoginAction";
import { resolveLandingAfterLogin } from "../service/postLoginRoute";

/**
 * Tela de validação do código recebido por e-mail.
 *
 * @returns Componente que finaliza login e executa ação pendente pós-login.
 */
export default function CodeVerificationView() {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setSessionFromResponse, setProfile, setPublisher, setLibrary } = useAuth();
    const { message } = AntdApp.useApp();
    const email = sessionStorage.getItem("login_email");
    const nextPath = searchParams.get("next");

    useEffect(() => {
        if (!email) {
            if (nextPath) {
                navigate(`/login?next=${encodeURIComponent(nextPath)}`);
                return;
            }
            navigate("/login");
        }
    }, [email, navigate, nextPath]);

    /**
     * Retorna para a tela inicial de login preservando o `next`, quando existir.
     *
     * @returns void
     */
    const navigateBackToLogin = (): void => {
        if (nextPath) {
            navigate(`/login?next=${encodeURIComponent(nextPath)}`);
            return;
        }
        navigate("/login");
    };

    /**
     * Valida código informado, salva token e executa redirecionamento pós-login.
     *
     * @param values Objeto do formulário contendo o código de acesso.
     * @returns Promise<void>
     */
    const handleSubmit = async (values: { code: string }): Promise<void> => {
        setIsLoading(true);
        try {
            const response = await api.post<AuthTokenResponse>("/token", {
                type: "code",
                code: values.code,
            });
            const accessToken = setSessionFromResponse(response);
            if (accessToken) {
                const handledPendingAction = await handlePendingLendActionAfterLogin(
                    accessToken,
                    navigate,
                    (errorMessage) => message.error(errorMessage)
                );
                if (handledPendingAction) {
                    return;
                }

                const landingPath = await resolveLandingAfterLogin(
                    accessToken,
                    {
                        setProfile,
                        setPublisher,
                        setLibrary,
                    },
                    nextPath
                );
                navigate(landingPath);
            } else {
                throw new Error("Token não recebido da API.");
            }
        } catch (err: unknown) {
            message.error(getErrorMessage(err, "Código inválido. Tente novamente."));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Verificação"
            subtitle={
                <>
                    Um código de acesso foi enviado para o e-mail cadastrado.
                    <br />
                    Por favor, verifique seu e-mail e digite o código abaixo.
                </>
            }
        >
            <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
                <Form.Item
                    label="Código de Acesso"
                    name="code"
                    rules={[{ required: true, message: "Informe o código." }]}
                >
                    <Input placeholder="Digite o código" autoFocus />
                </Form.Item>

                <Form.Item style={{ marginTop: 16 }}>
                    <Button type="primary" htmlType="submit" loading={isLoading} block>
                        Entrar
                    </Button>
                </Form.Item>
            </Form>

            <div className="auth-link">
                <Button type="link" onClick={navigateBackToLogin}>
                    Voltar e alterar e-mail
                </Button>
            </div>
        </AuthLayout>
    );
}
