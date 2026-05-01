import { createContext } from "react";
import type { Library, ProfileData, Publisher } from "../types";
import type { AuthTokenResponse } from "../service/authTypes";

export type AuthSession = {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
};

export type AccessTokenOptions = {
    redirectOnFail?: boolean;
};

export interface AuthContextType {
    token: string | null;
    refreshToken: string | null;
    tokenExpiresAt: number | null;
    publisher: Publisher | null;
    library: Library | null;
    profile: ProfileData | null;
    setToken: (token: string | null) => void;
    setSession: (session: AuthSession) => void;
    setSessionFromResponse: (response: AuthTokenResponse) => string | null;
    getAccessToken: (options?: AccessTokenOptions) => Promise<string | null>;
    setPublisher: (publisher: Publisher | null) => void;
    setLibrary: (library: Library | null) => void;
    setProfile: (profile: ProfileData | null) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
