/**
 * Extrai uma mensagem legível a partir de qualquer valor de erro.
 *
 * @param error Valor capturado em `catch`.
 * @param fallback Mensagem padrão quando não houver detalhe útil.
 * @returns Mensagem pronta para exibição ao usuário.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (typeof error === "string" && error.trim()) {
        return error.trim();
    }

    return fallback;
}
