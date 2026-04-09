import { useEffect, useMemo, useState } from "react";
import { Button, Card, Layout, Result, Spin, Typography } from "antd";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../service/api";
import {
    hasGlobalAdminPermission,
    hasPublisherAdminPermission,
} from "../service/permissions";
import type { ProfileData } from "../types";
import HeaderView from "../view/HeaderView";

type PermissionType = "global-admin" | "publisher-admin";

type RoleProtectedRouteProps = {
    permission: PermissionType;
    unauthorizedMessage: string;
};

/**
 * Guarda de rota com verificação de permissão por perfil autenticado.
 *
 * Exibe feedback de acesso negado no front-end quando o usuário autenticado
 * não possui o direito necessário para a página.
 *
 * @param permission Permissão necessária para liberar o conteúdo.
 * @param unauthorizedMessage Mensagem exibida quando acesso for negado.
 * @returns ``Outlet`` quando permitido, tela de erro quando negado ou
 * redirecionamento para login quando não autenticado.
 */
export default function RoleProtectedRoute({
    permission,
    unauthorizedMessage,
}: RoleProtectedRouteProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, profile, setProfile, getAccessToken } = useAuth();
    const { Content } = Layout;

    const [isLoadingProfile, setIsLoadingProfile] = useState(
        Boolean(isAuthenticated && !profile)
    );
    const [profileError, setProfileError] = useState("");

    useEffect(() => {
        let isActive = true;

        async function ensureProfileLoaded(): Promise<void> {
            if (!isAuthenticated || profile) {
                return;
            }

            setIsLoadingProfile(true);
            setProfileError("");

            try {
                const accessToken = await getAccessToken({ redirectOnFail: false });
                if (!isActive) {
                    return;
                }

                if (!accessToken) {
                    setProfileError("Sessão expirada. Faça login novamente.");
                    return;
                }

                const loadedProfile = await api.get<ProfileData>("/profile", accessToken);
                if (!isActive) {
                    return;
                }
                setProfile(loadedProfile);
            } catch (error) {
                if (!isActive) {
                    return;
                }
                console.error("Failed to load profile for role guard", error);
                setProfileError("Não foi possível validar suas permissões no momento.");
            } finally {
                if (isActive) {
                    setIsLoadingProfile(false);
                }
            }
        }

        void ensureProfileLoaded();

        return () => {
            isActive = false;
        };
    }, [getAccessToken, isAuthenticated, profile, setProfile]);

    const hasPermission = useMemo(() => {
        if (!profile) {
            return false;
        }

        if (permission === "global-admin") {
            return hasGlobalAdminPermission(profile);
        }

        return hasPublisherAdminPermission(profile);
    }, [permission, profile]);

    if (!isAuthenticated) {
        const nextPath = `${location.pathname}${location.search}`;
        return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
    }

    if (isLoadingProfile || (!profile && !profileError)) {
        return (
            <Layout className="page-shell">
                <HeaderView />
                <Content className="page-content">
                    <Card className="glass-card state-card">
                        <div className="loading-state">
                            <Spin size="large" />
                            <Typography.Text>Validando permissões...</Typography.Text>
                        </div>
                    </Card>
                </Content>
            </Layout>
        );
    }

    if (profileError) {
        return (
            <Layout className="page-shell">
                <HeaderView />
                <Content className="page-content">
                    <Card className="glass-card state-card">
                        <Result
                            status="error"
                            title="Falha ao validar permissões"
                            subTitle={profileError}
                            extra={
                                <Button type="primary" onClick={() => navigate("/")}>
                                    Voltar para a home
                                </Button>
                            }
                        />
                    </Card>
                </Content>
            </Layout>
        );
    }

    if (!hasPermission) {
        return (
            <Layout className="page-shell">
                <HeaderView />
                <Content className="page-content">
                    <Card className="glass-card state-card">
                        <Result
                            status="403"
                            title="Acesso negado"
                            subTitle={unauthorizedMessage}
                            extra={
                                <Button type="primary" onClick={() => navigate("/")}>
                                    Voltar para a home
                                </Button>
                            }
                        />
                    </Card>
                </Content>
            </Layout>
        );
    }

    return <Outlet />;
}
