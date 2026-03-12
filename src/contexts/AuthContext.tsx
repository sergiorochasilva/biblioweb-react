import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Library, ProfileData, Publisher } from "../types";

/**
 * Contrato do contexto global de autenticação e seleção de ambiente.
 */
interface AuthContextType {
    token: string | null;
    publisher: Publisher | null;
    library: Library | null;
    profile: ProfileData | null;
    setToken: (token: string | null) => void;
    setPublisher: (publisher: Publisher | null) => void;
    setLibrary: (library: Library | null) => void;
    setProfile: (profile: ProfileData | null) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider que mantém sessão autenticada e dados de perfil sincronizados
 * com o localStorage.
 *
 * @param children Árvore React que terá acesso ao contexto.
 * @returns Componente Provider do contexto de autenticação.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [token, setTokenState] = useState<string | null>(localStorage.getItem("token"));
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
    const setToken = (newToken: string | null): void => {
        setTokenState(newToken);
    };

    /**
     * Atualiza a editora selecionada no contexto.
     *
     * @param newPublisher Editora selecionada ou null.
     * @returns void
     */
    const setPublisher = (newPublisher: Publisher | null): void => {
        setPublisherState(newPublisher);
    };

    /**
     * Atualiza a biblioteca selecionada no contexto.
     *
     * @param newLibrary Biblioteca selecionada ou null.
     * @returns void
     */
    const setLibrary = (newLibrary: Library | null): void => {
        setLibraryState(newLibrary);
    };

    /**
     * Atualiza o profile completo do usuário autenticado.
     *
     * @param newProfile Estrutura de profile ou null.
     * @returns void
     */
    const setProfile = (newProfile: ProfileData | null): void => {
        setProfileState(newProfile);
    };

    /**
     * Remove a sessão atual e limpa dados persistidos no navegador.
     *
     * @returns void
     */
    const logout = (): void => {
        setToken(null);
        setPublisher(null);
        setLibrary(null);
        setProfile(null);
        localStorage.clear();
        sessionStorage.removeItem("login_email");
        sessionStorage.removeItem("pending_post_login_action");
    };

    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider
            value={{
                token,
                publisher,
                library,
                profile,
                setToken,
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

export const useAuth = () => {
    /**
     * Hook de acesso ao contexto de autenticação.
     *
     * @returns Objeto com estado e ações de autenticação.
     * @throws Error Quando utilizado fora de ``AuthProvider``.
     */
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
