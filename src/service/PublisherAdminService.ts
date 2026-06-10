import { Book } from "../model/Book";
import type { BookLibraryLink, BookLibraryPayload } from "../model/BookLibrary";
import { normalizeBookLibraryLinks } from "../model/BookLibrary";
import { api, buildAuthHeaders } from "./api";

export type PublisherSubject = {
    id: number;
    name: string;
};

export type PublisherAuthor = {
    id: number;
    name: string;
};

export type PublisherBookFilters = {
    publisher?: string;
    search?: string;
    limit?: number;
};

export type PublisherAdminBook = Book & {
    book_id?: string | null;
    library?: number | null;
    libraries?: BookLibraryLink[];
};

export type { BookLibraryPayload } from "../model/BookLibrary";

export type UpdateBookPayload = {
    title: string | null;
    subtitle?: string | null;
    original_title?: string | null;
    corporate_author?: string | null;
    publisher: string | null;
    publication_place?: string | null;
    preco_sugerido?: string | null;
    dewey_decimal?: string | null;
    type?: string | null;
    external_url?: string | null;
    external_source?: string | null;
    html_version_url?: string | null;
    file_name?: string | null;
    image_url?: string | null;
    edition: string | null;
    year: string | null;
    isbn: string | null;
    pages: string | null;
    language: string | null;
    summary?: string | null;
    general_note?: string | null;
    bibliography_note?: string | null;
    content_type?: string | null;
    media_type?: string | null;
    carrier_type?: string | null;
    authors?: Array<{ id?: number; author: number }>;
    subjects?: Array<{ id?: number; subject: number }>;
    libraries?: BookLibraryPayload[];
};

export type CreateBookPayload = UpdateBookPayload & {
    base64_content?: string | null;
    file_extension?: string | null;
};

export type PurchaseLinkPayload = {
    publisher: string;
    book_id: string;
    user_email: string;
    reading_pass_hint: string;
    reading_pass_hash: string;
};

export type PurchaseLinkResponse = {
    purchase_link: string;
};

/**
 * Normaliza um valor potencial de ID de livro para string utilizável.
 *
 * @param value Valor bruto do identificador.
 * @returns ID como string ou ``null`` quando inválido.
 */
function normalizeBookId(value: unknown): string | null {
    const rawValue =
        typeof value === "string"
            ? value.trim()
            : typeof value === "number"
                ? String(value)
                : "";

    return rawValue || null;
}

/**
 * Remove duplicidades de livros retornados por ``/libraries_books``,
 * consolidando o mesmo ``id`` em um único item.
 *
 * @param books Lista potencialmente duplicada.
 * @returns Lista consolidada por livro.
 */
function deduplicateBooksById(books: PublisherAdminBook[]): PublisherAdminBook[] {
    const byId = new Map<string, PublisherAdminBook>();

    for (const item of books) {
        const bookId = normalizeBookId(item.id ?? item.book_id);
        if (!bookId) {
            continue;
        }

        const current = byId.get(bookId);
        if (!current) {
            byId.set(bookId, item);
            continue;
        }

        const mergedLibraries = new Map<number, BookLibraryLink>();
        const currentLibraries = Array.isArray(current.libraries) ? current.libraries : [];
        const itemLibraries = Array.isArray(item.libraries) ? item.libraries : [];

        for (const link of currentLibraries) {
            mergedLibraries.set(link.library, link);
        }
        for (const link of itemLibraries) {
            mergedLibraries.set(link.library, link);
        }

        const currentLibrary = Number(current.library);
        if (Number.isFinite(currentLibrary) && currentLibrary > 0) {
            mergedLibraries.set(currentLibrary, {
                library: currentLibrary,
            });
        }
        const itemLibrary = Number(item.library);
        if (Number.isFinite(itemLibrary) && itemLibrary > 0) {
            mergedLibraries.set(itemLibrary, {
                library: itemLibrary,
            });
        }

        byId.set(bookId, {
            ...current,
            ...item,
            id: bookId,
            book_id: bookId,
            libraries: Array.from(mergedLibraries.values()),
        });
    }

    return Array.from(byId.values());
}

/**
 * Monta lista única de IDs candidatos de livro.
 *
 * @param values Valores brutos candidatos.
 * @returns IDs candidatos sem duplicação.
 */
function buildBookIdCandidates(...values: unknown[]): string[] {
    const unique = new Set<string>();

    for (const value of values) {
        const normalized = normalizeBookId(value);
        if (normalized) {
            unique.add(normalized);
        }
    }

    return Array.from(unique);
}

/**
 * Normaliza um item bruto da API para o formato esperado de livro do Publisher Admin.
 *
 * @param entry Registro bruto recebido da API.
 * @returns Livro normalizado ou ``null`` quando inválido.
 */
function normalizePublisherAdminBook(entry: unknown): PublisherAdminBook | null {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const raw = entry as Record<string, unknown>;
    const resolvedId = buildBookIdCandidates(raw.book_id, raw.id, raw.book)[0] || "";
    if (!resolvedId) {
        return null;
    }

    return {
        ...(raw as Omit<PublisherAdminBook, "id" | "book_id" | "library" | "libraries">),
        id: resolvedId,
        book_id: resolvedId,
        library: Number.isFinite(Number(raw.library)) && Number(raw.library) > 0
            ? Number(raw.library)
            : undefined,
        libraries: normalizeBookLibraryLinks(raw.libraries),
    };
}

/**
 * Normaliza lista de assuntos em formato suportado pela UI.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Lista de assuntos.
 */
export function normalizeSubjectsResponse(data: unknown): PublisherSubject[] {
    const normalizeEntry = (entry: unknown): PublisherSubject | null => {
        if (!entry || typeof entry !== "object") {
            return null;
        }

        const raw = entry as Record<string, unknown>;
        const id = Number(raw.id);
        const name = typeof raw.name === "string" ? raw.name : "";

        if (!Number.isFinite(id) || id <= 0 || !name.trim()) {
            return null;
        }

        return {
            id,
            name,
        };
    };

    const normalizeList = (items: unknown[]): PublisherSubject[] =>
        items.reduce<PublisherSubject[]>((acc, item) => {
            const normalized = normalizeEntry(item);
            if (normalized) {
                acc.push(normalized);
            }
            return acc;
        }, []);

    if (Array.isArray(data)) {
        return normalizeList(data);
    }

    if (
        data &&
        typeof data === "object" &&
        "result" in data &&
        Array.isArray((data as { result?: unknown }).result)
    ) {
        return normalizeList((data as { result: unknown[] }).result);
    }

    return [];
}

/**
 * Normaliza lista de autores em formato suportado pela UI.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Lista de autores.
 */
export function normalizeAuthorsResponse(data: unknown): PublisherAuthor[] {
    const normalizeEntry = (entry: unknown): PublisherAuthor | null => {
        if (!entry || typeof entry !== "object") {
            return null;
        }

        const raw = entry as Record<string, unknown>;
        const id = Number(raw.id);
        const name = typeof raw.name === "string" ? raw.name : "";

        if (!Number.isFinite(id) || id <= 0 || !name.trim()) {
            return null;
        }

        return {
            id,
            name,
        };
    };

    const normalizeList = (items: unknown[]): PublisherAuthor[] =>
        items.reduce<PublisherAuthor[]>((acc, item) => {
            const normalized = normalizeEntry(item);
            if (normalized) {
                acc.push(normalized);
            }
            return acc;
        }, []);

    if (Array.isArray(data)) {
        return normalizeList(data);
    }

    if (
        data &&
        typeof data === "object" &&
        "result" in data &&
        Array.isArray((data as { result?: unknown }).result)
    ) {
        return normalizeList((data as { result: unknown[] }).result);
    }

    return [];
}

/**
 * Normaliza respostas da API de livros para uma lista simples.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Lista de livros.
 */
export function normalizeBooksResponse(data: unknown): PublisherAdminBook[] {
    const normalizeList = (items: unknown[]): PublisherAdminBook[] =>
        items.reduce<PublisherAdminBook[]>((acc, item) => {
            const normalized = normalizePublisherAdminBook(item);
            if (normalized) {
                acc.push(normalized);
            }
            return acc;
        }, []);

    if (Array.isArray(data)) {
        return normalizeList(data);
    }
    if (
        data &&
        typeof data === "object" &&
        "result" in data &&
        Array.isArray((data as { result?: unknown }).result)
    ) {
        return normalizeList((data as { result: unknown[] }).result);
    }
    return [];
}

/**
 * Normaliza resposta unitária de livro, aceitando formatos
 * ``{ result: {...} }`` e objeto direto.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Livro ou ``null`` quando inválido.
 */
function normalizeSingleBookResponse(data: unknown): PublisherAdminBook | null {
    if (!data || typeof data !== "object") {
        return null;
    }

    if ("result" in data) {
        const result = (data as { result?: unknown }).result;
        if (result && typeof result === "object" && !Array.isArray(result)) {
            return normalizePublisherAdminBook(result);
        }
        return null;
    }

    return normalizePublisherAdminBook(data);
}

/**
 * Normaliza payload de ``/libraries_books`` para vínculos de acervo.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Vínculos normalizados entre livro e acervo.
 */
function normalizeBookLibraryLinksResponse(
    data: unknown
): Array<{ bookId: string; library: BookLibraryLink }> {
    const source = Array.isArray(data)
        ? data
        : data && typeof data === "object" && Array.isArray((data as { result?: unknown }).result)
            ? (data as { result: unknown[] }).result
            : [];

    const links: Array<{ bookId: string; library: BookLibraryLink }> = [];
    for (const item of source) {
        if (!item || typeof item !== "object") {
            continue;
        }

        const raw = item as Record<string, unknown>;
        const bookId = buildBookIdCandidates(raw.id, raw.book_id, raw.book)[0];
        const library = normalizeBookLibraryLinks([raw])[0];

        if (!bookId || !library) {
            continue;
        }

        links.push({
            bookId,
            library,
        });
    }

    return links;
}

/**
 * Separa nome base e extensão de um arquivo.
 *
 * @param file Arquivo selecionado no input.
 * @returns Objeto com ``fileName`` e ``fileExtension``.
 */
export function getFileParts(file: File) {
    const nameParts = file.name.split(".");
    if (nameParts.length === 1) {
        return { fileName: file.name, fileExtension: "" };
    }
    const fileExtension = nameParts.pop() || "";
    const fileName = nameParts.join(".");
    return { fileName, fileExtension };
}

/**
 * Lê um arquivo e retorna seu conteúdo em base64.
 *
 * @param file Arquivo a ser convertido.
 * @returns Promise com string base64 sem prefixo data URL.
 */
export function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("Falha ao ler o arquivo."));
                return;
            }
            const base64 = result.split(",")[1] || "";
            resolve(base64);
        };
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
    });
}

/**
 * Calcula hash SHA-256 em formato hexadecimal.
 *
 * @param text Texto de entrada para hash.
 * @returns Hash hexadecimal.
 */
export async function sha256Hex(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Busca livros administrativos da editora com filtros opcionais.
 *
 * @param token Token JWT do usuário autenticado.
 * @param filters Filtros de listagem.
 * @returns Lista de livros.
 */
export async function fetchBooks(
    token: string,
    filters: PublisherBookFilters = {}
): Promise<PublisherAdminBook[]> {
    const allBooks: PublisherAdminBook[] = [];

    const query = new URLSearchParams();
    if (filters.search) {
        query.set("search", filters.search);
    }
    if (filters.publisher) {
        query.set("publisher", filters.publisher);
    }
    if (filters.limit && filters.limit > 0) {
        query.set("limit", String(filters.limit));
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    let data = await api.get<unknown>(`/libraries_books${suffix}`, token);
    let books = normalizeBooksResponse(data);
    allBooks.push(...books);

    while (data && typeof data === "object" && "next" in data) {
        const next = (data as { next?: unknown }).next;
        if (typeof next !== "string" || !next) {
            break;
        }

        const response = await fetch(next, {
            method: "GET",
            headers: buildAuthHeaders(token),
        });
        if (!response.ok) {
            break;
        }

        data = (await response.json()) as unknown;
        books = normalizeBooksResponse(data);
        allBooks.push(...books);
    }

    return deduplicateBooksById(allBooks);
}

/**
 * Busca um livro por ID.
 *
 * @param token Token JWT do usuário autenticado.
 * @param id Identificador do livro.
 * @returns Livro.
 */
export async function fetchBookById(token: string, id: string): Promise<Book> {
    const data = await api.get<unknown>(`/books/${encodeURIComponent(id)}`, token);
    const normalized = normalizeSingleBookResponse(data);
    if (!normalized) {
        throw new Error("Livro inválido retornado pela API.");
    }
    return normalized;
}

/**
 * Lista vínculos de acervos associados a um livro.
 *
 * @param token Token JWT do usuário autenticado.
 * @param bookId Identificador do livro.
 * @param libraryId Identificador do acervo que particiona a relação.
 * @returns Lista de vínculos de acervo associados.
 */
export async function fetchBookLibraryLinks(
    token: string,
    bookId: string,
    libraryId: string | number
): Promise<BookLibraryLink[]> {
    const query = new URLSearchParams({
        id: bookId,
        library: String(libraryId),
        fields: "id,library,access_count,available_licenses,max_uses_per_license,license_uses_count,preco_compra",
        limit: "200",
    });
    const data = await api.get<unknown>(`/libraries_books?${query.toString()}`, token);
    return normalizeBookLibraryLinksResponse(data).map((item) => item.library);
}

/**
 * Lista assuntos disponíveis para seleção no cadastro de livros.
 *
 * @param token Token JWT do usuário autenticado.
 * @returns Lista de assuntos.
 */
export async function fetchSubjects(token: string): Promise<PublisherSubject[]> {
    const data = await api.get<unknown>("/subjects?limit=200", token);
    return normalizeSubjectsResponse(data);
}

/**
 * Lista autores disponíveis para seleção no cadastro de livros.
 *
 * @param token Token JWT do usuário autenticado.
 * @returns Lista de autores.
 */
export async function fetchAuthors(token: string): Promise<PublisherAuthor[]> {
    const data = await api.get<unknown>("/authors?limit=200", token);
    return normalizeAuthorsResponse(data);
}

/**
 * Atualiza metadados de um livro existente.
 *
 * @param token Token JWT do usuário autenticado.
 * @param id Identificador do livro.
 * @param payload Campos a serem atualizados.
 * @returns Promise<void>
 */
export async function updateBook(
    token: string,
    id: string,
    payload: UpdateBookPayload
): Promise<void> {
    await api.put(`/books/${id}`, payload, token);
}

/**
 * Cria novo livro com metadados e conteúdo.
 *
 * @param token Token JWT do usuário autenticado.
 * @param payload Dados completos do livro para cadastro.
 * @returns Promise<void>
 */
export async function createBook(
    token: string,
    payload: CreateBookPayload
): Promise<void> {
    await api.post("/books", payload, token);
}

/**
 * Gera link assinado para compra/download licenciado.
 *
 * @param token Token JWT do usuário autenticado.
 * @param payload Dados necessários para geração do link.
 * @returns Resposta contendo ``purchase_link``.
 */
export async function generatePurchaseLink(
    token: string,
    payload: PurchaseLinkPayload
): Promise<PurchaseLinkResponse> {
    return api.post<PurchaseLinkResponse>("/books-purchase-links", payload, token);
}
