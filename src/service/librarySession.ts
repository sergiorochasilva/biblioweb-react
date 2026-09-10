import type { Library, ProfileData } from "../types";

/**
 * Retorna a lista de acervos elegíveis preservando apenas registros válidos.
 *
 * @param profile Perfil autenticado carregado da API.
 * @returns Acervos com id positivo e nome disponível.
 */
export function getEligibleLibraries(profile: ProfileData | null): Library[] {
    if (!Array.isArray(profile?.libraries)) {
        return [];
    }

    return profile.libraries.filter(
        (library): library is Library =>
            Number.isInteger(library?.id) && library.id > 0 && Boolean(library.name?.trim())
    );
}

/**
 * Confirma se uma seleção persistida ainda pertence ao perfil atual.
 *
 * @param library Biblioteca persistida no navegador.
 * @param profile Perfil recém-carregado da API.
 * @returns Biblioteca canônica do perfil ou ``null`` quando inválida.
 */
export function validateStoredLibrary(
    library: Library | null,
    profile: ProfileData | null
): Library | null {
    if (!library || !Number.isInteger(library.id) || library.id <= 0) {
        return null;
    }

    return getEligibleLibraries(profile).find((item) => item.id === library.id) ?? null;
}

/**
 * Aceita apenas caminhos internos seguros para o retorno pós-login.
 *
 * @param nextPath Caminho informado pela query string.
 * @returns Caminho interno ou ``null`` quando inválido.
 */
export function sanitizeNextPath(nextPath: string | null): string | null {
    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
        return null;
    }
    return nextPath;
}
