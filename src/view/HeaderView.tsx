import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Dropdown, Input, Layout, message, type MenuProps } from "antd";
import { RobotOutlined, SearchOutlined } from "@ant-design/icons";
import logo from "../assets/logo.png";
import "../styles/HeaderView.css";
import { useAuth } from "../contexts/useAuth";
import { api } from "../service/api";
import {
    hasGlobalAdminPermission,
    hasPublisherAdminPermission,
} from "../service/permissions";
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
    const isAdmin = useMemo(() => hasGlobalAdminPermission(profile), [profile]);
    const isPublisherAdmin = useMemo(() => hasPublisherAdminPermission(profile), [profile]);

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

    /**
     * Abre o chat do bibliotecário, reutilizando o texto digitado na barra.
     *
     * @returns void
     */
    const doAskBibliotecario = () => {
        const normalized = input.trim();
        if (!normalized) {
            message.warning("Escreva algo antes de perguntar ao bibliotecário.");
            return;
        }
        navigate(`/bibliotecario?message=${encodeURIComponent(normalized)}`, {
            state: { fromSearchAsk: true },
        });
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
        ...(isPublisherAdmin
            ? [
                  {
                      key: "publisher-admin",
                      label: "Adminstrar Editora",
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

        if (key === "publisher-admin") {
            navigate("/publisher-admin");
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
                        <div className="header-center-actions">
                            <Button
                                className="categories-button"
                                type="text"
                                onClick={() => navigate("/")}
                            >
                                Home
                            </Button>
                            <Button
                                className="categories-button"
                                type="text"
                                onClick={() => navigate("/bibliotecario", { state: { freshChat: true } })}
                            >
                                Bibliotecário
                            </Button>
                            <Button
                                className="categories-button"
                                type="text"
                                onClick={() => navigate("/subjects")}
                            >
                                Assuntos
                            </Button>
                            <Button
                                className="categories-button"
                                type="text"
                                onClick={() => navigate("/authors")}
                            >
                                Autores
                            </Button>
                            {isAuthenticated && (
                                <Button
                                    className="categories-button"
                                    type="text"
                                    onClick={() => navigate("/meus-livros")}
                                >
                                    Meus livros
                                </Button>
                            )}
                        </div>
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

                <div className="header-search-wrap">
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
                    <Button
                        className="advanced-search-button"
                        onClick={() => navigate("/advanced-search")}
                    >
                        Busca avançada
                    </Button>
                    <Button
                        className="advanced-search-button bibliotecario-search-button"
                        icon={<RobotOutlined />}
                        onClick={doAskBibliotecario}
                    >
                        Pergunte ao bibliotecário
                    </Button>
                </div>
            </div>
        </Header>
    );
}
