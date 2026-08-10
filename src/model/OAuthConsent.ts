/**
 * Resposta de `GET /oauth/authorize/requests/<id>`. `scope`,
 * `already_granted_scopes` e `new_scopes` são strings de escopos
 * separados por espaço — usar `parseScopeString` (OAuthScopes.ts) para
 * converter em lista.
 */
export type OAuthAuthorizeRequestInfo = {
    client_id: string;
    client_name: string | null;
    scope: string;
    consent_required: boolean;
    already_granted_scopes: string;
    new_scopes: string;
};

export type OAuthAuthorizeDecisionResponse = {
    redirect_uri: string;
};

/** Item de `GET /oauth/consents`. `scopes` já vem como lista (array). */
export type OAuthConnectedApp = {
    client_id: string;
    client_name: string;
    scopes: string[];
    granted_at: string;
    updated_at: string;
};

export type OAuthConsentsListResponse = {
    items: OAuthConnectedApp[];
};
