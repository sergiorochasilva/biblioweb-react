import { api } from "./api";
import {
    OAuthClient,
    OAuthClientCreatePayload,
    OAuthClientCreateResponse,
    OAuthClientListResponse,
    OAuthClientSecretPayload,
    OAuthClientSecretRevealResponse,
    OAuthClientUpdatePayload,
} from "../model/OAuthClient";

/**
 * Lista todos os clients OAuth cadastrados (ativos e inativos).
 *
 * @param token Token JWT de administrador global (`admin=true`).
 * @returns Lista completa de clients.
 */
export async function listOAuthClients(token: string): Promise<OAuthClient[]> {
    const response = await api.get<OAuthClientListResponse>("/oauth-clients", token);
    return response.items || [];
}

/**
 * Cria um novo client OAuth.
 *
 * @param token Token JWT de administrador global.
 * @param payload Dados do client a criar.
 * @returns Client criado e o link de revelação única do segredo.
 */
export async function createOAuthClient(
    token: string,
    payload: OAuthClientCreatePayload
): Promise<OAuthClientCreateResponse> {
    return api.post<OAuthClientCreateResponse>("/oauth-clients", payload, token);
}

/**
 * Atualiza os campos editáveis de um client OAuth existente.
 *
 * @param token Token JWT de administrador global.
 * @param clientId Identificador do client.
 * @param payload Novos valores dos campos editáveis.
 * @returns Client atualizado.
 */
export async function updateOAuthClient(
    token: string,
    clientId: string,
    payload: OAuthClientUpdatePayload
): Promise<OAuthClient> {
    return api.put<OAuthClient>(`/oauth-clients/${encodeURIComponent(clientId)}`, payload, token);
}

/**
 * Desativa um client OAuth (remoção lógica; não há endpoint de reversão).
 *
 * @param token Token JWT de administrador global.
 * @param clientId Identificador do client.
 * @returns Promise<void>.
 */
export async function deactivateOAuthClient(token: string, clientId: string): Promise<void> {
    await api.delete(`/oauth-clients/${encodeURIComponent(clientId)}`, token);
}

/**
 * Reativa um client OAuth previamente desativado.
 *
 * @param token Token JWT de administrador global.
 * @param clientId Identificador do client.
 * @returns Client reativado.
 */
export async function reactivateOAuthClient(token: string, clientId: string): Promise<OAuthClient> {
    return api.post<OAuthClient>(
        `/oauth-clients/${encodeURIComponent(clientId)}/reactivate`,
        {},
        token
    );
}

/**
 * Gera um novo `client_secret` para um client existente, invalidando o
 * anterior imediatamente.
 *
 * @param token Token JWT de administrador global.
 * @param clientId Identificador do client.
 * @returns Link de revelação única do novo segredo.
 */
export async function rotateOAuthClientSecret(
    token: string,
    clientId: string
): Promise<OAuthClientSecretRevealResponse> {
    return api.post<OAuthClientSecretRevealResponse>(
        `/oauth-clients/${encodeURIComponent(clientId)}/rotate-secret`,
        {},
        token
    );
}

/**
 * Revela o `client_secret` em texto puro a partir do token de um link de
 * revelação única — endpoint público, sem autenticação (protegido só pela
 * posse do token de alta entropia). Funciona uma única vez; chamadas
 * subsequentes com o mesmo token retornam `404`.
 *
 * @param revealToken Token extraído do fragmento da URL de revelação.
 * @returns O `client_secret` em texto puro.
 */
export async function revealOAuthClientSecret(
    revealToken: string
): Promise<OAuthClientSecretPayload> {
    return api.post<OAuthClientSecretPayload>("/oauth-clients/secret-reveal", {
        token: revealToken,
    });
}
