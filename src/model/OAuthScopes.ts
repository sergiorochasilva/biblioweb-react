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
