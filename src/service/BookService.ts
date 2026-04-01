import { Book } from "../model/Book";
import { api, API_BASE_URL, buildAuthHeaders } from "./api";

export const DEFAULT_PUBLIC_LIBRARY_ID = 1;
const DEFAULT_BOOK_FIELDS = "review,type,external_url,file_name";

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
 * Busca detalhes de um livro por ID.
 *
 * @param id ID do livro.
 * @param libraryId ID da biblioteca usada na consulta.
 * @param token Token JWT opcional para cenários autenticados.
 * @returns Livro encontrado ou null quando não existir na resposta.
 */
export async function fetchBookDetails(
    id: string,
    libraryId: number,
    token?: string
): Promise<Book | null> {
    const allBooks = await fetchRecentPublications(libraryId, token);
    const book = allBooks.find((b) => String(b.id) === String(id));
    return book || null;
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
