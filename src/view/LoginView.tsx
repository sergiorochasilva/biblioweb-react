import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { App as AntdApp, Button, Form, Input } from "antd";
import AuthLayout from "../components/AuthLayout";
import { api } from "../service/api";
import { getErrorMessage } from "../service/errorMessage";

/**
 * Tela inicial de autenticação por e-mail.
 *
 * @returns Componente de formulário para solicitar envio do código de login.
 */
export default function LoginView() {
    const [isLoading, setIsLoading] = useState(false);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { message } = AntdApp.useApp();
    const nextPath = searchParams.get("next");

    /**
     * Navega para a próxima etapa preservando o parâmetro `next`.
     *
     * @param path Caminho de destino.
     * @returns void
     */
    const navigateWithNext = (path: string): void => {
        if (nextPath) {
            navigate(`${path}?next=${encodeURIComponent(nextPath)}`);
            return;
        }
        navigate(path);
    };

    /**
     * Solicita o envio do código de acesso para o e-mail informado.
     *
     * @param values Objeto do formulário contendo o e-mail do usuário.
     * @returns Promise<void>
     */
    const handleSubmit = async (values: { email: string }): Promise<void> => {
        setIsLoading(true);
        try {
            await api.post("/login", { email: values.email });
            sessionStorage.setItem("login_email", values.email);
            if (nextPath) {
                navigate(`/verify-code?next=${encodeURIComponent(nextPath)}`);
            } else {
                navigate("/verify-code");
            }
        } catch (err: unknown) {
            message.error(
                getErrorMessage(err, "Falha ao iniciar login. Verifique o e-mail.")
            );
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Redireciona para o fluxo de autenticação por senha usando o e-mail informado.
     *
     * @returns Promise<void>
     */
    const handlePasswordLogin = async (): Promise<void> => {
        try {
            const values = await form.validateFields(["email"]);
            sessionStorage.setItem("login_email", values.email);
            navigateWithNext("/login-password");
        } catch {
            // A validação do formulário já exibe o feedback necessário.
        }
    };

    return (
        <AuthLayout
            title="Login"
            subtitle="Acesso administrativo do BiblioWeb"
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
                <Form.Item
                    label="E-mail"
                    name="email"
                    rules={[{ required: true, type: "email", message: "Informe um e-mail válido." }]}
                >
                    <Input placeholder="seu@email.com" autoFocus />
                </Form.Item>

                <Form.Item style={{ marginTop: 16 }}>
                    <Button type="primary" htmlType="submit" loading={isLoading} block>
                        Entrar
                    </Button>
                </Form.Item>

                <Form.Item style={{ marginTop: 8 }}>
                    <Button type="default" htmlType="button" onClick={handlePasswordLogin} block>
                        Entrar com senha
                    </Button>
                </Form.Item>
            </Form>
        </AuthLayout>
    );
}
