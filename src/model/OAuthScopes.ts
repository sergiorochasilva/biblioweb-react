/**
 * Escopos e grant types OAuth2/OIDC permitidos, espelhando
 * `fronesis/oauth/scopes.py` do `biblioweb-api` (ALLOWED_SCOPES /
 * ALLOWED_GRANT_TYPES).
 */

export const ALLOWED_OAUTH_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "biblioweb.profile.read",
    "biblioweb.libraries.read",
    "biblioweb.catalog.read",
    "biblioweb.loans.read",
    "biblioweb.loans.write",
    "biblioweb.licenses.read",
    "biblioweb.integration.read",
] as const;

export type OAuthScope = (typeof ALLOWED_OAUTH_SCOPES)[number];

export const ALLOWED_OAUTH_GRANT_TYPES = [
    "authorization_code",
    "refresh_token",
    "client_credentials",
] as const;

export type OAuthGrantType = (typeof ALLOWED_OAUTH_GRANT_TYPES)[number];

const OAUTH_SCOPE_LABELS: Record<string, string> = {
    openid: "Confirmar sua identidade",
    profile: "Ver seu nome",
    email: "Ver seu e-mail",
    offline_access: "Continuar conectado sem precisar logar de novo",
    "biblioweb.profile.read": "Ver seu perfil BiblioWeb",
    "biblioweb.libraries.read": "Ver as bibliotecas às quais você tem acesso",
    "biblioweb.catalog.read": "Ver o catálogo das suas bibliotecas",
    "biblioweb.loans.read": "Ver seus empréstimos",
    "biblioweb.loans.write": "Criar e devolver empréstimos em seu nome",
    "biblioweb.licenses.read": "Baixar licenças dos seus empréstimos",
};

/**
 * Traduz um código de escopo OAuth para um texto amigável.
 *
 * Escopos sem tradução (ex: `biblioweb.integration.read`, que não está
 * na tabela de tradução do handoff) caem no fallback: o próprio código.
 *
 * @param scope Código do escopo (ex: "biblioweb.loans.read").
 * @returns Texto amigável, ou o próprio código quando não houver tradução.
 */
export function translateOAuthScope(scope: string): string {
    return OAUTH_SCOPE_LABELS[scope] || scope;
}

/**
 * Converte uma string de escopos separados por espaço em uma lista.
 *
 * @param value String bruta vinda da API (ex: "openid biblioweb.profile.read").
 * @returns Lista de códigos de escopo, sem entradas vazias.
 */
export function parseScopeString(value: string): string[] {
    return value
        .split(" ")
        .map((item) => item.trim())
        .filter(Boolean);
}
