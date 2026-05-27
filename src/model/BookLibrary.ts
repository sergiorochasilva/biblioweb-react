/**
 * Vínculo livro x acervo vindo da API.
 */
export type BookLibraryLink = {
    id?: number;
    library: number;
    access_count?: number | null;
    available_licenses?: number | null;
    max_uses_per_license?: number | null;
    license_uses_count?: number | null;
};

/**
 * Vínculo livro x acervo usado no formulário da administração.
 */
export type BookLibraryForm = {
    id?: number;
    library: string;
    available_licenses: string;
    max_uses_per_license: string;
    license_uses_count: string;
};

/**
 * Payload enviado para a API ao salvar vínculos livro x acervo.
 */
export type BookLibraryPayload = {
    library: number;
    available_licenses?: number | null;
    max_uses_per_license?: number | null;
    license_uses_count?: number | null;
};

/**
 * Conjunto de valores padrão de política por acervo.
 */
export type BookLibraryPolicyValues = Pick<
    BookLibraryForm,
    "available_licenses" | "max_uses_per_license" | "license_uses_count"
>;

/**
 * Política padrão aplicada a novos vínculos de acervo.
 */
export const BOOK_LIBRARY_DEFAULT_POLICY: BookLibraryPolicyValues = {
    available_licenses: "5",
    max_uses_per_license: "26",
    license_uses_count: "0",
};

/**
 * Converte um valor bruto para inteiro positivo opcional.
 *
 * @param value Valor bruto recebido.
 * @returns Inteiro positivo ou ``null``.
 */
export function normalizePositiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return Math.trunc(parsed);
}

/**
 * Converte um valor bruto para inteiro opcional.
 *
 * @param value Valor bruto recebido.
 * @returns Inteiro ou ``null``.
 */
export function normalizeOptionalInteger(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return Math.trunc(parsed);
}

/**
 * Resolve um valor textual de política a partir de um número opcional.
 *
 * @param value Valor numérico opcional vindo da API.
 * @param fallback Texto de fallback do formulário.
 * @param defaultValue Valor numérico padrão quando nada estiver disponível.
 * @returns Texto numérico pronto para a UI.
 */
function resolvePolicyText(
    value: number | null | undefined,
    fallback: string,
    defaultValue: number
): string {
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(Math.trunc(value));
    }

    const parsedFallback = Number(fallback);
    if (Number.isFinite(parsedFallback)) {
        return String(Math.trunc(parsedFallback));
    }

    return String(defaultValue);
}

/**
 * Normaliza vínculos de acervo retornados pela API.
 *
 * @param value Payload bruto retornado pela API.
 * @returns Lista normalizada de vínculos.
 */
export function normalizeBookLibraryLinks(value: unknown): BookLibraryLink[] {
    const source = Array.isArray(value)
        ? value
        : value && typeof value === "object" && Array.isArray((value as { result?: unknown }).result)
            ? (value as { result: unknown[] }).result
            : [];

    const unique = new Map<number, BookLibraryLink>();

    for (const item of source) {
        if (!item || typeof item !== "object") {
            continue;
        }

        const raw = item as Record<string, unknown>;
        const library = normalizePositiveInteger(raw.library);
        if (library === null) {
            continue;
        }

        unique.set(library, {
            id: normalizePositiveInteger(raw.id) ?? undefined,
            library,
            access_count: normalizeOptionalInteger(raw.access_count),
            available_licenses: normalizeOptionalInteger(raw.available_licenses),
            max_uses_per_license: normalizeOptionalInteger(raw.max_uses_per_license),
            license_uses_count: normalizeOptionalInteger(raw.license_uses_count),
        });
    }

    return Array.from(unique.values());
}

/**
 * Cria um vínculo de formulário a partir do vínculo da API.
 *
 * @param link Vínculo retornado pela API.
 * @param defaults Política padrão a aplicar quando faltar valor.
 * @returns Vínculo pronto para edição.
 */
export function buildBookLibraryForm(
    link: Partial<BookLibraryLink> | undefined,
    defaults: BookLibraryPolicyValues
): BookLibraryForm {
    return {
        id: link?.id,
        library: link?.library ? String(link.library) : "",
        available_licenses: resolvePolicyText(
            link?.available_licenses,
            defaults.available_licenses,
            5
        ),
        max_uses_per_license: resolvePolicyText(
            link?.max_uses_per_license,
            defaults.max_uses_per_license,
            26
        ),
        license_uses_count: resolvePolicyText(
            link?.license_uses_count,
            defaults.license_uses_count,
            0
        ),
    };
}

/**
 * Converte vínculos da API para o formato do formulário.
 *
 * @param links Vínculos retornados pela API.
 * @param defaults Política padrão do formulário.
 * @param fallbackLibraries Biblioteca de fallback quando não houver vínculos.
 * @returns Lista pronta para edição.
 */
export function buildBookLibraryForms(
    links: BookLibraryLink[] | undefined,
    defaults: BookLibraryPolicyValues,
    fallbackLibraries: string[] = []
): BookLibraryForm[] {
    if (Array.isArray(links) && links.length > 0) {
        return links.map((link) => buildBookLibraryForm(link, defaults));
    }

    return fallbackLibraries
        .map((library) => library.trim())
        .filter((library) => Boolean(library))
        .map((library) => ({
            library,
            available_licenses: defaults.available_licenses,
            max_uses_per_license: defaults.max_uses_per_license,
            license_uses_count: defaults.license_uses_count,
        }));
}

/**
 * Retorna apenas os IDs de acervo dos vínculos do formulário.
 *
 * @param links Lista de vínculos do formulário.
 * @returns IDs textuais dos acervos.
 */
export function extractBookLibraryIds(links: BookLibraryForm[]): string[] {
    return links
        .map((item) => item.library.trim())
        .filter((item) => Boolean(item));
}

/**
 * Atualiza a seleção de acervos preservando os vínculos já editados.
 *
 * @param currentLinks Vínculos atuais do formulário.
 * @param selectedLibraries IDs de acervo selecionados.
 * @param defaults Política padrão aplicada a novos vínculos.
 * @returns Lista sincronizada com a seleção atual.
 */
export function syncBookLibrarySelection(
    currentLinks: BookLibraryForm[],
    selectedLibraries: string[],
    defaults: BookLibraryPolicyValues
): BookLibraryForm[] {
    const currentByLibrary = new Map(
        currentLinks.map((item) => [item.library.trim(), item] as const)
    );
    const uniqueSelected = Array.from(
        new Set(selectedLibraries.map((item) => item.trim()).filter((item) => Boolean(item)))
    );

    return uniqueSelected.map((library) => {
        const current = currentByLibrary.get(library);
        if (current) {
            return {
                ...current,
                library,
            };
        }

        return {
            library,
            available_licenses: defaults.available_licenses,
            max_uses_per_license: defaults.max_uses_per_license,
            license_uses_count: defaults.license_uses_count,
        };
    });
}

/**
 * Converte vínculos do formulário para payload da API.
 *
 * @param links Vínculos do formulário.
 * @returns Payload serializável para a API.
 */
export function buildBookLibraryPayloads(
    links: BookLibraryForm[]
): BookLibraryPayload[] {
    const unique = new Map<number, BookLibraryPayload>();

    for (const item of links) {
        const library = normalizePositiveInteger(item.library);
        if (library === null) {
            continue;
        }

        unique.set(library, {
            library,
            available_licenses: normalizeOptionalInteger(item.available_licenses),
            max_uses_per_license: normalizeOptionalInteger(item.max_uses_per_license),
            license_uses_count: normalizeOptionalInteger(item.license_uses_count),
        });
    }

    return Array.from(unique.values());
}
