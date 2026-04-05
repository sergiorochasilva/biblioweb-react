import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Card, Descriptions, Layout, Space, Spin, Tag, Typography } from "antd";
import HeaderView from "./HeaderView";
import { useAuth } from "../contexts/AuthContext";
import type { ProfileData } from "../types";
import { api } from "../service/api";
import "../styles/ProfileView.css";

/**
 * Converte uma flag booleana para rótulo legível.
 *
 * @param value Flag booleana.
 * @returns ``Sim`` ou ``Não``.
 */
function formatYesNo(value: boolean): string {
    return value ? "Sim" : "Não";
}

export default function ProfileView() {
    const navigate = useNavigate();
    const { message } = AntdApp.useApp();
    const { Content } = Layout;
    const { profile, setProfile, publisher, library, getAccessToken } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [currentProfile, setCurrentProfile] = useState<ProfileData | null>(profile);

    useEffect(() => {
        let isActive = true;

        /**
         * Carrega os dados do perfil autenticado.
         *
         * @returns Promise<void>
         */
        async function loadProfile(): Promise<void> {
            setIsLoading(true);
            try {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                    const nextPath = "/profile";
                    navigate(`/login?next=${encodeURIComponent(nextPath)}`);
                    return;
                }

                const loadedProfile = await api.get<ProfileData>("/profile", accessToken);
                if (!isActive) {
                    return;
                }

                setProfile(loadedProfile);
                setCurrentProfile(loadedProfile);
            } catch (error) {
                if (isActive) {
                    message.error("Erro ao carregar perfil do usuário.");
                }
                console.error("Failed to load profile", error);
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            isActive = false;
        };
    }, [getAccessToken, message, navigate, setProfile]);

    const publishers = useMemo(() => currentProfile?.publishers || [], [currentProfile]);
    const libraries = useMemo(() => currentProfile?.libraries || [], [currentProfile]);
    const hasMultipleContexts = publishers.length > 1 || libraries.length > 1;

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <div className="section-header">
                        <Typography.Title level={3} className="section-title">
                            Meu perfil
                        </Typography.Title>
                    </div>

                    <Card className="glass-card profile-card">
                        {isLoading ? (
                            <div className="profile-loading-state">
                                <Spin size="large" />
                                <Typography.Text>Carregando perfil...</Typography.Text>
                            </div>
                        ) : (
                            <Space direction="vertical" size={18} style={{ width: "100%" }}>
                                <Descriptions column={1} size="small" labelStyle={{ fontWeight: 600 }}>
                                    <Descriptions.Item label="E-mail">
                                        {currentProfile?.email || "-"}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Administrador">
                                        {formatYesNo(Boolean(currentProfile?.admin))}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Biblioteca atual">
                                        {library?.name || "-"}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Editora atual">
                                        {publisher?.name || "-"}
                                    </Descriptions.Item>
                                </Descriptions>

                                <div className="profile-block">
                                    <Typography.Text className="profile-block-title">
                                        Bibliotecas vinculadas
                                    </Typography.Text>
                                    <div className="profile-tag-list">
                                        {libraries.length === 0 ? (
                                            <Typography.Text type="secondary">
                                                Nenhuma biblioteca vinculada.
                                            </Typography.Text>
                                        ) : (
                                            libraries.map((item) => (
                                                <Tag key={`library-${item.id}`} color="blue">
                                                    {item.name}
                                                </Tag>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="profile-block">
                                    <Typography.Text className="profile-block-title">
                                        Editoras vinculadas
                                    </Typography.Text>
                                    <div className="profile-tag-list">
                                        {publishers.length === 0 ? (
                                            <Typography.Text type="secondary">
                                                Nenhuma editora vinculada.
                                            </Typography.Text>
                                        ) : (
                                            publishers.map((item) => (
                                                <Tag key={`publisher-${item.id}`} color="geekblue">
                                                    {item.name}
                                                </Tag>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {hasMultipleContexts && (
                                    <Button
                                        type="default"
                                        className="profile-switch-context-button"
                                        onClick={() => navigate("/selection")}
                                    >
                                        Trocar ambiente
                                    </Button>
                                )}
                            </Space>
                        )}
                    </Card>
                </section>
            </Content>
        </Layout>
    );
}
