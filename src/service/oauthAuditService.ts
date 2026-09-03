import { api } from "./api";
import {
    OAuthAuditFilters,
    OAuthAuditEventsResponse,
    OAuthClientHistoryResponse,
} from "../model/OAuthAudit";

/**
 * Busca o histórico de alterações de um client OAuth (RF-002).
 *
 * @param token Token JWT de administrador global.
 * @param clientId Identificador do client.
 * @param page Página (1-based).
 * @param pageSize Itens por página.
 * @returns Eventos CLIENT_* daquele client, mais recentes primeiro.
 */
export async function fetchClientHistory(
    token: string,
    clientId: string,
    page: number = 1,
    pageSize: number = 20
): Promise<OAuthClientHistoryResponse> {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    return api.get<OAuthClientHistoryResponse>(
        `/oauth-clients/${encodeURIComponent(clientId)}/history?${query.toString()}`,
        token
    );
}

/**
 * Consulta geral de eventos de auditoria OAuth (RNF-008), com filtros.
 *
 * @param token Token JWT de administrador global.
 * @param filters Filtros opcionais (tipo de evento, client, usuário, período) e paginação.
 * @returns Página de eventos, mais recentes primeiro.
 */
export async function fetchAuditEvents(
    token: string,
    filters: OAuthAuditFilters = {}
): Promise<OAuthAuditEventsResponse> {
    const query = new URLSearchParams();
    if (filters.event_type) query.set("event_type", filters.event_type);
    if (filters.client_id) query.set("client_id", filters.client_id);
    if (filters.user_id) query.set("user_id", filters.user_id);
    if (filters.date_from) query.set("date_from", filters.date_from);
    if (filters.date_to) query.set("date_to", filters.date_to);
    query.set("page", String(filters.page ?? 1));
    query.set("page_size", String(filters.page_size ?? 20));

    return api.get<OAuthAuditEventsResponse>(`/oauth/audit-events?${query.toString()}`, token);
}
