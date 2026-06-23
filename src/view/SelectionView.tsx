import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Form, Select, Spin, Typography } from "antd";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../contexts/useAuth";
import { api } from "../service/api";
import { getErrorMessage } from "../service/errorMessage";
import { resolvePostLoginRoute } from "../service/postLoginRoute";
import type { ProfileData } from "../types";

/**
 * Tela de seleção de editora/biblioteca após autenticação.
 *
 * @returns Componente de seleção com redirecionamento automático quando há
 * apenas uma opção disponível.
 */
export default function SelectionView() {
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [form] = Form.useForm();

    const navigate = useNavigate();
    const { getAccessToken, setPublisher, setLibrary, setProfile } = useAuth();
    const { message } = AntdApp.useApp();

    const hasPublishers = (profileData?.publishers?.length || 0) > 0;
    const hasLibraries = (profileData?.libraries?.length || 0) > 0;

    const showPublisherSelect = (profileData?.publishers?.length || 0) > 1;
    const showLibrarySelect = (profileData?.libraries?.length || 0) > 1;

    const publisherOptions = useMemo(
        () =>
            profileData?.publishers.map((publisher) => ({
                value: publisher.id,
                label: publisher.name,
            })) || [],
        [profileData]
    );

    const libraryOptions = useMemo(
        () =>
            profileData?.libraries.map((library) => ({
                value: library.id.toString(),
                label: library.name,
            })) || [],
        [profileData]
    );

    useEffect(() => {
        let isActive = true;

        /**
         * Carrega o profile do usuário autenticado e aplica regras de auto seleção.
         *
         * @returns Promise<void>
         */
        const fetchProfile = async (): Promise<void> => {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                if (isActive) {
                    setIsLoading(false);
                    navigate("/login");
                }
                return;
            }
            try {
                const data = await api.get<ProfileData>("/profile", accessToken);
                if (!isActive) return;
                setProfileData(data);
                setProfile(data);
                setPublisher(null);
                setLibrary(null);

                const landingPath = resolvePostLoginRoute(data, null);
                if (landingPath !== "/selection") {
                    navigate(landingPath);
                    return;
                }

                const autoPublisher = data.publishers.length === 1 ? data.publishers[0] : null;
                const autoLibrary = data.libraries.length === 1 ? data.libraries[0] : null;
                const shouldAutoRedirect = data.publishers.length <= 1 && data.libraries.length <= 1;

                if (autoPublisher) {
                    form.setFieldsValue({ publisher: autoPublisher.id });
                }
                if (autoLibrary) {
                    form.setFieldsValue({ library: autoLibrary.id.toString() });
                }

                if (shouldAutoRedirect && autoLibrary) {
                    if (autoPublisher) setPublisher(autoPublisher);
                    setLibrary(autoLibrary);
                    navigate("/");
                    return;
                }
            } catch (err: unknown) {
                if (isActive) {
                    message.error(getErrorMessage(err, "Erro ao carregar perfil."));
                }
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        fetchProfile();

        return () => {
            isActive = false;
        };
    }, [getAccessToken, navigate, setPublisher, setLibrary, setProfile, form, message]);

    /**
     * Persiste a seleção de ambiente no contexto e segue para a home.
     *
     * @param values Valores selecionados no formulário.
     * @returns void
     */
    const handleSubmit = (values: { publisher?: string; library?: string }): void => {
        if (!profileData) return;

        const selectedPublisher = showPublisherSelect
            ? profileData.publishers.find((p) => p.id === values.publisher)
            : profileData.publishers[0];
        const selectedLibrary = showLibrarySelect
            ? profileData.libraries.find((l) => l.id.toString() === values.library)
            : profileData.libraries[0];

        if (!selectedLibrary) {
            message.error("Selecione uma biblioteca.");
            return;
        }

        if (selectedPublisher) {
            setPublisher(selectedPublisher);
        } else if (!hasPublishers) {
            setPublisher(null);
        }

        setLibrary(selectedLibrary);
        navigate("/");
    };

    if (isLoading) {
        return (
            <div className="auth-page">
                <Spin size="large" />
            </div>
        );
    }

    return (
        <AuthLayout
            title="Selecione o ambiente"
            subtitle="Escolha a editora e a biblioteca para continuar"
        >
            {!hasLibraries ? (
                <Typography.Text className="auth-subtitle">
                    Nenhuma biblioteca disponível para este usuário.
                </Typography.Text>
            ) : (
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    {showPublisherSelect && (
                        <Form.Item
                            label="Editora"
                            name="publisher"
                            rules={[{ required: true, message: "Selecione uma editora." }]}
                        >
                            <Select placeholder="Selecione..." options={publisherOptions} />
                        </Form.Item>
                    )}

                    {showLibrarySelect && (
                        <Form.Item
                            label="Biblioteca (acervo)"
                            name="library"
                            rules={[{ required: true, message: "Selecione uma biblioteca." }]}
                        >
                            <Select placeholder="Selecione..." options={libraryOptions} />
                        </Form.Item>
                    )}

                    <Form.Item style={{ marginTop: 16 }}>
                        <Button type="primary" htmlType="submit" block>
                            Entrar
                        </Button>
                    </Form.Item>
                </Form>
            )}
        </AuthLayout>
    );
}
