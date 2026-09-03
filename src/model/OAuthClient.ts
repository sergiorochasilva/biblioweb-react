import { OAuthGrantType, OAuthScope } from "./OAuthScopes";

/** Contato técnico responsável por um client OAuth. */
export type OAuthClientTechnicalContact = {
    name: string;
    email: string;
};

/** Client OAuth tal como devolvido pela API administrativa (sem segredo). */
export type OAuthClient = {
    id: string;
    name: string;
    redirect_uris: string[];
    grant_types: string[];
    scopes: string[];
    is_confidential: boolean;
    active: boolean;
    created_at: string | null;
    description: string | null;
    organization: string | null;
    technical_contacts: OAuthClientTechnicalContact[];
    expires_at: string | null;
    library_ids: number[];
};

export type OAuthClientListResponse = {
    items: OAuthClient[];
};

export type OAuthClientCreatePayload = {
    name: string;
    redirect_uris: string[];
    grant_types: OAuthGrantType[];
    scopes: OAuthScope[];
    is_confidential: boolean;
    description?: string | null;
    organization?: string | null;
    technical_contacts?: OAuthClientTechnicalContact[];
    expires_at?: string | null;
    library_ids?: number[];
};

export type OAuthClientUpdatePayload = OAuthClientCreatePayload;

/** `client_secret` nunca aparece aqui — só o link de revelação única. */
export type OAuthClientSecretRevealResponse = {
    secret_reveal_url: string;
};

export type OAuthClientCreateResponse = OAuthClient & OAuthClientSecretRevealResponse;

/**
 * Resposta de `POST /oauth-clients/secret-reveal` — a única estrutura no
 * codebase onde um `client_secret` em texto puro aparece legitimamente,
 * e só na página pública de revelação única (nunca na área administrativa
 * logada).
 */
export type OAuthClientSecretPayload = {
    client_secret: string;
};
