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
 * Tela de autenticação por senha.
 *
 * @returns Componente que finaliza login por credenciais e executa ação
 * pendente pós-login quando existir.
 */
export default function PasswordLoginView() {
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
     * Redireciona para a tela inicial de login preservando o parâmetro `next`.
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
     * Valida a senha e troca as credenciais por um access token.
     *
     * @param values Objeto do formulário contendo a senha informada.
     * @returns Promise<void>
     */
    const handleSubmit = async (values: { password: string }): Promise<void> => {
        if (!email) {
            navigateBackToLogin();
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post<AuthTokenResponse>("/token", {
                type: "credentials",
                credentials: {
                    email,
                    password: values.password,
                },
            });
            const accessToken = setSessionFromResponse(response);
            if (!accessToken) {
                throw new Error("Token não recebido da API.");
            }

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
        } catch (err: unknown) {
            message.error(getErrorMessage(err, "Senha inválida. Tente novamente."));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Digite sua senha"
            subtitle="Digite a senha de acesso cadastrada para seu usuário"
        >
            <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
                <Form.Item
                    label="Senha"
                    name="password"
                    rules={[{ required: true, message: "Informe a senha." }]}
                >
                    <Input.Password placeholder="Digite sua senha" autoFocus />
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
