import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { App as AntdApp, Button, Form, Input } from "antd";
import AuthLayout from "../components/AuthLayout";
import { api } from "../service/api";
import { useAuth } from "../contexts/AuthContext";
import { lendBook } from "../service/BookService";
import {
    clearPendingLendAction,
    getPendingLendAction,
} from "../service/postLoginAction";

/**
 * Tela de validação do código recebido por e-mail.
 *
 * @returns Componente que finaliza login e executa ação pendente pós-login.
 */
export default function CodeVerificationView() {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setToken } = useAuth();
    const { message } = AntdApp.useApp();
    const email = sessionStorage.getItem("login_email");
    const nextPath = searchParams.get("next");

    useEffect(() => {
        if (!email) {
            navigate("/login");
        }
    }, [email, navigate]);

    /**
     * Valida código informado, salva token e executa redirecionamento pós-login.
     *
     * @param values Objeto do formulário contendo o código de acesso.
     * @returns Promise<void>
     */
    const handleSubmit = async (values: { code: string }): Promise<void> => {
        setIsLoading(true);
        try {
            const response: any = await api.post("/login", { email, code: values.code });
            const accessToken = response?.access_token;
            if (accessToken) {
                setToken(accessToken);
                const pendingLendAction = getPendingLendAction();
                if (pendingLendAction) {
                    clearPendingLendAction();
                    navigate(pendingLendAction.returnTo);
                    // Let the route render first, then start the download.
                    setTimeout(async () => {
                        try {
                            await lendBook(
                                pendingLendAction.bookId,
                                pendingLendAction.libraryId,
                                accessToken
                            );
                        } catch (error: any) {
                            message.error(
                                error?.message || "Não foi possível finalizar o empréstimo."
                            );
                        }
                    }, 0);
                    return;
                }

                if (nextPath) {
                    navigate(nextPath);
                } else {
                    navigate("/selection");
                }
            } else {
                throw new Error("Token não recebido da API.");
            }
        } catch (err: any) {
            message.error(err.message || "Código inválido. Tente novamente.");
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
                <Button type="link" onClick={() => navigate("/login")}>Voltar e alterar e-mail</Button>
            </div>
        </AuthLayout>
    );
}
