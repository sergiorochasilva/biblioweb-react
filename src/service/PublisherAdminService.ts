import { Book } from "../model/Book";
import { api } from "./api";

export type UpdateBookPayload = {
    title: string;
    publisher: string;
    author: string;
    subject: string;
    type?: string;
    external_url?: string;
    file_name: string;
    image_url: string;
    edition: string;
    year: string;
    isbn: string;
    pages: string;
    language: string;
    review: string;
};

export type CreateBookPayload = UpdateBookPayload & {
    library?: number;
    base64_content: string;
    file_extension: string;
};

export type PurchaseLinkPayload = {
    publisher: string;
    book_id: string;
    user_email: string;
    pass_hint: string;
    pass_hash: string;
};

export type PurchaseLinkResponse = {
    purchase_link: string;
};

/**
 * Normaliza respostas da API de livros para uma lista simples.
 *
 * @param data Payload bruto retornado pela API.
 * @returns Lista de livros.
 */
export function normalizeBooksResponse(data: any): Book[] {
    if (Array.isArray(data)) {
        return data as Book[];
    }
    if (data && Array.isArray(data.result)) {
        return data.result as Book[];
    }
    return [];
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
 * Busca livros administrativos da editora.
 *
 * @param token Token JWT do usuário autenticado.
 * @returns Lista de livros.
 */
export async function fetchBooks(token: string): Promise<Book[]> {
    const data = await api.get<any>("/books", token);
    return normalizeBooksResponse(data);
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
