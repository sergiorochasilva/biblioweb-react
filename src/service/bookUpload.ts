/** Limite máximo do arquivo original enviado no cadastro de livros. */
export const BOOK_UPLOAD_MAX_FILE_BYTES = 100 * 1024 * 1024;

/** Rótulo apresentado no formulário para o limite de envio. */
export const BOOK_UPLOAD_MAX_FILE_SIZE_LABEL = "100 MB";

/**
 * Garante que um arquivo selecionado cabe no limite de cadastro.
 *
 * @param file Arquivo selecionado pelo usuário.
 * @returns void.
 * @throws Error quando o arquivo excede 100 MB.
 */
export function validateBookUploadFileSize(file: File): void {
    if (file.size > BOOK_UPLOAD_MAX_FILE_BYTES) {
        throw new Error(
            `O arquivo não pode exceder ${BOOK_UPLOAD_MAX_FILE_SIZE_LABEL}.`
        );
    }
}
