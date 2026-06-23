import type { BookLibraryLink } from "./BookLibrary";

export interface BookSubjectLink {
    id?: number;
    subject: number;
    subject_name?: string;
}

export interface BookAuthorLink {
    id?: number;
    author: number;
    author_name?: string;
}

export interface Book {
    id: string;
    title: string;
    subtitle?: string;
    original_title?: string;
    corporate_author?: string;
    author?: string;
    authors?: BookAuthorLink[];
    publisher: string;
    publication_place?: string;
    dewey_decimal?: string;
    type?: string;
    external_url?: string;
    external_source?: string;
    html_version_url?: string;
    file_name?: string;
    active?: boolean;
    edition: string;
    year: string;
    isbn: string;
    pages: string;
    language: string;
    summary?: string;
    general_note?: string;
    bibliography_note?: string;
    content_type?: string;
    media_type?: string;
    carrier_type?: string;
    subjects?: BookSubjectLink[];
    image_url?: string | null;
    library?: number;
    libraries?: BookLibraryLink[];
    preco_sugerido?: number | string | null;
    preco_compra?: number | string | null;
    access_count?: number;
    available_licenses?: number;
    max_uses_per_license?: number;
    license_uses_count?: number;
    loan_state?: string;
    loan_expires_at?: string;
    last_access_at?: string;
    current_book_active_licenses?: number;
    current_user_active_loans?: number;
    max_concurrent_loans?: number;
    unavailable_users_count?: number;
    purchased_by_user?: boolean;
    purchase_license_id?: string;
    purchase_issued_at?: string;
    loan_started_at?: string;
    loan_license_id?: string;
}

/**
 * Resolve um texto amigável de autores, priorizando o relacionamento.
 *
 * @param book Livro com autor legado opcional e/ou lista relacional.
 * @returns Texto de autores separado por vírgula.
 */
export function getBookAuthorsText(book: Pick<Book, "author" | "authors">): string {
    const relationalAuthors = Array.isArray(book.authors)
        ? book.authors
              .map((item) =>
                  typeof item?.author_name === "string" ? item.author_name.trim() : ""
              )
              .filter((item) => Boolean(item))
        : [];

    if (relationalAuthors.length > 0) {
        return relationalAuthors.join(", ");
    }

    const legacyAuthor = typeof book.author === "string" ? book.author.trim() : "";
    return legacyAuthor || "";
}
