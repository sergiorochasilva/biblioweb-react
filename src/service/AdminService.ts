import { Book } from "../model/Book";
import { api, buildAuthHeaders } from "./api";

export type AdminBook = Omit<Book, "publisher"> & {
    book_id?: string | null;
    publisher?: string | null;
    publisher_id?: number | string | null;
    publisher_name?: string | null;
    library?: number | null;
    library_name?: string | null;
};

export type AdminBookFilters = {
    publisher?: string;
    library?: string;
    search?: string;
    limit?: number;
};

export type PaginatedAdminBooksResponse = {
    next: string | null;
    result: AdminBook[];
};

export type AdminUser = {
    id: string;
    email: string;
    pass_hint: string;
    admin: boolean;
};

export type BookFormPayload = {
    title: string | null;
    publisher: string | null;
    author: string | null;
    subject: string | null;
    type?: string | null;
    external_url?: string | null;
    file_name: string | null;
    image_url: string | null;
    edition: string | null;
    year: string | null;
    isbn: string | null;
    pages: string | null;
    language: string | null;
    review: string | null;
};

export type CreateBookPayload = BookFormPayload & {
    library?: number;
    base64_content: string;
    file_extension: string;
};

export type AdminUserPayload = {
    email: string;
    senha?: string;
    dica_senha: string;
    admin: boolean;
};

/**
 * Normaliza um valor potencial de ID para string utilizavel.
 *
 * @param value Valor bruto do identificador.
 * @returns ID como string ou ``null`` quando invalido.
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
 * Coleta IDs candidatos de um valor bruto sem alterar formato recebido.
 *
 * @param value Valor potencialmente contendo identificadores.
 * @returns IDs candidatos encontrados.
 */
function collectBookIdsFromValue(value: unknown): string[] {
    const primitiveId = normalizeBookId(value);
    if (primitiveId) {
        return [primitiveId];
    }

    if (!value || typeof value !== "object") {
        return [];
    }

    const payload = value as Record<string, unknown>;
    return [
        normalizeBookId(payload.book_id),
        normalizeBookId(payload.bookId),
        normalizeBookId(payload.id),
        ...collectBookIdsFromValue(payload.book),
    ].filter((id): id is string => Boolean(id));
}

/**
 * Monta lista unica de IDs candidatos, preservando ordem de prioridade.
 *
 * @param values Valores brutos candidatos.
 * @returns IDs candidatos sem duplicacao.
 */
function buildBookIdCandidates(...values: unknown[]): string[] {
    const unique = new Set<string>();

    for (const value of values) {
        for (const candidate of collectBookIdsFromValue(value)) {
            unique.add(candidate);
        }
    }

    return Array.from(unique);
}

/**
 * Executa operacao de livro iterando candidatos de ID ate sucesso.
 *
 * @param candidates IDs candidatos.
 * @param run Funcao que executa operacao usando um candidato.
 * @returns Resultado da primeira execucao bem-sucedida.
 */
async function runBookRequestWithCandidates<T>(
    candidates: string[],
    run: (candidate: string) => Promise<T>
): Promise<T> {
    let lastError: unknown = null;

    for (const candidate of candidates) {
        try {
            return await run(candidate);
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError instanceof Error) {
        throw lastError;
    }
    throw new Error("Nao foi possivel localizar o livro para esta operacao.");
}

/**
 * Normaliza payload unitario que pode vir direto ou em ``{ result: ... }``.
 *
 * @param data Payload bruto.
 * @returns Objeto unitario normalizado quando disponivel.
 */
function normalizeSingleObjectPayload(data: unknown): Record<string, unknown> | null {
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const payload = data as Record<string, unknown>;
        if (payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)) {
            return payload.result as Record<string, unknown>;
        }
        return payload;
    }

    return null;
}

/**
 * Normaliza um item bruto da API para o formato esperado de livro administrativo.
 *
 * @param entry Registro bruto recebido da API.
 * @returns Livro normalizado ou ``null`` quando invalido.
 */
function normalizeAdminBook(entry: unknown): AdminBook | null {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const raw = entry as Record<string, unknown>;
    const publisherName =
        typeof raw.publisher_name === "string" && raw.publisher_name.trim()
            ? raw.publisher_name
            : null;
    const resolvedBookId = buildBookIdCandidates(raw.book_id, raw.book)[0] || null;
    const resolvedId = buildBookIdCandidates(raw.book_id, raw.id, raw.book)[0] || "";
    const publisherRaw = raw.publisher;
    const publisherValue =
        typeof publisherRaw === "string"
            ? publisherRaw
            : typeof publisherRaw === "number"
                ? String(publisherRaw)
                : null;

    if (!resolvedId) {
        return null;
    }

    return {
        ...(raw as Omit<AdminBook, "publisher" | "publisher_id" | "publisher_name">),
        book_id: resolvedBookId,
        id: resolvedId,
        publisher: publisherName || publisherValue,
        publisher_id:
            typeof raw.publisher_id === "string" || typeof raw.publisher_id === "number"
                ? raw.publisher_id
                : null,
        publisher_name: publisherName,
        library:
            typeof raw.library === "number" || raw.library === null
                ? raw.library
                : undefined,
        library_name: typeof raw.library_name === "string" ? raw.library_name : null,
    };
}

/**
 * Normaliza uma lista bruta de livros administrativos.
 *
 * @param data Lista bruta retornada pela API.
 * @returns Lista normalizada de livros.
 */
function normalizeAdminBooksList(data: unknown): AdminBook[] {
    if (!Array.isArray(data)) {
        return [];
    }

    return data.reduce<AdminBook[]>((acc, entry) => {
        const normalized = normalizeAdminBook(entry);
        if (normalized) {
            acc.push(normalized);
        }
        return acc;
    }, []);
}

/**
 * Normaliza payload de listagem paginada de livros.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Estrutura paginada de livros.
 */
export function normalizePaginatedBooksResponse(data: unknown): PaginatedAdminBooksResponse {
    if (Array.isArray(data)) {
        return { next: null, result: normalizeAdminBooksList(data) };
    }

    if (data && typeof data === "object") {
        const payload = data as { next?: unknown; result?: unknown };
        const result = normalizeAdminBooksList(payload.result);
        const next = typeof payload.next === "string" && payload.next ? payload.next : null;
        return { next, result };
    }

    return { next: null, result: [] };
}

/**
 * Normaliza payload de listagem de usuarios.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Lista de usuarios.
 */
export function normalizeUsersResponse(data: unknown): AdminUser[] {
    if (Array.isArray(data)) {
        return data as AdminUser[];
    }

    if (
        data &&
        typeof data === "object" &&
        "result" in data &&
        Array.isArray((data as { result?: unknown }).result)
    ) {
        return (data as { result: AdminUser[] }).result;
    }

    return [];
}

/**
 * Separa nome base e extensao do arquivo enviado.
 *
 * @param file Arquivo selecionado.
 * @returns Nome base e extensao.
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
 * Converte arquivo para base64.
 *
 * @param file Arquivo a ser convertido.
 * @returns Base64 sem prefixo data URL.
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
 * Carrega pagina inicial de livros com filtros.
 *
 * @param token Token JWT.
 * @param filters Filtros opcionais.
 * @returns Pagina de livros.
 */
export async function fetchBooksPage(
    token: string,
    filters: AdminBookFilters = {}
): Promise<PaginatedAdminBooksResponse> {
    const query = new URLSearchParams();
    if (filters.search) {
        query.set("search", filters.search);
    }
    if (filters.publisher) {
        query.set("publisher_name", filters.publisher);
        if (/^[0-9]+$/.test(filters.publisher)) {
            query.set("publisher", filters.publisher);
        }
    }
    if (filters.library) {
        query.set("library", filters.library);
    }
    if (filters.limit && filters.limit > 0) {
        query.set("limit", String(filters.limit));
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const data = await api.get<unknown>(`/books${suffix}`, token);
    return normalizePaginatedBooksResponse(data);
}

/**
 * Carrega proxima pagina de livros a partir do link `next`.
 *
 * @param token Token JWT.
 * @param nextUrl URL de proxima pagina retornada pela API.
 * @returns Pagina de livros.
 */
export async function fetchBooksPageByNext(
    token: string,
    nextUrl: string
): Promise<PaginatedAdminBooksResponse> {
    const response = await fetch(nextUrl, {
        method: "GET",
        headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
        let message = `API Error: ${response.statusText}`;
        try {
            const errorData = (await response.json()) as { message?: string };
            if (errorData.message) {
                message = errorData.message;
            }
        } catch {
            // Mantem mensagem padrao.
        }
        throw new Error(message);
    }

    const data = (await response.json()) as unknown;
    return normalizePaginatedBooksResponse(data);
}

/**
 * Busca um livro por id.
 *
 * @param token Token JWT.
 * @param id Identificador do livro.
 * @returns Livro.
 */
export async function fetchBookById(token: string, id: string): Promise<AdminBook> {
    const candidates = buildBookIdCandidates(id);
    if (candidates.length === 0) {
        throw new Error("ID do livro invalido para edicao.");
    }

    return runBookRequestWithCandidates(candidates, async (candidate) => {
        return api.get<AdminBook>(`/books/${encodeURIComponent(candidate)}`, token);
    });
}

/**
 * Tenta resolver ``book_id`` real a partir de um vinculo de ``libraries_books``.
 *
 * @param token Token JWT.
 * @param libraryBookId ID do vinculo em ``libraries_books``.
 * @returns ID do livro principal quando encontrado.
 */
export async function resolveBookIdByLibraryBookId(
    token: string,
    libraryBookId: string
): Promise<string | null> {
    const candidates = buildBookIdCandidates(libraryBookId);
    if (candidates.length === 0) {
        return null;
    }

    for (const candidate of candidates) {
        try {
            const data = await api.get<unknown>(
                `/libraries_books/${encodeURIComponent(candidate)}`,
                token
            );
            const payload = normalizeSingleObjectPayload(data);
            if (!payload) {
                continue;
            }

            const resolved = buildBookIdCandidates(
                payload.book_id,
                payload.book,
                payload.id
            )[0];
            if (resolved) {
                return resolved;
            }
        } catch {
            // Tenta proximo candidato.
        }
    }

    return null;
}

/**
 * Cadastra um novo livro.
 *
 * @param token Token JWT.
 * @param payload Dados do livro.
 * @returns Promise<void>.
 */
export async function createBook(token: string, payload: CreateBookPayload): Promise<void> {
    await api.post("/books", payload, token);
}

/**
 * Atualiza um livro existente.
 *
 * @param token Token JWT.
 * @param id Identificador do livro.
 * @param payload Dados atualizados.
 * @returns Promise<void>.
 */
export async function updateBook(
    token: string,
    id: string,
    payload: BookFormPayload
): Promise<void> {
    const candidates = buildBookIdCandidates(id);
    if (candidates.length === 0) {
        throw new Error("ID do livro invalido para atualizacao.");
    }

    await runBookRequestWithCandidates(candidates, async (candidate) => {
        await api.put(`/books/${encodeURIComponent(candidate)}`, payload, token);
    });
}

/**
 * Remove um livro por id.
 *
 * @param token Token JWT.
 * @param id Identificador do livro.
 * @returns Promise<void>.
 */
export async function deleteBook(token: string, id: string): Promise<void> {
    const candidates = buildBookIdCandidates(id);
    if (candidates.length === 0) {
        throw new Error("ID do livro invalido para remocao.");
    }

    await runBookRequestWithCandidates(candidates, async (candidate) => {
        await api.delete(`/books/${encodeURIComponent(candidate)}`, token);
    });
}

/**
 * Lista usuarios.
 *
 * @param token Token JWT.
 * @param search Busca textual opcional.
 * @returns Lista de usuarios.
 */
export async function fetchUsers(
    token: string,
    search?: string
): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    if (search) {
        query.set("search", search);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const data = await api.get<unknown>(`/users${suffix}`, token);
    return normalizeUsersResponse(data);
}

/**
 * Cadastra usuario.
 *
 * @param token Token JWT.
 * @param payload Dados do usuario.
 * @returns Usuario criado.
 */
export async function createUser(
    token: string,
    payload: AdminUserPayload & { senha: string }
): Promise<AdminUser> {
    return api.post<AdminUser>("/users", payload, token);
}

/**
 * Atualiza usuario.
 *
 * @param token Token JWT.
 * @param id Identificador do usuario.
 * @param payload Dados atualizados.
 * @returns Usuario atualizado.
 */
export async function updateUser(
    token: string,
    id: string,
    payload: AdminUserPayload
): Promise<AdminUser> {
    return api.put<AdminUser>(`/users/${id}`, payload, token);
}

/**
 * Remove usuario por id.
 *
 * @param token Token JWT.
 * @param id Identificador do usuario.
 * @returns Promise<void>.
 */
export async function deleteUser(token: string, id: string): Promise<void> {
    await api.delete(`/users/${id}`, token);
}
