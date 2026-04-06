import { Book } from "../model/Book";
import { api, ApiError, buildAuthHeaders } from "./api";

export type AdminBook = Omit<Book, "publisher"> & {
    book_id?: string | null;
    publisher?: string | null;
    publisher_id?: number | string | null;
    publisher_name?: string | null;
    library?: number | null;
    library_name?: string | null;
};

export type AdminLibrary = {
    id: number;
    cnpj: string;
    nome: string;
};

export type AdminPublisher = {
    id: string;
    name: string;
    secret?: string;
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
    libraries: number[];
    publishers: string[];
};

export type BookFormPayload = {
    title: string | null;
    publisher: string | null;
    author: string | null;
    subject: string | null;
    library?: number;
    type?: string | null;
    external_url?: string | null;
    external_source?: string | null;
    file_name?: string | null;
    image_url?: string | null;
    edition: string | null;
    year: string | null;
    isbn: string | null;
    pages: string | null;
    language: string | null;
    review: string | null;
};

export type CreateBookPayload = BookFormPayload & {
    library?: number;
    base64_content?: string | null;
    file_extension?: string | null;
};

export type AdminUserPayload = {
    email: string;
    senha?: string;
    dica_senha: string;
    admin: boolean;
    libraries?: number[];
    publishers?: string[];
};

export type AdminLibraryPayload = {
    cnpj: string;
    nome: string;
};

export type AdminPublisherPayload = {
    id: string;
    name: string;
};

type ProfileLibrary = {
    id?: unknown;
    name?: unknown;
    nome?: unknown;
};

type ProfilePublisher = {
    id?: unknown;
    name?: unknown;
    nome?: unknown;
};

type ProfilePayload = {
    libraries?: ProfileLibrary[];
    publishers?: ProfilePublisher[];
};

/**
 * Normaliza um valor potencial de ID para string utilizável.
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
 * Monta lista única de IDs candidatos, preservando ordem de prioridade.
 *
 * @param values Valores brutos candidatos.
 * @returns IDs candidatos sem duplicação.
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
 * Executa operação de livro iterando candidatos de ID até sucesso.
 *
 * @param candidates IDs candidatos.
 * @param run Função que executa operação usando um candidato.
 * @returns Resultado da primeira execução bem-sucedida.
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
    throw new Error("Não foi possível localizar o livro para esta operação.");
}

/**
 * Normaliza payload unitário que pode vir direto ou em ``{ result: ... }``.
 *
 * @param data Payload bruto.
 * @returns Objeto unitário normalizado quando disponível.
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
 * Identifica se o erro recebido representa HTTP 404.
 *
 * @param error Erro retornado pela camada HTTP.
 * @returns ``true`` quando status é 404.
 */
function isNotFoundError(error: unknown): boolean {
    return Boolean((error as ApiError | null)?.status === 404);
}

/**
 * Extrai payload de profile para fallback de listas administrativas.
 *
 * @param data Resposta bruta de ``/profile``.
 * @returns Estrutura normalizada de profile.
 */
function normalizeProfilePayload(data: unknown): ProfilePayload {
    const payload = normalizeSingleObjectPayload(data);
    if (!payload) {
        return {};
    }

    const libraries = Array.isArray(payload.libraries) ? payload.libraries : [];
    const publishers = Array.isArray(payload.publishers) ? payload.publishers : [];

    return {
        libraries: libraries as ProfileLibrary[],
        publishers: publishers as ProfilePublisher[],
    };
}

/**
 * Normaliza um item bruto da API para o formato esperado de livro administrativo.
 *
 * @param entry Registro bruto recebido da API.
 * @returns Livro normalizado ou ``null`` quando inválido.
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
 * Normaliza um item de usuário da API.
 *
 * @param entry Registro bruto de usuário.
 * @returns Usuário normalizado ou ``null`` quando inválido.
 */
function normalizeAdminUser(entry: unknown): AdminUser | null {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const raw = entry as Record<string, unknown>;

    const id =
        typeof raw.id === "string" || typeof raw.id === "number"
            ? String(raw.id)
            : "";
    const email = typeof raw.email === "string" ? raw.email : "";
    if (!id || !email) {
        return null;
    }

    const libraries = Array.isArray(raw.libraries)
        ? raw.libraries
              .map((item) => Number(item))
              .filter((item) => Number.isFinite(item) && item > 0)
        : [];

    const publishers = Array.isArray(raw.publishers)
        ? raw.publishers
              .map((item) => (item === null || item === undefined ? "" : String(item).trim()))
              .filter((item) => Boolean(item))
        : [];

    return {
        id,
        email,
        pass_hint: typeof raw.pass_hint === "string" ? raw.pass_hint : "",
        admin: Boolean(raw.admin),
        libraries,
        publishers,
    };
}

/**
 * Normaliza payload de listagem de usuários.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Lista de usuários.
 */
export function normalizeUsersResponse(data: unknown): AdminUser[] {
    const normalizeList = (items: unknown[]): AdminUser[] =>
        items.reduce<AdminUser[]>((acc, item) => {
            const normalized = normalizeAdminUser(item);
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
 * Normaliza payload de item de usuário.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Usuário normalizado.
 */
export function normalizeUserResponse(data: unknown): AdminUser {
    const payload = normalizeSingleObjectPayload(data);
    const normalized = normalizeAdminUser(payload);
    if (!normalized) {
        throw new Error("Usuário inválido retornado pela API.");
    }
    return normalized;
}

/**
 * Normaliza lista de bibliotecas em formato suportado pela UI.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Lista de bibliotecas.
 */
export function normalizeLibrariesResponse(data: unknown): AdminLibrary[] {
    const normalizeEntry = (entry: unknown): AdminLibrary | null => {
        if (!entry || typeof entry !== "object") {
            return null;
        }

        const raw = entry as Record<string, unknown>;
        const id = Number(raw.id);
        const nome =
            typeof raw.nome === "string"
                ? raw.nome
                : typeof raw.name === "string"
                    ? raw.name
                    : "";
        const cnpj = typeof raw.cnpj === "string" ? raw.cnpj : "";

        if (!Number.isFinite(id) || id <= 0 || !nome.trim()) {
            return null;
        }

        return {
            id,
            nome,
            cnpj,
        };
    };

    const normalizeList = (items: unknown[]): AdminLibrary[] =>
        items.reduce<AdminLibrary[]>((acc, item) => {
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
 * Normaliza lista de editoras em formato suportado pela UI.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Lista de editoras.
 */
export function normalizePublishersResponse(data: unknown): AdminPublisher[] {
    const normalizeEntry = (entry: unknown): AdminPublisher | null => {
        if (!entry || typeof entry !== "object") {
            return null;
        }

        const raw = entry as Record<string, unknown>;
        const id =
            typeof raw.id === "string" || typeof raw.id === "number"
                ? String(raw.id).trim()
                : "";
        const name =
            typeof raw.name === "string"
                ? raw.name
                : typeof raw.nome === "string"
                    ? raw.nome
                    : "";
        const secret = typeof raw.secret === "string" ? raw.secret : undefined;

        if (!id || !name.trim()) {
            return null;
        }

        return {
            id,
            name,
            secret,
        };
    };

    const normalizeList = (items: unknown[]): AdminPublisher[] =>
        items.reduce<AdminPublisher[]>((acc, item) => {
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
 * Separa nome base e extensão do arquivo enviado.
 *
 * @param file Arquivo selecionado.
 * @returns Nome base e extensão.
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
 * Carrega página inicial de livros com filtros.
 *
 * @param token Token JWT.
 * @param filters Filtros opcionais.
 * @returns Página de livros.
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
        query.set("publisher", filters.publisher);
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
 * Carrega próxima página de livros a partir do link ``next``.
 *
 * @param token Token JWT.
 * @param nextUrl URL de próxima página retornada pela API.
 * @returns Página de livros.
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
            // Mantém mensagem padrão.
        }
        throw new Error(message);
    }

    const data = (await response.json()) as unknown;
    return normalizePaginatedBooksResponse(data);
}

/**
 * Busca um livro por ID.
 *
 * @param token Token JWT.
 * @param id Identificador do livro.
 * @returns Livro.
 */
export async function fetchBookById(token: string, id: string): Promise<AdminBook> {
    const candidates = buildBookIdCandidates(id);
    if (candidates.length === 0) {
        throw new Error("ID do livro inválido para edição.");
    }

    return runBookRequestWithCandidates(candidates, async (candidate) => {
        return api.get<AdminBook>(`/books/${encodeURIComponent(candidate)}`, token);
    });
}

/**
 * Tenta resolver ``book_id`` real a partir de um vínculo de ``libraries_books``.
 *
 * @param token Token JWT.
 * @param libraryBookId ID do vínculo em ``libraries_books``.
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
            // Tenta próximo candidato.
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
        throw new Error("ID do livro inválido para atualização.");
    }

    await runBookRequestWithCandidates(candidates, async (candidate) => {
        await api.put(`/books/${encodeURIComponent(candidate)}`, payload, token);
    });
}

/**
 * Remove um livro por ID.
 *
 * @param token Token JWT.
 * @param id Identificador do livro.
 * @returns Promise<void>.
 */
export async function deleteBook(token: string, id: string): Promise<void> {
    const candidates = buildBookIdCandidates(id);
    if (candidates.length === 0) {
        throw new Error("ID do livro inválido para remoção.");
    }

    await runBookRequestWithCandidates(candidates, async (candidate) => {
        await api.delete(`/books/${encodeURIComponent(candidate)}`, token);
    });
}

/**
 * Lista usuários administrativos.
 *
 * @param token Token JWT.
 * @param search Busca textual opcional.
 * @returns Lista de usuários.
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
 * Busca usuário por ID.
 *
 * @param token Token JWT.
 * @param id Identificador do usuário.
 * @returns Usuário detalhado.
 */
export async function fetchUserById(token: string, id: string): Promise<AdminUser> {
    const data = await api.get<unknown>(`/users/${encodeURIComponent(id)}`, token);
    return normalizeUserResponse(data);
}

/**
 * Cadastra usuário.
 *
 * @param token Token JWT.
 * @param payload Dados do usuário.
 * @returns Usuário criado.
 */
export async function createUser(
    token: string,
    payload: AdminUserPayload & { senha: string }
): Promise<AdminUser> {
    const data = await api.post<unknown>("/users", payload, token);
    return normalizeUserResponse(data);
}

/**
 * Atualiza usuário.
 *
 * @param token Token JWT.
 * @param id Identificador do usuário.
 * @param payload Dados atualizados.
 * @returns Usuário atualizado.
 */
export async function updateUser(
    token: string,
    id: string,
    payload: AdminUserPayload
): Promise<AdminUser> {
    const data = await api.put<unknown>(`/users/${id}`, payload, token);
    return normalizeUserResponse(data);
}

/**
 * Remove usuário por ID.
 *
 * @param token Token JWT.
 * @param id Identificador do usuário.
 * @returns Promise<void>.
 */
export async function deleteUser(token: string, id: string): Promise<void> {
    await api.delete(`/users/${id}`, token);
}

/**
 * Busca profile atual para suportar fallback de listas administrativas.
 *
 * @param token Token JWT.
 * @returns Payload bruto do endpoint ``/profile``.
 */
async function fetchProfileForFallback(token: string): Promise<ProfilePayload> {
    const data = await api.get<unknown>("/profile", token);
    return normalizeProfilePayload(data);
}

/**
 * Converte bibliotecas do profile no formato administrativo.
 *
 * @param profile Payload normalizado de profile.
 * @returns Lista de bibliotecas para a UI.
 */
function mapProfileLibrariesToAdmin(profile: ProfilePayload): AdminLibrary[] {
    const libraries = Array.isArray(profile.libraries) ? profile.libraries : [];
    return libraries
        .map((item) => {
            const id = Number(item?.id);
            const nomeRaw = item?.nome ?? item?.name;
            const nome = typeof nomeRaw === "string" ? nomeRaw : "";
            if (!Number.isFinite(id) || id <= 0 || !nome.trim()) {
                return null;
            }

            return {
                id,
                nome,
                cnpj: "",
            };
        })
        .filter((item): item is AdminLibrary => Boolean(item));
}

/**
 * Converte editoras do profile no formato administrativo.
 *
 * @param profile Payload normalizado de profile.
 * @returns Lista de editoras para a UI.
 */
function mapProfilePublishersToAdmin(profile: ProfilePayload): AdminPublisher[] {
    const publishers = Array.isArray(profile.publishers) ? profile.publishers : [];
    return publishers
        .map((item) => {
            const idRaw = item?.id;
            const id =
                typeof idRaw === "string" || typeof idRaw === "number"
                    ? String(idRaw).trim()
                    : "";
            const nameRaw = item?.name ?? item?.nome;
            const name = typeof nameRaw === "string" ? nameRaw : "";

            if (!id || !name.trim()) {
                return null;
            }

            return {
                id,
                name,
            };
        })
        .filter((item): item is AdminPublisher => Boolean(item));
}

/**
 * Monta erro explicativo para endpoint ainda indisponível no backend ativo.
 *
 * @param resource Recurso alvo (libraries/publishers).
 * @returns Erro com mensagem amigável.
 */
function buildUnavailableEndpointError(resource: "libraries" | "publishers"): Error {
    const label = resource === "libraries" ? "bibliotecas" : "editoras";
    return new Error(`API de ${label} indisponível no backend atual.`);
}

/**
 * Lista bibliotecas para manutenção.
 *
 * @param token Token JWT.
 * @param search Busca textual opcional.
 * @returns Lista de bibliotecas.
 */
export async function fetchLibraries(token: string, search?: string): Promise<AdminLibrary[]> {
    const query = new URLSearchParams({
        limit: "200",
    });
    if (search) {
        query.set("search", search);
    }
    try {
        const data = await api.get<unknown>(`/libraries?${query.toString()}`, token);
        return normalizeLibrariesResponse(data);
    } catch (error) {
        if (!isNotFoundError(error)) {
            throw error;
        }

        const profile = await fetchProfileForFallback(token);
        const libraries = mapProfileLibrariesToAdmin(profile);
        const normalizedSearch = (search || "").trim().toLowerCase();
        if (!normalizedSearch) {
            return libraries;
        }

        return libraries.filter((item) => {
            const composite = `${item.nome} ${item.id} ${item.cnpj}`.toLowerCase();
            return composite.includes(normalizedSearch);
        });
    }
}

/**
 * Cria uma biblioteca.
 *
 * @param token Token JWT.
 * @param payload Dados da biblioteca.
 * @returns Biblioteca criada.
 */
export async function createLibrary(
    token: string,
    payload: AdminLibraryPayload
): Promise<AdminLibrary> {
    let data: unknown;
    try {
        data = await api.post<unknown>("/libraries", payload, token);
    } catch (error) {
        if (isNotFoundError(error)) {
            throw buildUnavailableEndpointError("libraries");
        }
        throw error;
    }

    const normalized = normalizeSingleObjectPayload(data);
    const id = Number(normalized?.id);
    const nome =
        typeof normalized?.nome === "string"
            ? normalized.nome
            : typeof normalized?.name === "string"
                ? normalized.name
                : "";
    const cnpj = typeof normalized?.cnpj === "string" ? normalized.cnpj : "";
    if (!Number.isFinite(id) || id <= 0 || !nome.trim()) {
        throw new Error("Resposta inválida ao criar biblioteca.");
    }
    return {
        id,
        nome,
        cnpj,
    };
}

/**
 * Atualiza uma biblioteca.
 *
 * @param token Token JWT.
 * @param id Identificador da biblioteca.
 * @param payload Dados atualizados.
 * @returns Biblioteca atualizada.
 */
export async function updateLibrary(
    token: string,
    id: number,
    payload: AdminLibraryPayload
): Promise<AdminLibrary> {
    let data: unknown;
    try {
        data = await api.put<unknown>(`/libraries/${id}`, payload, token);
    } catch (error) {
        if (isNotFoundError(error)) {
            throw buildUnavailableEndpointError("libraries");
        }
        throw error;
    }

    const normalized = normalizeSingleObjectPayload(data);
    const parsedId = Number(normalized?.id);
    const nome =
        typeof normalized?.nome === "string"
            ? normalized.nome
            : typeof normalized?.name === "string"
                ? normalized.name
                : "";
    const cnpj = typeof normalized?.cnpj === "string" ? normalized.cnpj : "";
    if (!Number.isFinite(parsedId) || parsedId <= 0 || !nome.trim()) {
        throw new Error("Resposta inválida ao atualizar biblioteca.");
    }
    return {
        id: parsedId,
        nome,
        cnpj,
    };
}

/**
 * Remove uma biblioteca.
 *
 * @param token Token JWT.
 * @param id Identificador da biblioteca.
 * @returns Promise<void>.
 */
export async function deleteLibrary(token: string, id: number): Promise<void> {
    try {
        await api.delete(`/libraries/${id}`, token);
    } catch (error) {
        if (isNotFoundError(error)) {
            throw buildUnavailableEndpointError("libraries");
        }
        throw error;
    }
}

/**
 * Lista editoras para manutenção.
 *
 * @param token Token JWT.
 * @param search Busca textual opcional.
 * @returns Lista de editoras.
 */
export async function fetchPublishers(token: string, search?: string): Promise<AdminPublisher[]> {
    const query = new URLSearchParams({
        limit: "200",
    });
    if (search) {
        query.set("search", search);
    }
    try {
        const data = await api.get<unknown>(`/publishers?${query.toString()}`, token);
        return normalizePublishersResponse(data);
    } catch (error) {
        if (!isNotFoundError(error)) {
            throw error;
        }

        const profile = await fetchProfileForFallback(token);
        const publishers = mapProfilePublishersToAdmin(profile);
        const normalizedSearch = (search || "").trim().toLowerCase();
        if (!normalizedSearch) {
            return publishers;
        }

        return publishers.filter((item) => {
            const composite = `${item.name} ${item.id}`.toLowerCase();
            return composite.includes(normalizedSearch);
        });
    }
}

/**
 * Cria uma editora.
 *
 * @param token Token JWT.
 * @param payload Dados da editora.
 * @returns Editora criada.
 */
export async function createPublisher(
    token: string,
    payload: AdminPublisherPayload
): Promise<AdminPublisher> {
    let data: unknown;
    try {
        data = await api.post<unknown>("/publishers", payload, token);
    } catch (error) {
        if (isNotFoundError(error)) {
            throw buildUnavailableEndpointError("publishers");
        }
        throw error;
    }

    const normalized = normalizeSingleObjectPayload(data);
    const id =
        typeof normalized?.id === "string" || typeof normalized?.id === "number"
            ? String(normalized.id).trim()
            : "";
    const name =
        typeof normalized?.name === "string"
            ? normalized.name
            : typeof normalized?.nome === "string"
                ? normalized.nome
                : "";
    const secret = typeof normalized?.secret === "string" ? normalized.secret : undefined;
    if (!id || !name.trim()) {
        throw new Error("Resposta inválida ao criar editora.");
    }
    return {
        id,
        name,
        secret,
    };
}

/**
 * Atualiza uma editora.
 *
 * @param token Token JWT.
 * @param id Identificador da editora.
 * @param payload Dados atualizados.
 * @returns Editora atualizada.
 */
export async function updatePublisher(
    token: string,
    id: string,
    payload: AdminPublisherPayload
): Promise<AdminPublisher> {
    let data: unknown;
    try {
        data = await api.put<unknown>(`/publishers/${encodeURIComponent(id)}`, payload, token);
    } catch (error) {
        if (isNotFoundError(error)) {
            throw buildUnavailableEndpointError("publishers");
        }
        throw error;
    }

    const normalized = normalizeSingleObjectPayload(data);
    const parsedId =
        typeof normalized?.id === "string" || typeof normalized?.id === "number"
            ? String(normalized.id).trim()
            : "";
    const name =
        typeof normalized?.name === "string"
            ? normalized.name
            : typeof normalized?.nome === "string"
                ? normalized.nome
                : "";
    const secret = typeof normalized?.secret === "string" ? normalized.secret : undefined;
    if (!parsedId || !name.trim()) {
        throw new Error("Resposta inválida ao atualizar editora.");
    }
    return {
        id: parsedId,
        name,
        secret,
    };
}

/**
 * Remove uma editora.
 *
 * @param token Token JWT.
 * @param id Identificador da editora.
 * @returns Promise<void>.
 */
export async function deletePublisher(token: string, id: string): Promise<void> {
    try {
        await api.delete(`/publishers/${encodeURIComponent(id)}`, token);
    } catch (error) {
        if (isNotFoundError(error)) {
            throw buildUnavailableEndpointError("publishers");
        }
        throw error;
    }
}
