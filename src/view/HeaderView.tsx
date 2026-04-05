import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Dropdown, Input, Layout, type MenuProps } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import logo from "../assets/logo.png";
import "../styles/HeaderView.css";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../service/api";
import type { ProfileData } from "../types";

/**
 * Extrai o payload de um JWT sem validação de assinatura.
 *
 * @param token JWT no formato ``header.payload.signature``.
 * @returns Objeto payload decodificado ou ``null``.
 */
function getTokenPayload(token: string | null): Record<string, unknown> | null {
    if (!token) {
        return null;
    }

    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }

    const payloadPart = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = payloadPart.padEnd(payloadPart.length + ((4 - (payloadPart.length % 4)) % 4), "=");

    try {
        return JSON.parse(atob(paddedPayload)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/**
 * Extrai o e-mail de um JWT sem validação de assinatura.
 *
 * @param token JWT no formato ``header.payload.signature``.
 * @returns E-mail do payload ou ``null``.
 */
function getEmailFromToken(token: string | null): string | null {
    const payload = getTokenPayload(token);
    const email = payload?.email;
    return typeof email === "string" ? email : null;
}

/**
 * Extrai a flag admin de um JWT sem validação de assinatura.
 *
 * @param token JWT no formato ``header.payload.signature``.
 * @returns ``true`` quando o payload indicar perfil administrador.
 */
function getAdminFromToken(token: string | null): boolean {
    const payload = getTokenPayload(token);
    const adminValue = payload?.admin ?? payload?.is_admin ?? payload?.isAdmin;
    const roleValue = payload?.role ?? payload?.profile ?? payload?.user_role;

    if (adminValue === true || adminValue === 1 || adminValue === "1") {
        return true;
    }

    if (typeof roleValue === "string" && roleValue.trim().toLowerCase() === "admin") {
        return true;
    }

    return false;
}

/**
 * Extrai flag admin a partir do profile em memória.
 *
 * @param profile Perfil do contexto de autenticação.
 * @returns ``true`` quando o profile indicar administração.
 */
function getAdminFromProfile(profile: ProfileData | null): boolean {
    if (!profile || typeof profile !== "object") {
        return false;
    }

    const rawProfile = profile as unknown as Record<string, unknown>;
    const adminValue = rawProfile.admin ?? rawProfile.is_admin ?? rawProfile.isAdmin;
    const roleValue = rawProfile.role ?? rawProfile.profile ?? rawProfile.user_role;

    if (adminValue === true || adminValue === 1 || adminValue === "1") {
        return true;
    }

    if (typeof roleValue === "string" && roleValue.trim().toLowerCase() === "admin") {
        return true;
    }

    return false;
}

/**
 * Verifica se o identificador de usuário representa o admin padrão.
 *
 * @param email E-mail do usuário autenticado.
 * @returns ``true`` quando o usuário for ``admin``.
 */
function isAdminUser(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    if (normalized === "admin") {
        return true;
    }

    const localPart = normalized.split("@")[0] || "";
    return localPart === "admin";
}

/**
 * Gera iniciais do usuário a partir do e-mail.
 *
 * @param email E-mail do usuário.
 * @returns Iniciais (duas letras) em maiúsculo.
 */
function getInitialsFromEmail(email: string): string {
    const localPart = email.split("@")[0] || "";
    const cleanParts = localPart
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .split(/[._-]+/)
        .filter((part) => Boolean(part));

    if (cleanParts.length >= 2) {
        return `${cleanParts[0][0]}${cleanParts[1][0]}`.toUpperCase();
    }

    if (cleanParts.length === 1 && cleanParts[0].length >= 2) {
        return cleanParts[0].slice(0, 2).toUpperCase();
    }

    if (cleanParts.length === 1) {
        return `${cleanParts[0][0]}${cleanParts[0][0]}`.toUpperCase();
    }

    return "US";
}

export default function HeaderView() {
    const { Header } = Layout;
    const navigate = useNavigate();
    const location = useLocation();
    const query = new URLSearchParams(location.search).get("query") || "";
    const [input, setInput] = useState(query);
    const { isAuthenticated, profile, token, logout, getAccessToken, setProfile } = useAuth();

    useEffect(() => {
        setInput(query);
    }, [query]);

    const profileEmail = profile?.email;

    useEffect(() => {
        let isActive = true;

        /**
         * Hidrata o profile no contexto para manter menu e permissões consistentes.
         *
         * @returns Promise<void>
         */
        const hydrateProfile = async (): Promise<void> => {
            if (!isAuthenticated || !token) {
                return;
            }

            const tokenEmail = getEmailFromToken(token);
            if (profileEmail && (!tokenEmail || profileEmail === tokenEmail)) {
                return;
            }

            const accessToken = await getAccessToken({ redirectOnFail: false });
            if (!accessToken || !isActive) {
                return;
            }

            try {
                const loadedProfile = await api.get<ProfileData>("/profile", accessToken);
                if (!isActive) {
                    return;
                }
                setProfile(loadedProfile);
            } catch (error) {
                console.error("Failed to hydrate profile in header", error);
            }
        };

        void hydrateProfile();

        return () => {
            isActive = false;
        };
    }, [isAuthenticated, token, profileEmail, getAccessToken, setProfile]);

    const userEmail = useMemo(
        () => profile?.email || getEmailFromToken(token) || "",
        [profile?.email, token]
    );

    const initials = useMemo(() => {
        if (!userEmail) {
            return "US";
        }
        return getInitialsFromEmail(userEmail);
    }, [userEmail]);
    const isAdmin = useMemo(
        () => getAdminFromProfile(profile) || getAdminFromToken(token) || isAdminUser(userEmail),
        [profile, token, userEmail]
    );

    /**
     * Dispara a navegação para ``/search?query=...``.
     *
     * @param term Termo de pesquisa informado no input.
     */
    const doSearch = (term: string) => {
        const normalized = term.trim();
        if (!normalized) {
            navigate("/search");
            return;
        }
        navigate(`/search?query=${encodeURIComponent(normalized)}`);
    };

    const menuItems: MenuProps["items"] = [
        {
            key: "profile",
            label: "Meu perfil",
        },
        ...(isAdmin
            ? [
                  {
                      key: "admin",
                      label: "Administração",
                  },
              ]
            : []),
        {
            type: "divider",
        },
        {
            key: "logout",
            label: "Sair",
        },
    ];

    /**
     * Trata ações do menu de usuário.
     *
     * @param key Chave do item selecionado.
     */
    const handleUserMenuClick = ({ key }: { key: string }) => {
        if (key === "profile") {
            navigate("/profile");
            return;
        }

        if (key === "admin") {
            navigate("/admin");
            return;
        }

        if (key === "logout") {
            logout();
            navigate("/");
        }
    };

    return (
        <Header className="glass-header">
            <div className="header-inner">
                <div className="header-top">
                    <div className="header-slot-left">
                        <Button
                            className="logo-button"
                            type="text"
                            onClick={() => navigate("/")}
                            aria-label="Ir para a página inicial"
                        >
                            <img src={logo} alt="BiblioWeb Logo" className="logo-image" />
                        </Button>
                    </div>

                    <div className="header-slot-center">
                        <Button
                            className="categories-button"
                            type="text"
                            onClick={() => navigate("/categories")}
                        >
                            Categorias
                        </Button>
                    </div>

                    <div className="header-slot-right">
                        {isAuthenticated ? (
                            <Dropdown
                                menu={{
                                    items: menuItems,
                                    onClick: handleUserMenuClick,
                                }}
                                trigger={["click"]}
                                placement="bottomRight"
                            >
                                <Button className="profile-button" type="text" aria-label="Abrir perfil">
                                    {initials}
                                </Button>
                            </Dropdown>
                        ) : (
                            <Button
                                className="header-login-button"
                                type="text"
                                onClick={() => {
                                    const nextPath = `${location.pathname}${location.search}${location.hash}`;
                                    navigate(`/login?next=${encodeURIComponent(nextPath)}`);
                                }}
                            >
                                Entrar
                            </Button>
                        )}
                    </div>
                </div>

                <Input.Search
                    placeholder="Procure por: título, autor ou descrição de um livro"
                    className="header-search"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onSearch={doSearch}
                    enterButton={<SearchOutlined />}
                    allowClear
                    size="large"
                />
            </div>
        </Header>
    );
}
