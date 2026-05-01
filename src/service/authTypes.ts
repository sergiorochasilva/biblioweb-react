/**
 * Estrutura normalizada do payload de tokens retornado pela API de autenticação.
 */
export type AuthTokenResponse = {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number | string;
    expires_in?: number | string;
    expires?: number | string;
    exp?: number | string;
};
