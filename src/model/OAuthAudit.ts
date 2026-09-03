import { translateOAuthGrantType, translateOAuthScope } from "./OAuthPartnerPresentation.ts";

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

export type OAuthAuditEventCategory = "Parceiros" | "Autorização e segurança" | "Operações";

export type OAuthAuditDetail = {
    key: string;
    label: string;
    value: string;
    copyable?: boolean;
};

const OAUTH_AUDIT_EVENT_LABELS: Record<string, string> = {
    CLIENT_CREATED: "Parceiro cadastrado",
    CLIENT_UPDATED: "Parceiro atualizado",
    CLIENT_SECRET_ROTATED: "Novo segredo gerado",
    CLIENT_DISABLED: "Parceiro desativado",
    CLIENT_REACTIVATED: "Parceiro reativado",
    AUTHORIZATION_STARTED: "Autorização iniciada",
    AUTHORIZATION_GRANTED: "Autorização concedida",
    AUTHORIZATION_DENIED: "Autorização negada",
    TOKEN_ISSUED: "Token emitido",
    TOKEN_REFRESHED: "Token renovado",
    TOKEN_REVOKED: "Token revogado",
    TOKEN_REUSE_DETECTED: "Reutilização de token detectada",
    RESOURCE_ALLOWED: "Acesso permitido",
    RESOURCE_DENIED: "Acesso negado",
    LOAN_CREATED: "Empréstimo criado",
    LOAN_RETURNED: "Empréstimo devolvido",
    LICENSE_ACCESSED: "Licença acessada",
};

const OAUTH_AUDIT_RESULT_LABELS: Record<string, string> = {
    success: "Sucesso",
    allowed: "Permitido",
    denied: "Negado",
    failure: "Falha",
    failed: "Falha",
    error: "Erro",
};

/**
 * Traduz o código técnico de um evento OAuth para linguagem administrativa.
 *
 * @param eventType Código técnico recebido da API.
 * @returns Rótulo amigável, mantendo o código como fallback.
 */
export function translateOAuthAuditEventType(eventType: string): string {
    return OAUTH_AUDIT_EVENT_LABELS[eventType] || eventType;
}

/**
 * Traduz o resultado técnico de um evento de auditoria.
 *
 * @param result Resultado retornado pela API.
 * @returns Rótulo amigável, mantendo o valor como fallback.
 */
export function translateOAuthAuditResult(result: string): string {
    return OAUTH_AUDIT_RESULT_LABELS[result.toLocaleLowerCase("pt-BR")] || result;
}

/**
 * Classifica eventos para agrupamento do filtro da auditoria.
 *
 * @param eventType Código técnico do evento.
 * @returns Categoria funcional exibida ao administrador.
 */
export function getOAuthAuditEventCategory(eventType: string): OAuthAuditEventCategory {
    if (eventType.startsWith("CLIENT_")) {
        return "Parceiros";
    }

    if (
        eventType.startsWith("AUTHORIZATION_") ||
        eventType.startsWith("TOKEN_")
    ) {
        return "Autorização e segurança";
    }

    return "Operações";
}

/**
 * Resolve a cor semântica usada pelo badge de resultado na auditoria.
 *
 * @param result Resultado retornado pela API.
 * @param eventType Tipo do evento, usado para destacar incidentes de segurança.
 * @returns Cor semântica compatível com Tag do Ant Design.
 */
export function getOAuthAuditResultColor(
    result: string,
    eventType: string
): "success" | "error" | "warning" | "default" {
    const normalized = result.toLocaleLowerCase("pt-BR");
    if (eventType === "TOKEN_REUSE_DETECTED") {
        return "warning";
    }
    if (["denied", "failure", "failed", "error"].includes(normalized)) {
        return "error";
    }
    if (["success", "allowed"].includes(normalized)) {
        return "success";
    }
    return "default";
}

/**
 * Formata timestamps de auditoria aceitando datas ISO com ou sem timezone.
 * Timestamps sem timezone são tratados como UTC para manter o comportamento
 * histórico da interface sem invalidar valores que já possuem offset.
 *
 * @param value Timestamp recebido da API.
 * @param locale Locale usado na apresentação.
 * @param includeSeconds Inclui segundos quando precisão operacional for necessária.
 * @returns Data/hora localizada ou travessão quando o valor for inválido.
 */
export function formatOAuthAuditDateTime(
    value: string | null | undefined,
    locale: string = "pt-BR",
    includeSeconds: boolean = false
): string {
    if (!value) {
        return "—";
    }

    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    const parsed = new Date(hasTimezone ? value : `${value}Z`);
    if (Number.isNaN(parsed.getTime())) {
        return "—";
    }

    return parsed.toLocaleString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        ...(includeSeconds ? { second: "2-digit" } : {}),
    });
}

/**
 * Converte os metadados úteis de um evento em campos legíveis para o drawer.
 * `RESOURCE_*` não expõe `user_id` como usuário porque hoje esse campo pode
 * conter o identificador do próprio client OAuth nesses eventos.
 *
 * @param event Evento retornado pela API de auditoria.
 * @returns Lista ordenada de detalhes relevantes para o evento.
 */
export function getOAuthAuditEventDetails(event: OAuthAuditEvent): OAuthAuditDetail[] {
    const details: OAuthAuditDetail[] = [];
    const isResourceEvent = event.event_type.startsWith("RESOURCE_");

    if (event.user_id && !isResourceEvent) {
        details.push({ key: "user", label: "Usuário", value: event.user_id });
    }

    if (event.library_id !== null && event.library_id !== undefined) {
        details.push({ key: "library", label: "Biblioteca", value: String(event.library_id) });
    }

    const historicalName = event.metadata?.name;
    if (typeof historicalName === "string" && historicalName) {
        details.push({ key: "name", label: "Nome registrado", value: historicalName });
    }

    const grantType = event.metadata?.grant_type;
    if (typeof grantType === "string" && grantType) {
        details.push({
            key: "grant_type",
            label: "Tipo de integração",
            value: translateOAuthGrantType(grantType),
        });
    }

    const scope = event.metadata?.scope;
    if (typeof scope === "string" && scope.trim()) {
        const translatedScopes = scope
            .split(/\s+/)
            .filter(Boolean)
            .map(translateOAuthScope)
            .join(", ");
        details.push({ key: "scope", label: "Permissões", value: translatedScopes });
    }

    const bookId = event.metadata?.book_id;
    if (typeof bookId === "string" || typeof bookId === "number") {
        details.push({ key: "book", label: "Livro", value: String(bookId) });
    }

    const path = event.metadata?.path;
    if (typeof path === "string" && path) {
        details.push({ key: "path", label: "Rota", value: path });
    }

    const method = event.metadata?.method;
    if (typeof method === "string" && method) {
        details.push({ key: "method", label: "Método", value: method.toUpperCase() });
    }

    if (event.reason) {
        details.push({ key: "reason", label: "Motivo", value: event.reason });
    }

    if (event.correlation_id) {
        details.push({
            key: "correlation",
            label: "ID de correlação",
            value: event.correlation_id,
            copyable: true,
        });
    }

    return details;
}
