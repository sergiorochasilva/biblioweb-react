import { api } from "./api";
import {
    OAuthAuthorizeDecisionResponse,
    OAuthAuthorizeRequestInfo,
    OAuthConnectedApp,
    OAuthConsentsListResponse,
} from "../model/OAuthConsent";

/**
 * Busca os dados de uma solicitação de autorização OAuth pendente.
 *
 * @param requestId Identificador da solicitação (query `request_id`).
 * @param token Token JWT de login normal do BiblioWeb (nunca token OAuth).
 * @returns Dados do client, escopos pedidos e estado de consentimento.
 */
export async function getAuthorizeRequest(
    requestId: string,
    token: string
): Promise<OAuthAuthorizeRequestInfo> {
    return api.get<OAuthAuthorizeRequestInfo>(
        `/oauth/authorize/requests/${encodeURIComponent(requestId)}`,
        token
    );
}

/**
 * Aprova uma solicitação de autorização OAuth pendente.
 *
 * @param requestId Identificador da solicitação.
 * @param token Token JWT de login normal do BiblioWeb.
 * @returns URL de redirecionamento para o app parceiro.
 */
export async function approveAuthorizeRequest(
    requestId: string,
    token: string
): Promise<OAuthAuthorizeDecisionResponse> {
    return api.post<OAuthAuthorizeDecisionResponse>(
        `/oauth/authorize/requests/${encodeURIComponent(requestId)}/approve`,
        {},
        token
    );
}

/**
 * Nega uma solicitação de autorização OAuth pendente.
 *
 * @param requestId Identificador da solicitação.
 * @param token Token JWT de login normal do BiblioWeb.
 * @returns URL de redirecionamento para o app parceiro.
 */
export async function denyAuthorizeRequest(
    requestId: string,
    token: string
): Promise<OAuthAuthorizeDecisionResponse> {
    return api.post<OAuthAuthorizeDecisionResponse>(
        `/oauth/authorize/requests/${encodeURIComponent(requestId)}/deny`,
        {},
        token
    );
}

/**
 * Lista os apps parceiros que o usuário autenticado já autorizou.
 *
 * @param token Token JWT de login normal do BiblioWeb.
 * @returns Lista de apps conectados com escopos e datas.
 */
export async function listConsents(token: string): Promise<OAuthConnectedApp[]> {
    const response = await api.get<OAuthConsentsListResponse>("/oauth/consents", token);
    return response.items || [];
}

/**
 * Revoga o consentimento de um app parceiro para o usuário autenticado.
 *
 * `404` (nenhum consentimento ativo para este client) é tratado como
 * sucesso idempotente — o resultado desejado já vale.
 *
 * @param clientId Identificador do client a desconectar.
 * @param token Token JWT de login normal do BiblioWeb.
 * @returns Promise<void>.
 */
export async function revokeConsent(clientId: string, token: string): Promise<void> {
    try {
        await api.delete(`/oauth/consents/${encodeURIComponent(clientId)}`, token);
    } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
            return;
        }
        throw error;
    }
}
