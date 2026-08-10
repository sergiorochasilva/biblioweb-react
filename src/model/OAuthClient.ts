import { OAuthGrantType, OAuthScope } from "./OAuthScopes";

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
};

export type OAuthClientUpdatePayload = OAuthClientCreatePayload;

/** `client_secret` nunca aparece aqui — só o link de revelação única. */
export type OAuthClientSecretRevealResponse = {
    secret_reveal_url: string;
};

export type OAuthClientCreateResponse = OAuthClient & OAuthClientSecretRevealResponse;
