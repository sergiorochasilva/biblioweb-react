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
    title_variant?: string;
    author?: string;
    authors?: BookAuthorLink[];
    publisher: string;
    publication_place?: string;
    dewey_decimal?: string;
    type?: string;
    external_url?: string;
    external_source?: string;
    file_name?: string;
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
    access_count?: number;
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
