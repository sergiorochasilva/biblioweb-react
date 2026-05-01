import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    ReactNode,
} from "react";
import { api } from "../service/api";
import type { AuthTokenResponse } from "../service/authTypes";
import { AuthContext, type AccessTokenOptions, type AuthSession } from "./authContext";
import type { Library, ProfileData, Publisher } from "../types";

const TOKEN_EXPIRY_BUFFER_MS = 30_000;

/**
 * Converte timestamps de expiração para epoch em ms.
 *
 * @param raw Valor de expiração recebido da API (segundos ou ms).
 * @returns Epoch em ms ou null quando inválido.
 */
function normalizeExpiresAt(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return value > 1e12 ? value : value * 1000;
}

/**
 * Extrai payload de um JWT sem validação de assinatura.
 *
 * @param token JWT a ser decodificado.
 * @returns Objeto payload ou null quando inválido.
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    try {
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
        const decoded = atob(padded);
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

/**
 * Resolve expiração a partir do JWT.
 *
 * @param token JWT a ser inspecionado.
 * @returns Epoch em ms ou null quando não disponível.
 */
function resolveExpiresAtFromToken(token: string): number | null {
    const payload = parseJwtPayload(token);
    if (!payload || payload.exp === undefined) return null;
    return normalizeExpiresAt(payload.exp);
}

/**
 * Resolve expiração retornada pela API de autenticação.
 *
 * @param response Payload retornado pela API.
 * @param now Timestamp atual em ms.
 * @returns Epoch em ms ou null quando ausente.
 */
function resolveExpiresAtFromResponse(response: AuthTokenResponse, now: number): number | null {
    const directExpires = response.expires_at ?? response.expires ?? response.exp;
    const normalized = normalizeExpiresAt(directExpires);
    if (normalized) return normalized;

    if (response.expires_in !== undefined) {
        const delta = Number(response.expires_in);
        if (Number.isFinite(delta)) {
            return now + delta * 1000;
        }
    }

    return null;
}

/**
 * Resolve o caminho atual da aplicação sem o basename do router.
 *
 * @returns Caminho absoluto dentro do app (ex: "/book/1").
 */
function resolveNextPath(): string {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
    const basePrefix = base && base !== "/" ? base : "";
    const fullPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    let nextPath = fullPath;

    if (basePrefix && fullPath.startsWith(basePrefix)) {
        nextPath = fullPath.slice(basePrefix.length) || "/";
    }

    if (!nextPath.startsWith("/")) {
        nextPath = `/${nextPath}`;
    }

    return nextPath;
}

/**
 * Redireciona para o login preservando o caminho atual.
 *
 * @returns void
 */
function redirectToLogin(): void {
    const nextPath = resolveNextPath();
    if (
        nextPath.startsWith("/login") ||
        nextPath.startsWith("/verify-code") ||
        nextPath.startsWith("/login-password")
    ) {
        return;
    }

    const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
    const basePrefix = base && base !== "/" ? base : "";
    const target = `${basePrefix}/login?next=${encodeURIComponent(nextPath)}`;
    window.location.assign(target);
}

/**
 * Provider que mantém sessão autenticada e dados de perfil sincronizados
 * com o localStorage.
 *
 * @param children Árvore React que terá acesso ao contexto.
 * @returns Componente Provider do contexto de autenticação.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [token, setTokenState] = useState<string | null>(localStorage.getItem("token"));
    const [refreshToken, setRefreshTokenState] = useState<string | null>(
        localStorage.getItem("refresh_token")
    );
    const [tokenExpiresAt, setTokenExpiresAtState] = useState<number | null>(() => {
        const stored = localStorage.getItem("token_expires_at");
        if (!stored) return null;
        const parsed = Number(stored);
        return Number.isFinite(parsed) ? parsed : null;
    });
    const [publisher, setPublisherState] = useState<Publisher | null>(() => {
        const saved = localStorage.getItem("publisher");
        return saved ? JSON.parse(saved) : null;
    });
    const [library, setLibraryState] = useState<Library | null>(() => {
        const saved = localStorage.getItem("library");
        return saved ? JSON.parse(saved) : null;
    });
    const [profile, setProfileState] = useState<ProfileData | null>(() => {
        const saved = localStorage.getItem("profile");
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (token) {
            localStorage.setItem("token", token);
        } else {
            localStorage.removeItem("token");
        }
    }, [token]);

    useEffect(() => {
        if (refreshToken) {
            localStorage.setItem("refresh_token", refreshToken);
        } else {
            localStorage.removeItem("refresh_token");
        }
    }, [refreshToken]);

    useEffect(() => {
        if (tokenExpiresAt) {
            localStorage.setItem("token_expires_at", String(tokenExpiresAt));
        } else {
            localStorage.removeItem("token_expires_at");
        }
    }, [tokenExpiresAt]);

    useEffect(() => {
        if (publisher) {
            localStorage.setItem("publisher", JSON.stringify(publisher));
        } else {
            localStorage.removeItem("publisher");
        }
    }, [publisher]);

    useEffect(() => {
        if (library) {
            localStorage.setItem("library", JSON.stringify(library));
        } else {
            localStorage.removeItem("library");
        }
    }, [library]);

    useEffect(() => {
        if (profile) {
            localStorage.setItem("profile", JSON.stringify(profile));
        } else {
            localStorage.removeItem("profile");
        }
    }, [profile]);

    /**
     * Atualiza o token JWT da sessão.
     *
     * @param newToken Novo token ou null para limpar sessão.
     * @returns void
     */
    const setToken = useCallback((newToken: string | null): void => {
        setTokenState(newToken);
        if (!newToken) {
            setRefreshTokenState(null);
            setTokenExpiresAtState(null);
            return;
        }

        const derivedExpiresAt = resolveExpiresAtFromToken(newToken);
        if (derivedExpiresAt) {
            setTokenExpiresAtState(derivedExpiresAt);
        }
    }, []);

    /**
     * Atualiza tokens de sessão (access/refresh) e expiração.
     *
     * @param session Estrutura com tokens e expiração.
     * @returns void
     */
    const setSession = useCallback((session: AuthSession): void => {
        if (!session.accessToken) {
            setTokenState(null);
            setRefreshTokenState(null);
            setTokenExpiresAtState(null);
            return;
        }

        setTokenState(session.accessToken);
        setRefreshTokenState(session.refreshToken);
        setTokenExpiresAtState(session.expiresAt);
    }, []);

    /**
     * Aplica sessão a partir do payload retornado pela API de autenticação.
     *
     * @param response Payload retornado pela API.
     * @returns Access token aplicado ou null quando inválido.
     */
    const setSessionFromResponse = useCallback(
        (response: AuthTokenResponse): string | null => {
            const accessToken = response?.access_token || null;
            if (!accessToken) return null;

            const now = Date.now();
            const expiresAt =
                resolveExpiresAtFromResponse(response, now) ??
                resolveExpiresAtFromToken(accessToken);
            const nextRefreshToken = response.refresh_token ?? refreshToken ?? null;

            setSession({
                accessToken,
                refreshToken: nextRefreshToken,
                expiresAt,
            });

            return accessToken;
        },
        [refreshToken, setSession]
    );

    /**
     * Atualiza a editora selecionada no contexto.
     *
     * @param newPublisher Editora selecionada ou null.
     * @returns void
     */
    const setPublisher = useCallback((newPublisher: Publisher | null): void => {
        setPublisherState(newPublisher);
    }, []);

    /**
     * Atualiza a biblioteca selecionada no contexto.
     *
     * @param newLibrary Biblioteca selecionada ou null.
     * @returns void
     */
    const setLibrary = useCallback((newLibrary: Library | null): void => {
        setLibraryState(newLibrary);
    }, []);

    /**
     * Atualiza o profile completo do usuário autenticado.
     *
     * @param newProfile Estrutura de profile ou null.
     * @returns void
     */
    const setProfile = useCallback((newProfile: ProfileData | null): void => {
        setProfileState(newProfile);
    }, []);

    /**
     * Remove a sessão atual e limpa dados persistidos no navegador.
     *
     * @returns void
     */
    const logout = useCallback((): void => {
        setToken(null);
        setPublisher(null);
        setLibrary(null);
        setProfile(null);
        localStorage.clear();
        sessionStorage.removeItem("login_email");
        sessionStorage.removeItem("pending_post_login_action");
    }, [setToken, setPublisher, setLibrary, setProfile]);

    const refreshInFlight = useRef<Promise<string | null> | null>(null);

    /**
     * Renova o token usando o refresh_token atual.
     *
     * @returns Access token renovado ou null quando falhar.
     */
    const refreshAccessToken = useCallback(async (): Promise<string | null> => {
        if (!refreshToken) {
            logout();
            return null;
        }

        if (refreshInFlight.current) {
            return refreshInFlight.current;
        }

        const refreshPromise = (async () => {
            try {
                const response = await api.post<AuthTokenResponse>("/token", {
                    type: "token",
                    refresh_token: refreshToken,
                });
                const refreshedToken = setSessionFromResponse(response);
                if (!refreshedToken) {
                    throw new Error("Token não recebido da API.");
                }
                return refreshedToken;
            } catch (error) {
                logout();
                throw error;
            } finally {
                refreshInFlight.current = null;
            }
        })();

        refreshInFlight.current = refreshPromise;
        return refreshPromise;
    }, [refreshToken, logout, setSessionFromResponse]);

    /**
     * Recupera o access_token garantindo validade mínima de 30 segundos.
     *
     * @param options Ajustes de comportamento (ex: redirecionar em falhas).
     * @returns Access token válido ou null quando ausente.
     */
    const getAccessToken = useCallback(async (
        options?: AccessTokenOptions
    ): Promise<string | null> => {
        if (!token) return null;

        const now = Date.now();
        const resolvedExpiresAt = tokenExpiresAt ?? resolveExpiresAtFromToken(token);

        if (!tokenExpiresAt && resolvedExpiresAt) {
            setTokenExpiresAtState(resolvedExpiresAt);
        }

        if (resolvedExpiresAt && resolvedExpiresAt - now <= TOKEN_EXPIRY_BUFFER_MS) {
            try {
                const refreshedToken = await refreshAccessToken();
                if (!refreshedToken && options?.redirectOnFail !== false) {
                    redirectToLogin();
                }
                return refreshedToken;
            } catch {
                if (options?.redirectOnFail !== false) {
                    redirectToLogin();
                }
                return null;
            }
        }

        return token;
    }, [token, tokenExpiresAt, refreshAccessToken]);

    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider
            value={{
                token,
                refreshToken,
                tokenExpiresAt,
                publisher,
                library,
                profile,
                setToken,
                setSession,
                setSessionFromResponse,
                getAccessToken,
                setPublisher,
                setLibrary,
                setProfile,
                logout,
                isAuthenticated,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
