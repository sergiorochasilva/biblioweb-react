/** Evento de auditoria OAuth, como devolvido pela API administrativa. */
export type OAuthAuditEvent = {
    event_type: string;
    client_id: string | null;
    user_id: string | null;
    library_id: number | null;
    correlation_id: string;
    result: string;
    reason: string | null;
    metadata: Record<string, unknown>;
    created_at: string | null;
};

/** Evento de histórico de client (GET /oauth-clients/<id>/history) — subconjunto. */
export type OAuthClientHistoryEvent = {
    event_type: string;
    result: string;
    reason: string | null;
    metadata: Record<string, unknown>;
    created_at: string | null;
};

export type OAuthAuditPagination = {
    page: number;
    page_size: number;
    total: number;
};

export type OAuthClientHistoryResponse = {
    items: OAuthClientHistoryEvent[];
    pagination: OAuthAuditPagination;
};

export type OAuthAuditEventsResponse = {
    items: OAuthAuditEvent[];
    pagination: OAuthAuditPagination;
};

export type OAuthAuditFilters = {
    event_type?: string;
    client_id?: string;
    user_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
};
