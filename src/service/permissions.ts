import type { ProfileData, Publisher } from "../types";

/**
 * Converte flags heterogêneas de payload (boolean/number/string) para boolean.
 *
 * @param value Valor bruto da flag.
 * @returns ``true`` quando o valor representa ligado.
 */
function normalizeFlag(value: unknown): boolean {
    if (value === true || value === 1 || value === "1") {
        return true;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "yes" || normalized === "sim";
    }

    return false;
}

/**
 * Verifica se o usuário é administrador global a partir do profile.
 *
 * @param profile Dados do profile autenticado.
 * @returns ``true`` quando perfil é admin global.
 */
export function hasGlobalAdminPermission(profile: ProfileData | null): boolean {
    if (!profile) {
        return false;
    }

    const roleValue = profile.role ?? profile.profile ?? profile.user_role;
    if (typeof roleValue === "string" && roleValue.trim().toLowerCase() === "admin") {
        return true;
    }

    return (
        normalizeFlag(profile.admin) ||
        normalizeFlag(profile.is_admin) ||
        normalizeFlag(profile.isAdmin)
    );
}

/**
 * Filtra editoras em que o usuário possui permissão administrativa.
 *
 * @param profile Dados do profile autenticado.
 * @returns Lista de editoras administráveis.
 */
export function getPublisherAdminPublishers(profile: ProfileData | null): Publisher[] {
    const publishers = Array.isArray(profile?.publishers) ? profile!.publishers : [];
    return publishers.filter((publisher) => normalizeFlag(publisher.admin));
}

/**
 * Verifica se o usuário possui ao menos uma editora com permissão admin.
 *
 * @param profile Dados do profile autenticado.
 * @returns ``true`` quando houver permissão administrativa em editora.
 */
export function hasPublisherAdminPermission(profile: ProfileData | null): boolean {
    return getPublisherAdminPublishers(profile).length > 0;
}

