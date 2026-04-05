import { Book } from "../model/Book";
import { api, API_BASE_URL, ApiError, buildAuthHeaders } from "./api";

export const DEFAULT_PUBLIC_LIBRARY_ID = 1;
const DEFAULT_BOOK_FIELDS = "review,type,external_url,file_name";
const MOST_ACCESSED_ORDER = "access_count desc";

/**
 * Normaliza respostas da API que podem vir como lista direta
 * ou como objeto no formato { result: [...] }.
 *
 * @param data Resposta crua da API.
 * @returns Lista de livros normalizada.
 */
function normalizeBooksResponse(data: any): Book[] {
    if (Array.isArray(data)) {
        return data as Book[];
    }
    if (data && Array.isArray(data.result)) {
        return data.result as Book[];
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
    if (data && typeof data === "object" && !Array.isArray(data) && "id" in data) {
        return data as Book;
    }
    return null;
}

/**
 * Normaliza respostas que retornam listas de strings.
 *
 * @param data Resposta crua da API.
 * @returns Lista de strings sem valores vazios.
 */
function normalizeStringListResponse(data: unknown): string[] {
    if (
        data &&
        typeof data === "object" &&
        "result" in data &&
        Array.isArray((data as { result?: unknown }).result)
    ) {
        return (data as { result: unknown[] }).result
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => Boolean(item));
    }

    if (Array.isArray(data)) {
        return data
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => Boolean(item));
    }

    return [];
}

/**
 * Identifica se o erro HTTP representa ``404 Not Found``.
 *
 * @param error Erro capturado da camada de API.
 * @returns ``true`` quando o status for 404.
 */
function isNotFoundError(error: unknown): boolean {
    return Boolean((error as ApiError | null)?.status === 404);
}

/**
 * Separa assuntos de um livro usando vírgula como delimitador.
 *
 * @param subject Valor bruto de assunto.
 * @returns Lista de assuntos normalizados.
 */
function splitSubjects(subject: string | null | undefined): string[] {
    if (!subject) {
        return [];
    }

    return subject
        .split(",")
        .map((item) => item.trim())
        .filter((item) => Boolean(item));
}

/**
 * Busca livros de uma biblioteca com campos customizados e limite opcional.
 *
 * @param libraryId ID da biblioteca.
 * @param token Token JWT opcional.
 * @param fields Campos adicionais pedidos no endpoint.
 * @param limit Limite opcional de registros.
 * @returns Lista normalizada de livros.
 */
async function fetchLibraryBooks(
    libraryId: number,
    token: string | undefined,
    fields: string,
    limit?: number
): Promise<Book[]> {
    const query = new URLSearchParams({
        library: String(libraryId),
        fields,
    });
    if (limit && limit > 0) {
        query.set("limit", String(limit));
    }

    const data = await api.get<unknown>(`/libraries_books?${query.toString()}`, token);
    return normalizeBooksResponse(data);
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
    const data = await api.get<any>(endpoint, token);
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
 * @param _libraryId Parâmetro mantido por compatibilidade com chamadas existentes.
 * @param token Token JWT opcional para cenários autenticados.
 * @returns Livro encontrado ou null quando não existir na resposta.
 */
export async function fetchBookDetails(
    id: string,
    _libraryId: number,
    token?: string
): Promise<Book | null> {
    const endpoint = `/libraries_books/${id}?fields=${DEFAULT_BOOK_FIELDS}`;
    try {
        const data = await api.get<unknown>(endpoint, token);
        return normalizeBookResponse(data);
    } catch {
        return null;
    }
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
    const endpoint = `/libraries_books?library=${libraryId}&search=${encodeURIComponent(query)}&fields=${DEFAULT_BOOK_FIELDS}`;
    const data = await api.get<any>(endpoint, token);
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
    const endpoint = `/books_subjects?library=${libraryId}`;

    try {
        const data = await api.get<unknown>(endpoint, token);
        return normalizeStringListResponse(data);
    } catch (error) {
        if (!isNotFoundError(error)) {
            throw error;
        }

        const books = await fetchLibraryBooks(libraryId, token, "subject", 200);
        const uniqueSubjects = new Set<string>();

        books.forEach((book) => {
            splitSubjects(book.subject).forEach((subject) => {
                uniqueSubjects.add(subject);
            });
        });

        return Array.from(uniqueSubjects);
    }
}

/**
 * Lista livros por assunto exato (split por vírgula) na biblioteca.
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
        `/libraries_books_by_subject?library=${libraryId}&subject=${encodeURIComponent(subject)}&limit=20`;

    try {
        const data = await api.get<unknown>(endpoint, token);
        return normalizeBooksResponse(data);
    } catch (error) {
        if (!isNotFoundError(error)) {
            throw error;
        }

        const normalizedTarget = subject.trim().toLowerCase();
        const books = await fetchLibraryBooks(
            libraryId,
            token,
            `${DEFAULT_BOOK_FIELDS},subject`,
            200
        );

        return books
            .filter((book) =>
                splitSubjects(book.subject).some(
                    (item) => item.trim().toLowerCase() === normalizedTarget
                )
            )
            .slice(0, 20);
    }
}

/**
 * Registra um acesso ao livro (clique em "Ler agora").
 *
 * @param id ID do livro acessado.
 * @param token Token JWT opcional.
 * @returns Promise<void>.
 */
export async function registerBookAccess(id: string, token?: string): Promise<void> {
    await api.post(`/books/${encodeURIComponent(id)}/access`, {}, token);
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
        throw new Error("Falha ao realizar empréstimo do livro.");
    }

    const disposition = response.headers.get("Content-Disposition");
    let filename = disposition?.split(";")[1]?.trim().split("=")[1];
    filename = filename ? filename : "book.lcpl";
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
