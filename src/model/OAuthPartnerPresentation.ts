/** Dados mínimos necessários para busca e apresentação de um parceiro OAuth. */
export type OAuthPartnerSearchable = {
    id: string;
    name: string;
    organization?: string | null;
    description?: string | null;
    technical_contacts?: { name: string; email: string }[];
};

export type OAuthScopeGroup = "Identidade" | "Catálogo" | "Empréstimos" | "Integração";

const OAUTH_SCOPE_LABELS: Record<string, string> = {
    openid: "Confirmar sua identidade",
    profile: "Ver seu nome",
    email: "Ver seu e-mail",
    offline_access: "Manter a sessão ativa",
    "biblioweb.profile.read": "Ver seu perfil BiblioWeb",
    "biblioweb.libraries.read": "Ver bibliotecas disponíveis",
    "biblioweb.catalog.read": "Consultar catálogo",
    "biblioweb.loans.read": "Consultar empréstimos",
    "biblioweb.loans.write": "Criar e devolver empréstimos",
    "biblioweb.licenses.read": "Baixar licenças de empréstimos",
    "biblioweb.integration.read": "Consultar dados da integração",
};

const OAUTH_GRANT_TYPE_LABELS: Record<string, string> = {
    authorization_code: "Acesso em nome de um usuário",
    refresh_token: "Renovação automática da sessão",
    client_credentials: "Integração entre servidores",
};

/**
 * Traduz um código de escopo OAuth para uma permissão compreensível na área administrativa.
 *
 * @param scope Código técnico do escopo OAuth.
 * @returns Rótulo amigável, preservando o código como fallback.
 */
export function translateOAuthScope(scope: string): string {
    return OAUTH_SCOPE_LABELS[scope] || scope;
}

/**
 * Retorna o grupo de produto usado para resumir permissões de um parceiro.
 *
 * @param scope Código técnico do escopo OAuth.
 * @returns Grupo funcional da permissão.
 */
export function getOAuthScopeGroup(scope: string): OAuthScopeGroup {
    if (scope === "openid" || scope === "profile" || scope === "email" || scope === "offline_access" || scope === "biblioweb.profile.read") {
        return "Identidade";
    }
    if (scope === "biblioweb.libraries.read" || scope === "biblioweb.catalog.read") {
        return "Catálogo";
    }
    if (scope.startsWith("biblioweb.loans.") || scope === "biblioweb.licenses.read") {
        return "Empréstimos";
    }
    return "Integração";
}

/**
 * Traduz um grant type OAuth para a intenção administrativa correspondente.
 *
 * @param grantType Código técnico do grant type.
 * @returns Rótulo amigável, preservando o código como fallback.
 */
export function translateOAuthGrantType(grantType: string): string {
    return OAUTH_GRANT_TYPE_LABELS[grantType] || grantType;
}

/**
 * Verifica se um parceiro corresponde ao termo digitado na busca da listagem.
 *
 * @param partner Parceiro a ser avaliado.
 * @param query Termo de busca informado pelo administrador.
 * @returns `true` quando nome, organização, descrição, ID ou contato contém o termo.
 */
export function matchesOAuthPartnerSearch(partner: OAuthPartnerSearchable, query: string): boolean {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) {
        return true;
    }

    const searchableValues = [
        partner.name,
        partner.id,
        partner.organization || "",
        partner.description || "",
        ...(partner.technical_contacts || []).flatMap((contact) => [contact.name, contact.email]),
    ];

    return searchableValues.some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
}


export type OAuthConnectedAppScopeSection = {
    key: "profile" | "catalog" | "loans" | "integration";
    label: string;
    permissions: string[];
};

const CONNECTED_APP_SECTION_ORDER: Array<OAuthConnectedAppScopeSection["key"]> = [
    "profile",
    "catalog",
    "loans",
    "integration",
];

const CONNECTED_APP_SECTION_LABELS: Record<OAuthConnectedAppScopeSection["key"], string> = {
    profile: "Perfil",
    catalog: "Catálogo e bibliotecas",
    loans: "Empréstimos",
    integration: "Integração",
};

/**
 * Agrupa as permissões de um app conectado em áreas compreensíveis ao usuário final.
 * O escopo técnico `openid` é omitido porque representa a identificação OAuth básica,
 * não uma permissão adicional que precise ser gerenciada nesta tela.
 *
 * @param scopes Escopos OAuth concedidos ao aplicativo.
 * @returns Seções ordenadas com rótulos e permissões traduzidas.
 */
export function getOAuthConnectedAppScopeSections(scopes: string[]): OAuthConnectedAppScopeSection[] {
    const grouped = new Map<OAuthConnectedAppScopeSection["key"], string[]>();

    for (const scope of scopes) {
        if (scope === "openid") {
            continue;
        }

        const productGroup = getOAuthScopeGroup(scope);
        const sectionKey: OAuthConnectedAppScopeSection["key"] =
            productGroup === "Identidade"
                ? "profile"
                : productGroup === "Catálogo"
                    ? "catalog"
                    : productGroup === "Empréstimos"
                        ? "loans"
                        : "integration";

        const permissions = grouped.get(sectionKey) || [];
        permissions.push(translateOAuthScope(scope));
        grouped.set(sectionKey, permissions);
    }

    return CONNECTED_APP_SECTION_ORDER.flatMap((key) => {
        const permissions = grouped.get(key);
        if (!permissions?.length) {
            return [];
        }
        return [{ key, label: CONNECTED_APP_SECTION_LABELS[key], permissions }];
    });
}

/**
 * Formata a data em que um app recebeu autorização sem exibir horário técnico.
 * Timestamps sem fuso são interpretados como UTC, conforme o contrato atual da API.
 *
 * @param value Timestamp retornado pela API.
 * @param locale Locale usado para o nome abreviado do mês.
 * @returns Data compacta, por exemplo `2 set 2026`, ou o valor bruto se inválido.
 */
export function formatOAuthConnectedAppDate(value: string, locale = "pt-BR"): string {
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    const parsed = new Date(hasTimezone ? value : `${value}Z`);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    const month = new Intl.DateTimeFormat(locale, { month: "short" })
        .format(parsed)
        .replace(".", "");

    return `${parsed.getDate()} ${month} ${parsed.getFullYear()}`;
}
