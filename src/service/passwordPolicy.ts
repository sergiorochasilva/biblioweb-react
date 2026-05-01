/**
 * Texto explicativo da política de senha forte usada pela aplicação.
 */
export const STRONG_PASSWORD_POLICY_TEXT =
    "A senha precisa ter no mínimo 12 caracteres e conter letras maiúsculas, minúsculas, números e símbolos.";

/**
 * Valida a política de senha forte usada pela aplicação.
 *
 * @param password Senha em texto puro.
 * @returns Mensagem de erro quando inválida ou ``null`` quando atende à regra.
 */
export function validateStrongPassword(password: string): string | null {
    if (password.length < 12) {
        return STRONG_PASSWORD_POLICY_TEXT;
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
        return STRONG_PASSWORD_POLICY_TEXT;
    }

    return null;
}
