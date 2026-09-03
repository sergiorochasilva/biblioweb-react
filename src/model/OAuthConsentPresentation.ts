import type { OAuthAuthorizeLibrary } from "./OAuthConsent.ts";
import { getOAuthScopeGroup, translateOAuthScope } from "./OAuthPartnerPresentation.ts";

export type OAuthConsentPermissionKind = "read" | "action";

export type OAuthConsentPermission = {
    scope: string;
    label: string;
    kind: OAuthConsentPermissionKind;
};

export type OAuthConsentScopeSection = {
    key: "profile" | "catalog" | "loans" | "integration";
    label: string;
    permissions: OAuthConsentPermission[];
};

export const OAUTH_CONSENT_COPY = {
    denyAction: "Não permitir",
    approveAction: "Permitir acesso",
    revocationHint:
        "Você poderá remover este acesso a qualquer momento em Meu perfil → Apps conectados.",
} as const;

const SECTION_ORDER: Array<OAuthConsentScopeSection["key"]> = [
    "profile",
    "catalog",
    "loans",
    "integration",
];

const SECTION_LABELS: Record<OAuthConsentScopeSection["key"], string> = {
    profile: "Perfil",
    catalog: "Catálogo e bibliotecas",
    loans: "Empréstimos",
    integration: "Integração",
};

const CONSENT_SCOPE_LABEL_OVERRIDES: Record<string, string> = {
    offline_access: "Manter sua sessão ativa",
    "biblioweb.loans.read": "Consultar seus empréstimos",
    "biblioweb.loans.write": "Criar e devolver empréstimos em seu nome",
    "biblioweb.licenses.read": "Baixar licenças dos seus empréstimos",
};

const ACTION_SCOPES = new Set(["biblioweb.loans.write", "biblioweb.licenses.read"]);

/**
 * Agrupa as permissões solicitadas em áreas compreensíveis e marca ações que
 * podem produzir efeitos em nome do usuário.
 *
 * @param scopes Escopos OAuth solicitados pelo aplicativo.
 * @returns Seções ordenadas para a tela de consentimento.
 */
export function getOAuthConsentScopeSections(scopes: string[]): OAuthConsentScopeSection[] {
    const grouped = new Map<OAuthConsentScopeSection["key"], OAuthConsentPermission[]>();

    for (const scope of scopes) {
        if (scope === "openid") {
            continue;
        }

        const productGroup = getOAuthScopeGroup(scope);
        const sectionKey: OAuthConsentScopeSection["key"] =
            productGroup === "Identidade"
                ? "profile"
                : productGroup === "Catálogo"
                    ? "catalog"
                    : productGroup === "Empréstimos"
                        ? "loans"
                        : "integration";

        const permissions = grouped.get(sectionKey) || [];
        permissions.push({
            scope,
            label: CONSENT_SCOPE_LABEL_OVERRIDES[scope] || translateOAuthScope(scope),
            kind: ACTION_SCOPES.has(scope) ? "action" : "read",
        });
        grouped.set(sectionKey, permissions);
    }

    return SECTION_ORDER.flatMap((key) => {
        const permissions = grouped.get(key);
        if (!permissions?.length) {
            return [];
        }
        return [{ key, label: SECTION_LABELS[key], permissions }];
    });
}

/**
 * Resume o contexto de bibliotecas apresentado ao usuário durante o consentimento.
 *
 * @param libraries Bibliotecas às quais a integração ficará limitada.
 * @returns Rótulo e valor do contexto, ou `null` quando não houver bibliotecas.
 */
export function getOAuthConsentLibrariesPresentation(
    libraries: OAuthAuthorizeLibrary[]
): { label: string; value: string } | null {
    if (libraries.length === 0) {
        return null;
    }

    if (libraries.length === 1) {
        return { label: "Acesso limitado a", value: libraries[0].name };
    }

    if (libraries.length <= 5) {
        return {
            label: "Acesso limitado às bibliotecas",
            value: libraries.map((library) => library.name).join(", "),
        };
    }

    return {
        label: "Acesso limitado às bibliotecas",
        value: `${libraries.length} bibliotecas autorizadas`,
    };
}

/**
 * Define a hierarquia textual da decisão de consentimento.
 *
 * @param clientName Nome público do aplicativo parceiro.
 * @param isScopeUpgrade Indica se o aplicativo já possuía permissões concedidas.
 * @returns Título, nome do aplicativo e explicação principal da decisão.
 */
export function getOAuthConsentHeading(
    clientName: string,
    isScopeUpgrade: boolean
): { title: string; appName: string; description: string } {
    if (isScopeUpgrade) {
        return {
            title: `${clientName} quer ampliar o acesso`,
            appName: clientName,
            description:
                "O aplicativo já está conectado à sua conta e está solicitando novas permissões.",
        };
    }

    return {
        title: "Autorizar aplicativo",
        appName: clientName,
        description: "quer acessar sua conta BiblioWeb",
    };
}
