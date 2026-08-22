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

/** Os 17 tipos de evento de auditoria OAuth suportados pela API. */
export const OAUTH_AUDIT_EVENT_TYPES: string[] = [
    "CLIENT_CREATED",
    "CLIENT_UPDATED",
    "CLIENT_SECRET_ROTATED",
    "CLIENT_DISABLED",
    "CLIENT_REACTIVATED",
    "AUTHORIZATION_STARTED",
    "AUTHORIZATION_GRANTED",
    "AUTHORIZATION_DENIED",
    "TOKEN_ISSUED",
    "TOKEN_REFRESHED",
    "TOKEN_REVOKED",
    "TOKEN_REUSE_DETECTED",
    "RESOURCE_ALLOWED",
    "RESOURCE_DENIED",
    "LOAN_CREATED",
    "LOAN_RETURNED",
    "LICENSE_ACCESSED",
];
