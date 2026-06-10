import { Book } from "../model/Book";
import { api, API_BASE_URL, buildAuthHeaders } from "./api";

export const DEFAULT_PUBLIC_LIBRARY_ID = 1;
const DEFAULT_BOOK_FIELDS =
    "subtitle,original_title,corporate_author,publication_place,dewey_decimal,edition,year,isbn,pages,language," +
    "summary,general_note,bibliography_note,content_type,media_type,carrier_type,type," +
    "library,external_url,external_source,html_version_url,file_name,image_url,subjects(subject,subject_name)," +
    "authors(author,author_name),preco_sugerido,preco_compra,available_licenses,max_uses_per_license," +
    "license_uses_count,loan_state,loan_expires_at,last_access_at,current_book_active_licenses," +
    "current_user_active_loans,max_concurrent_loans,unavailable_users_count,purchased_by_user," +
    "purchase_license_id,purchase_issued_at";
const MOST_ACCESSED_ORDER = "access_count desc";

export type MercadoPagoCheckoutResponse = {
    order_id?: string;
    preference_id?: string;
    checkout_url?: string;
};

export type MercadoPagoCheckoutRequest = {
    book_id: string;
    library: number;
};

/**
 * Normaliza respostas da API que podem vir como lista direta
 * ou como objeto no formato { result: [...] }.
 *
 * @param data Resposta crua da API.
 * @returns Lista de livros normalizada.
 */
function normalizeBooksResponse(data: unknown): Book[] {
    if (Array.isArray(data)) {
        return data as Book[];
    }
    if (data && typeof data === "object" && Array.isArray((data as { result?: unknown }).result)) {
        return (data as { result: Book[] }).result;
    }
    return [];
}

/**
 * Normaliza respostas unitárias de livro.
 *
 * @param data Resposta crua da API.
 * @returns Livro ou null quando payload inválido.
 */
function normalizeBookResponse(data: unknown): Book | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return null;
    }

    const payload = data as Record<string, unknown>;
    if (payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)) {
        return normalizeBookResponse(payload.result);
    }

    if ("id" in payload) {
        return payload as unknown as Book;
    }

    return null;
}

/**
 * Normaliza payload unitário quando a API devolve objeto simples.
 *
 * @param data Resposta crua da API.
 * @returns Objeto normalizado ou null quando inválido.
 */
function normalizeSingleObjectPayload(data: unknown): Record<string, unknown> | null {
    if (data && typeof data === "object" && !Array.isArray(data)) {
        return data as Record<string, unknown>;
    }
    return null;
}

/**
 * Extrai uma mensagem legível de uma resposta HTTP de erro.
 *
 * @param response Resposta bruta do servidor.
 * @param fallback Mensagem padrão quando o corpo não ajuda.
 * @returns Mensagem humana extraída do payload.
 */
async function extractErrorMessage(
    response: Response,
    fallback: string
): Promise<string> {
    try {
        const rawBody = await response.text();
        if (!rawBody.trim()) {
            return fallback;
        }

        const parsedBody = JSON.parse(rawBody) as unknown;
        if (Array.isArray(parsedBody)) {
            const firstMessage = parsedBody.find(
                (item) =>
                    item &&
                    typeof item === "object" &&
                    "message" in item &&
                    typeof (item as { message?: unknown }).message === "string"
            ) as { message?: string } | undefined;
            if (firstMessage?.message) {
                return firstMessage.message;
            }
        }

        if (
            parsedBody &&
            typeof parsedBody === "object" &&
            "message" in parsedBody &&
            typeof (parsedBody as { message?: unknown }).message === "string"
        ) {
            return (parsedBody as { message: string }).message;
        }
    } catch {
        // Mantém fallback quando o corpo não é JSON.
    }

    return fallback;
}

/**
 * Dispara o download de um blob retornado pela API.
 *
 * @param response Resposta HTTP com o arquivo.
 * @param fallbackFilename Nome padrão quando o ``Content-Disposition`` não ajudar.
 * @returns Promise<void>.
 */
async function downloadBinaryResponse(
    response: Response,
    fallbackFilename: string
): Promise<void> {
    const disposition = response.headers.get("Content-Disposition");
    let filename = disposition?.split(";")[1]?.trim().split("=")[1];
    filename = filename ? filename : fallbackFilename;
    filename = filename.replace(/^"+|"+$/g, "");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

/**
 * Normaliza um possível registro MARC21 recebido da API.
 *
 * @param data Resposta crua da API.
 * @returns Registro MARC21 pronto para formatação ou `null`.
 */
function normalizeMarcRecord(data: unknown): Record<string, unknown> | null {
    if (typeof data === "string") {
        const trimmed = data.trim();
        if (!trimmed) {
            return null;
        }
        try {
            return normalizeMarcRecord(JSON.parse(trimmed));
        } catch {
            return null;
        }
    }

    if (!data || typeof data !== "object") {
        return null;
    }

    const payload = data as Record<string, unknown>;
    if (Array.isArray(payload.result) && payload.result.length > 0) {
        return normalizeMarcRecord(payload.result[0]);
    }
    if (payload.record && typeof payload.record === "object") {
        return payload.record as Record<string, unknown>;
    }

    return payload;
}

/**
 * Monta lista deduplicada de possíveis IDs de livro.
 *
 * @param rawValues Valores candidatos vindos de diferentes payloads.
 * @returns IDs limpos e únicos.
 */
function collectBookIdCandidates(...rawValues: unknown[]): string[] {
    const seen = new Set<string>();
    const candidates: string[] = [];

    for (const rawValue of rawValues) {
        if (rawValue === null || rawValue === undefined) {
            continue;
        }
        const normalized = String(rawValue).trim();
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        candidates.push(normalized);
    }

    return candidates;
}

/**
 * Normaliza respostas que retornam listas de strings.
 *
 * @param data Resposta crua da API.
 * @returns Lista de strings sem valores vazios.
 */
function normalizeStringListResponse(data: unknown): string[] {
    const extractValue = (item: unknown): string => {
        if (typeof item === "string") {
            return item.trim();
        }

        if (item && typeof item === "object") {
            const typedItem = item as Record<string, unknown>;
            const candidateFields = ["name", "subject", "author"];
            for (const candidate of candidateFields) {
                const candidateValue = typedItem[candidate];
                if (typeof candidateValue === "string" && candidateValue.trim()) {
                    return candidateValue.trim();
                }
            }
        }

        return "";
    };

    const rawItems =
        data &&
        typeof data === "object" &&
        "result" in data &&
        Array.isArray((data as { result?: unknown }).result)
            ? (data as { result: unknown[] }).result
            : Array.isArray(data)
            ? data
            : [];

    const deduped = new Set<string>();
    for (const item of rawItems) {
        const normalized = extractValue(item);
        if (normalized) {
            deduped.add(normalized);
        }
    }

    return Array.from(deduped);
}

/**
 * Normaliza um indicador MARC21 para duas posições visíveis.
 *
 * @param value Valor bruto do indicador.
 * @returns Indicador textual com fallback visual.
 */
function normalizeMarcIndicator(value: unknown): string {
    if (typeof value !== "string") {
        return "_";
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return "_";
    }

    return trimmed[0];
}

/**
 * Extrai subcampos de uma ocorrência MARC21 preservando a ordem recebida.
 *
 * @param item Ocorrência bruta do campo.
 * @returns Lista de pares subcampo/valor normalizados.
 */
function extractMarcSubfields(item: unknown): Array<[string, string]> {
    if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed ? [["a", trimmed]] : [];
    }

    if (!item || typeof item !== "object") {
        return [];
    }

    const entry = item as Record<string, unknown>;
    const directEntries = Object.entries(entry).filter(([key, value]) => {
        if (key === "ind1" || key === "ind2" || key === "indicator1" || key === "indicator2") {
            return false;
        }
        if (key === "subfields" || key === "tag") {
            return false;
        }
        return typeof value === "string" && value.trim().length > 0;
    });

    if (Array.isArray(entry.subfields)) {
        const nestedEntries: Array<[string, string]> = [];
        for (const subfield of entry.subfields) {
            if (!subfield || typeof subfield !== "object") {
                continue;
            }
            for (const [key, value] of Object.entries(subfield as Record<string, unknown>)) {
                if (typeof value === "string" && value.trim()) {
                    nestedEntries.push([key, value.trim()]);
                }
            }
        }
        if (nestedEntries.length > 0) {
            return nestedEntries;
        }
    }

    return directEntries.map(([key, value]) => [key, (value as string).trim()]);
}

/**
 * Formata uma ocorrência MARC21 como linha textual.
 *
 * @param tag Tag MARC21.
 * @param item Ocorrência do campo.
 * @returns Linha textual ou vazio quando o conteúdo não existe.
 */
function formatMarcOccurrence(tag: string, item: unknown): string {
    if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed ? `${tag} __ |a ${trimmed}` : "";
    }

    if (!item || typeof item !== "object") {
        return "";
    }

    const entry = item as Record<string, unknown>;
    const ind1 = normalizeMarcIndicator(entry.ind1 ?? entry.indicator1);
    const ind2 = normalizeMarcIndicator(entry.ind2 ?? entry.indicator2);
    const subfields = extractMarcSubfields(entry);
    if (subfields.length === 0) {
        return "";
    }

    if (tag === "260") {
        const place = typeof entry.a === "string" ? entry.a.trim() : "";
        const publisher = typeof entry.b === "string" ? entry.b.trim() : "";
        const year = typeof entry.c === "string" ? entry.c.trim() : "";
        const renderedSegments: string[] = [];

        if (place) {
            renderedSegments.push(`|a ${place}${publisher || year ? " :" : ""}`);
        }
        if (publisher) {
            renderedSegments.push(`|b ${publisher}${year ? "," : ""}`);
        }
        if (year) {
            renderedSegments.push(`|c ${year}`);
        }

        if (renderedSegments.length > 0) {
            return `${tag} ${ind1}${ind2} ${renderedSegments.join(" ")}`.trim();
        }
    }

    const subfieldText = subfields
        .map(([key, value]) => `|${key} ${value}`)
        .join(" ");
    return `${tag} ${ind1}${ind2} ${subfieldText}`.trim();
}

/**
 * Formata um registro MARC21 completo para exibição textual.
 *
 * @param data Registro bruto retornado pela API.
 * @returns Texto legível do MARC21.
 */
export function formatMarc21Record(data: unknown): string {
    const record = normalizeMarcRecord(data);
    if (!record) {
        return "";
    }

    const preferredOrder = [
        "001",
        "020",
        "041",
        "082",
        "100",
        "110",
        "240",
        "245",
        "246",
        "250",
        "260",
        "264",
        "336",
        "337",
        "338",
        "500",
        "504",
        "520",
        "650",
        "700",
        "856",
    ];
    const seen = new Set<string>();
    const lines: string[] = [];

    const appendTag = (tag: string) => {
        if (seen.has(tag) || !(tag in record)) {
            return;
        }
        seen.add(tag);
        const rawValue = record[tag];
        const occurrences = Array.isArray(rawValue) ? rawValue : [rawValue];
        for (const occurrence of occurrences) {
            const line = formatMarcOccurrence(tag, occurrence);
            if (line) {
                lines.push(line);
            }
        }
    };

    for (const tag of preferredOrder) {
        appendTag(tag);
    }

    for (const tag of Object.keys(record)) {
        appendTag(tag);
    }

    return lines.join("\n");
}

/**
 * Busca publicações recentes de uma biblioteca.
 *
 * @param libraryId ID da biblioteca usada na consulta.
 * @param token Token JWT opcional para cenários autenticados.
 * @returns Lista de livros retornada pela API.
 */
export async function fetchRecentPublications(
    libraryId: number,
    token?: string
): Promise<Book[]> {
    const endpoint = `/libraries_books?library=${libraryId}&fields=${DEFAULT_BOOK_FIELDS}`;
    const data = await api.get<unknown>(endpoint, token);
    return normalizeBooksResponse(data);
}

/**
 * Busca livros mais acessados de uma biblioteca.
 *
 * @param libraryId ID da biblioteca usada na consulta.
 * @param token Token JWT opcional para cenários autenticados.
 * @returns Lista de livros ordenada por acesso.
 */
export async function fetchMostAccessedPublications(
    libraryId: number,
    token?: string
): Promise<Book[]> {
    const endpoint =
        `/libraries_books?library=${libraryId}&fields=${DEFAULT_BOOK_FIELDS},access_count` +
        `&order=${encodeURIComponent(MOST_ACCESSED_ORDER)}&limit=20`;
    const data = await api.get<unknown>(endpoint, token);
    return normalizeBooksResponse(data);
}

/**
 * Busca detalhes de um livro por ID.
 *
 * @param id ID do livro.
 * @param libraryId ID da biblioteca usada para contextualizar o detalhe.
 * @param token Token JWT opcional para cenários autenticados.
 * @returns Livro encontrado ou null quando não existir na resposta.
 */
export async function fetchBookDetails(
    id: string,
    libraryId: number,
    token?: string
): Promise<Book | null> {
    const endpoint =
        `/libraries_books?library=${libraryId}` +
        `&id=${encodeURIComponent(id)}` +
        `&fields=${encodeURIComponent(DEFAULT_BOOK_FIELDS)}` +
        "&limit=1";
    try {
        const data = await api.get<unknown>(endpoint, token);
        const books = normalizeBooksResponse(data);
        return books.length > 0 ? books[0] : normalizeBookResponse(data);
    } catch {
        return null;
    }
}

/**
 * Busca o registro MARC21 de um livro por ID.
 *
 * @param id ID do livro (ou vínculo `libraries_books`) na tela de detalhe.
 * @returns Registro MARC21 bruto para formatação no front-end.
 */
export async function fetchBookMarc21(id: string, libraryId?: number): Promise<unknown> {
    const candidates = collectBookIdCandidates(id);

    try {
        const librarySuffix =
            typeof libraryId === "number" && Number.isFinite(libraryId) && libraryId > 0
                ? `?library=${libraryId}`
                : "";
        const libraryBookData = await api.get<unknown>(
            `/libraries_books/${encodeURIComponent(id)}${librarySuffix}`
        );
        const payload = normalizeSingleObjectPayload(libraryBookData);
        if (payload) {
            const resolved = collectBookIdCandidates(payload.book_id, payload.book, payload.id);
            for (const candidate of resolved) {
                if (!candidates.includes(candidate)) {
                    candidates.push(candidate);
                }
            }
        }
    } catch {
        // Fallback silencioso: tenta exportar com o ID original.
    }

    let lastError: unknown = null;
    for (const candidate of candidates) {
        try {
            return await api.get<unknown>(`/books-marc/${encodeURIComponent(candidate)}`);
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError instanceof Error && lastError.message) {
        throw lastError;
    }

    throw new Error("Não foi possível exportar o MARC21 deste livro.");
}

/**
 * Pesquisa livros por termo de busca.
 *
 * @param query Termo pesquisado.
 * @param libraryId ID da biblioteca usada na consulta.
 * @param token Token JWT opcional para cenários autenticados.
 * @returns Lista de livros que casaram com a pesquisa.
 */
export async function fetchSearchResults(
    query: string,
    libraryId: number,
    token?: string
): Promise<Book[]> {
    const endpoint =
        `/libraries_books?library=${libraryId}` +
        `&search=${encodeURIComponent(query)}` +
        `&fields=${encodeURIComponent(DEFAULT_BOOK_FIELDS)}` +
        `&order=${encodeURIComponent(MOST_ACCESSED_ORDER)}&limit=80`;
    const data = await api.get<unknown>(endpoint, token);
    return normalizeBooksResponse(data);
}

export type AdvancedSearchFieldType = "text" | "number" | "date" | "enum";

export type AdvancedSearchFieldKey =
    | "id"
    | "title"
    | "subtitle"
    | "original_title"
    | "authors.author_name"
    | "publisher"
    | "publication_place"
    | "dewey_decimal"
    | "edition"
    | "year"
    | "isbn"
    | "pages"
    | "language"
    | "summary"
    | "general_note"
    | "bibliography_note"
    | "content_type"
    | "media_type"
    | "carrier_type"
    | "subjects.subject_name"
    | "external_source"
    | "external_url"
    | "type"
    | "access_count";

export type AdvancedSearchOperatorKey =
    | "equals"
    | "different"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "greater_than"
    | "greater_or_equal"
    | "less_than"
    | "less_or_equal"
    | "after"
    | "before"
    | "is_empty"
    | "is_not_empty";

export type AdvancedSearchOption = {
    value: string;
    label: string;
};

export type AdvancedSearchFieldDefinition = {
    key: AdvancedSearchFieldKey;
    label: string;
    type: AdvancedSearchFieldType;
    defaultOperator: AdvancedSearchOperatorKey;
    options?: AdvancedSearchOption[];
};

export type AdvancedSearchOperationDefinition = {
    key: AdvancedSearchOperatorKey;
    label: string;
    suffix: string;
    requiresValue: boolean;
    supportedTypes: AdvancedSearchFieldType[];
};

export type AdvancedSearchRule = {
    field: AdvancedSearchFieldKey;
    operator: AdvancedSearchOperatorKey;
    value?: string;
};

export type AdvancedSearchFilters = {
    search?: string;
    limit?: number;
    rules: AdvancedSearchRule[];
};

export const ADVANCED_SEARCH_FIELDS: AdvancedSearchFieldDefinition[] = [
    { key: "title", label: "Título", type: "text", defaultOperator: "contains" },
    { key: "subtitle", label: "Subtítulo", type: "text", defaultOperator: "contains" },
    { key: "original_title", label: "Título original", type: "text", defaultOperator: "contains" },
    { key: "authors.author_name", label: "Autor", type: "text", defaultOperator: "contains" },
    { key: "publisher", label: "Editora", type: "text", defaultOperator: "contains" },
    {
        key: "publication_place",
        label: "Local de publicação",
        type: "text",
        defaultOperator: "contains",
    },
    { key: "dewey_decimal", label: "CDD", type: "text", defaultOperator: "contains" },
    { key: "edition", label: "Edição", type: "text", defaultOperator: "contains" },
    { key: "year", label: "Ano", type: "number", defaultOperator: "equals" },
    { key: "isbn", label: "ISBN", type: "text", defaultOperator: "contains" },
    { key: "pages", label: "Páginas", type: "number", defaultOperator: "equals" },
    { key: "language", label: "Idioma", type: "text", defaultOperator: "contains" },
    { key: "summary", label: "Resumo", type: "text", defaultOperator: "contains" },
    { key: "general_note", label: "Nota geral", type: "text", defaultOperator: "contains" },
    {
        key: "bibliography_note",
        label: "Nota de bibliografia",
        type: "text",
        defaultOperator: "contains",
    },
    { key: "content_type", label: "Tipo de conteúdo", type: "text", defaultOperator: "contains" },
    { key: "media_type", label: "Tipo de mídia", type: "text", defaultOperator: "contains" },
    { key: "carrier_type", label: "Tipo de suporte", type: "text", defaultOperator: "contains" },
    { key: "subjects.subject_name", label: "Assunto", type: "text", defaultOperator: "contains" },
    {
        key: "external_source",
        label: "Fonte externa",
        type: "text",
        defaultOperator: "contains",
    },
    { key: "external_url", label: "URL externa", type: "text", defaultOperator: "contains" },
    {
        key: "type",
        label: "Tipo",
        type: "enum",
        defaultOperator: "equals",
        options: [
            { value: "protected", label: "Protegido" },
            { value: "free", label: "Livre" },
            { value: "external", label: "Externo" },
        ],
    },
    {
        key: "access_count",
        label: "Quantidade de acessos",
        type: "number",
        defaultOperator: "greater_or_equal",
    },
    { key: "id", label: "ID", type: "text", defaultOperator: "equals" },
];

export const ADVANCED_SEARCH_OPERATIONS: AdvancedSearchOperationDefinition[] = [
    {
        key: "equals",
        label: "Igual a",
        suffix: "",
        requiresValue: true,
        supportedTypes: ["text", "number", "date", "enum"],
    },
    {
        key: "different",
        label: "Diferente de",
        suffix: "_diferente",
        requiresValue: true,
        supportedTypes: ["text", "number", "date", "enum"],
    },
    {
        key: "contains",
        label: "Contém",
        suffix: "_contem",
        requiresValue: true,
        supportedTypes: ["text"],
    },
    {
        key: "not_contains",
        label: "Não contém",
        suffix: "_nao_contem",
        requiresValue: true,
        supportedTypes: ["text"],
    },
    {
        key: "starts_with",
        label: "Começa com",
        suffix: "_comeca_com",
        requiresValue: true,
        supportedTypes: ["text"],
    },
    {
        key: "ends_with",
        label: "Termina com",
        suffix: "_termina_com",
        requiresValue: true,
        supportedTypes: ["text"],
    },
    {
        key: "greater_than",
        label: "Maior que",
        suffix: "_maior",
        requiresValue: true,
        supportedTypes: ["number", "date"],
    },
    {
        key: "greater_or_equal",
        label: "Maior ou igual a",
        suffix: "_maior_igual",
        requiresValue: true,
        supportedTypes: ["number", "date"],
    },
    {
        key: "less_than",
        label: "Menor que",
        suffix: "_menor",
        requiresValue: true,
        supportedTypes: ["number", "date"],
    },
    {
        key: "less_or_equal",
        label: "Menor ou igual a",
        suffix: "_menor_igual",
        requiresValue: true,
        supportedTypes: ["number", "date"],
    },
    {
        key: "after",
        label: "Após",
        suffix: "_apos",
        requiresValue: true,
        supportedTypes: ["date"],
    },
    {
        key: "before",
        label: "Antes",
        suffix: "_antes",
        requiresValue: true,
        supportedTypes: ["date"],
    },
    {
        key: "is_empty",
        label: "Está vazio",
        suffix: "_vazio",
        requiresValue: false,
        supportedTypes: ["text", "number", "date", "enum"],
    },
    {
        key: "is_not_empty",
        label: "Não está vazio",
        suffix: "_nao_vazio",
        requiresValue: false,
        supportedTypes: ["text", "number", "date", "enum"],
    },
];

const ADVANCED_SEARCH_OPERATION_BY_KEY = ADVANCED_SEARCH_OPERATIONS.reduce(
    (accumulator, current) => {
        accumulator[current.key] = current;
        return accumulator;
    },
    {} as Record<AdvancedSearchOperatorKey, AdvancedSearchOperationDefinition>
);

const ADVANCED_SEARCH_FIELD_BY_KEY = ADVANCED_SEARCH_FIELDS.reduce(
    (accumulator, current) => {
        accumulator[current.key] = current;
        return accumulator;
    },
    {} as Record<AdvancedSearchFieldKey, AdvancedSearchFieldDefinition>
);

export function getAdvancedSearchFieldByKey(
    key: AdvancedSearchFieldKey
): AdvancedSearchFieldDefinition {
    return ADVANCED_SEARCH_FIELD_BY_KEY[key];
}

export function getAdvancedSearchOperationsByFieldType(
    type: AdvancedSearchFieldType
): AdvancedSearchOperationDefinition[] {
    return ADVANCED_SEARCH_OPERATIONS.filter((operation) =>
        operation.supportedTypes.includes(type)
    );
}

/**
 * Executa busca avançada de livros usando listagem padrão `/libraries_books`,
 * montando parâmetros de filtro com sufixos suportados pelo RestLib.
 *
 * @param filters Configuração de busca (search + lista de regras).
 * @param libraryId ID da biblioteca.
 * @param token Token JWT opcional.
 * @returns Lista de livros retornada pela API.
 */
export async function fetchAdvancedSearchResults(
    filters: AdvancedSearchFilters,
    libraryId: number,
    token?: string
): Promise<Book[]> {
    const query = new URLSearchParams();
    query.set("library", String(libraryId));

    const normalizedSearch = typeof filters.search === "string" ? filters.search.trim() : "";
    if (normalizedSearch) {
        query.set("search", normalizedSearch);
    }

    const normalizedLimit = Number(filters.limit);
    query.set("limit", String(Number.isFinite(normalizedLimit) && normalizedLimit > 0 ? normalizedLimit : 80));

    for (const rule of filters.rules || []) {
        if (!rule || !rule.field || !rule.operator) {
            continue;
        }

        const fieldConfig = ADVANCED_SEARCH_FIELD_BY_KEY[rule.field];
        const operatorConfig = ADVANCED_SEARCH_OPERATION_BY_KEY[rule.operator];
        if (!fieldConfig || !operatorConfig) {
            continue;
        }

        if (!operatorConfig.supportedTypes.includes(fieldConfig.type)) {
            continue;
        }

        const queryKey = `${rule.field}${operatorConfig.suffix}`;
        if (!operatorConfig.requiresValue) {
            query.set(queryKey, "true");
            continue;
        }

        const value = typeof rule.value === "string" ? rule.value.trim() : "";
        if (!value) {
            continue;
        }
        query.set(queryKey, value);
    }

    query.set("fields", DEFAULT_BOOK_FIELDS);
    query.set("order", MOST_ACCESSED_ORDER);

    const endpoint = `/libraries_books?${query.toString()}`;
    const data = await api.get<unknown>(endpoint, token);
    return normalizeBooksResponse(data);
}

/**
 * Lista assuntos distintos de livros para a biblioteca.
 *
 * @param libraryId ID da biblioteca.
 * @param token Token JWT opcional.
 * @returns Lista de assuntos.
 */
export async function fetchBookSubjects(
    libraryId: number,
    token?: string
): Promise<string[]> {
    const endpoint =
        `/books_subjects?library=${libraryId}` +
        `&fields=${encodeURIComponent("name")}` +
        `&order=${encodeURIComponent("name")}&limit=200`;
    const data = await api.get<unknown>(endpoint, token);
    return normalizeStringListResponse(data);
}

/**
 * Lista autores distintos de livros para a biblioteca.
 *
 * @param libraryId ID da biblioteca.
 * @param token Token JWT opcional.
 * @returns Lista de autores.
 */
export async function fetchBookAuthors(
    libraryId: number,
    token?: string
): Promise<string[]> {
    const endpoint =
        `/books_authors?library=${libraryId}` +
        `&fields=${encodeURIComponent("name")}` +
        `&order=${encodeURIComponent("name")}&limit=200`;
    const data = await api.get<unknown>(endpoint, token);
    return normalizeStringListResponse(data);
}

/**
 * Lista livros por assunto exato (modelo relacional) na biblioteca.
 *
 * @param subject Assunto selecionado.
 * @param libraryId ID da biblioteca.
 * @param token Token JWT opcional.
 * @returns Lista de livros do assunto.
 */
export async function fetchBooksBySubject(
    subject: string,
    libraryId: number,
    token?: string
): Promise<Book[]> {
    const endpoint =
        `/libraries_books?library=${libraryId}` +
        `&subjects.subject_name=${encodeURIComponent(subject)}` +
        `&fields=${encodeURIComponent(DEFAULT_BOOK_FIELDS)}` +
        `&order=${encodeURIComponent(MOST_ACCESSED_ORDER)}&limit=20`;
    const data = await api.get<unknown>(endpoint, token);
    return normalizeBooksResponse(data);
}

/**
 * Lista livros por autor exato (modelo relacional) na biblioteca.
 *
 * @param author Autor selecionado.
 * @param libraryId ID da biblioteca.
 * @param token Token JWT opcional.
 * @returns Lista de livros do autor.
 */
export async function fetchBooksByAuthor(
    author: string,
    libraryId: number,
    token?: string
): Promise<Book[]> {
    const endpoint =
        `/libraries_books?library=${libraryId}` +
        `&authors.author_name=${encodeURIComponent(author)}` +
        `&fields=${encodeURIComponent(DEFAULT_BOOK_FIELDS)}` +
        `&order=${encodeURIComponent(MOST_ACCESSED_ORDER)}&limit=20`;
    const data = await api.get<unknown>(endpoint, token);
    return normalizeBooksResponse(data);
}

/**
 * Registra um acesso ao livro (clique em "Ler agora").
 *
 * @param id ID do livro acessado.
 * @param libraryId ID da biblioteca usada no registro.
 * @param token Token JWT opcional.
 * @returns Promise<void>.
 */
export async function registerBookAccess(
    id: string,
    libraryId: number,
    token?: string
): Promise<void> {
    await api.post(
        `/books/${encodeURIComponent(id)}/access`,
        { action_type: "read_now", library: libraryId },
        token
    );
}

/**
 * Registra um acesso a leitura com tipo explícito.
 *
 * @param id ID do livro acessado.
 * @param actionType Tipo da ação, como ``read_now`` ou ``read_web``.
 * @param libraryId ID da biblioteca usada no registro.
 * @param token Token JWT opcional.
 * @returns Promise<void>.
 */
export async function registerBookAccessWithType(
    id: string,
    actionType: "read_now" | "read_web" | "loan" = "read_now",
    libraryId: number,
    token?: string
): Promise<void> {
    await api.post(
        `/books/${encodeURIComponent(id)}/access`,
        { action_type: actionType, library: libraryId },
        token
    );
}

/**
 * Solicita empréstimo de um livro e inicia download do arquivo licenciado.
 *
 * @param id ID do livro.
 * @param libraryId ID da biblioteca de empréstimo.
 * @param token Token JWT obrigatório para autorização.
 * @returns Promise<void> sem payload; dispara download no navegador.
 */
export async function lendBook(id: string, libraryId: number, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/books-loan`, {
        method: "POST",
        headers: buildAuthHeaders(token, true),
        body: JSON.stringify({ book_id: id, library: libraryId }),
    });

    if (!response.ok) {
        const message = await extractErrorMessage(
            response,
            "Falha ao realizar empréstimo do livro."
        );
        throw new Error(message);
    }

    await downloadBinaryResponse(response, "book.lcpl");
}

/**
 * Solicita a devolução de um empréstimo licenciado.
 *
 * @param id ID do livro.
 * @param libraryId ID da biblioteca da sessão.
 * @param token Token JWT obrigatório.
 * @returns Promise<void>.
 */
export async function returnBookLoan(
    id: string,
    libraryId: number,
    token: string
): Promise<void> {
    await api.post(`/books-loan/${encodeURIComponent(id)}/return`, { library: libraryId }, token);
}

/**
 * Cria a preferência de checkout do Mercado Pago para compra de um livro.
 *
 * @param payload Dados necessários para iniciar a compra.
 * @param token Token JWT obrigatório.
 * @returns Resposta com a URL de checkout.
 */
export async function createMercadoPagoCheckout(
    payload: MercadoPagoCheckoutRequest,
    token: string
): Promise<MercadoPagoCheckoutResponse> {
    return api.post<MercadoPagoCheckoutResponse>("/books-purchase/mercado-pago", payload, token);
}

/**
 * Solicita o download da cópia comprada pelo usuário.
 *
 * @param id Identificador do livro.
 * @param libraryId Identificador do acervo usado para registrar acesso.
 * @param token Token JWT obrigatório.
 * @returns Promise<void> sem payload; dispara download no navegador.
 */
export async function downloadPurchasedBook(
    id: string,
    libraryId: number,
    token: string
): Promise<void> {
    const response = await fetch(
        `${API_BASE_URL}/books-purchase/${encodeURIComponent(id)}/download`,
        {
            method: "POST",
            headers: buildAuthHeaders(token, true),
            body: JSON.stringify({ library: libraryId }),
        }
    );

    if (!response.ok) {
        const message = await extractErrorMessage(
            response,
            "Falha ao baixar a cópia comprada do livro."
        );
        throw new Error(message);
    }

    await downloadBinaryResponse(response, "book.lcpl");
}
