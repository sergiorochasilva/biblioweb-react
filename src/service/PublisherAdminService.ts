import { Book } from "../model/Book";

export const DEFAULT_API_BASE_URL = "https://biblioweb.online:8080";

export type UpdateBookPayload = {
    title: string;
    publisher: string;
    author: string;
    subject: string;
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

export function buildHeaders(accessToken: string) {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (accessToken.trim() !== "") {
        headers["Authorization"] = `Bearer ${accessToken.trim()}`;
    }
    return headers;
}

export function normalizeBooksResponse(data: any): Book[] {
    if (Array.isArray(data)) {
        return data as Book[];
    }
    if (data && Array.isArray(data.result)) {
        return data.result as Book[];
    }
    return [];
}

export function getFileParts(file: File) {
    const nameParts = file.name.split(".");
    if (nameParts.length === 1) {
        return { fileName: file.name, fileExtension: "" };
    }
    const fileExtension = nameParts.pop() || "";
    const fileName = nameParts.join(".");
    return { fileName, fileExtension };
}

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

export async function sha256Hex(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fetchBooks(apiBaseUrl: string, accessToken: string): Promise<Book[]> {
    const response = await fetch(`${apiBaseUrl}/books`, {
        headers: buildHeaders(accessToken),
    });
    if (!response.ok) {
        throw new Error(`Erro ao buscar livros (${response.status}).`);
    }
    const data = await response.json();
    return normalizeBooksResponse(data);
}

export async function updateBook(
    apiBaseUrl: string,
    accessToken: string,
    id: string,
    payload: UpdateBookPayload
): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/books/${id}`, {
        method: "PUT",
        headers: buildHeaders(accessToken),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Erro ao atualizar livro (${response.status}).`);
    }
}

export async function createBook(
    apiBaseUrl: string,
    accessToken: string,
    payload: CreateBookPayload
): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/books`, {
        method: "POST",
        headers: buildHeaders(accessToken),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Erro ao cadastrar livro (${response.status}).`);
    }
}

export async function generatePurchaseLink(
    apiBaseUrl: string,
    accessToken: string,
    payload: PurchaseLinkPayload
): Promise<PurchaseLinkResponse> {
    const response = await fetch(`${apiBaseUrl}/books-purchase-links`, {
        method: "POST",
        headers: buildHeaders(accessToken),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Erro ao gerar link (${response.status}).`);
    }
    return response.json();
}
