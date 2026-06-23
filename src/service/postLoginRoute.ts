import { api } from "./api";
import {
    hasGlobalAdminPermission,
    hasPublisherAdminPermission,
} from "./permissions";
import type { Library, ProfileData, Publisher } from "../types";

type SessionUpdaters = {
    setProfile: (profile: ProfileData | null) => void;
    setPublisher: (publisher: Publisher | null) => void;
    setLibrary: (library: Library | null) => void;
};

/**
 * Resolve a rota inicial após autenticação, respeitando o contexto do perfil.
 *
 * @param profile Profile carregado logo após o login.
 * @param nextPath Caminho de retorno solicitado na navegação anterior.
 * @returns Rota final sugerida para a sessão.
 */
export function resolvePostLoginRoute(
    profile: ProfileData | null,
    nextPath: string | null
): string {
    const libraries = Array.isArray(profile?.libraries) ? profile?.libraries ?? [] : [];
    const libraryCount = libraries.length;
    if (libraryCount <= 0) {
        if (hasGlobalAdminPermission(profile)) {
            return "/admin";
        }

        if (hasPublisherAdminPermission(profile)) {
            return "/publisher-admin";
        }

        return "/profile";
    }

    if (nextPath) {
        return nextPath;
    }

    return "/selection";
}

/**
 * Carrega o profile do usuário recém-autenticado e limpa seleção anterior.
 *
 * @param accessToken Token recém-obtido no login.
 * @param updaters Callbacks para sincronizar o contexto local da sessão.
 * @returns Profile carregado da API.
 */
export async function loadProfileAfterLogin(
    accessToken: string,
    updaters: SessionUpdaters
): Promise<ProfileData> {
    const profile = await api.get<ProfileData>("/profile", accessToken);
    updaters.setProfile(profile);
    updaters.setPublisher(null);
    updaters.setLibrary(null);
    return profile;
}

/**
 * Carrega o profile e devolve a rota de destino pós-login.
 *
 * @param accessToken Token recém-obtido no login.
 * @param updaters Callbacks para sincronizar o contexto local da sessão.
 * @param nextPath Caminho de retorno solicitado na navegação anterior.
 * @returns Rota final sugerida para a sessão.
 */
export async function resolveLandingAfterLogin(
    accessToken: string,
    updaters: SessionUpdaters,
    nextPath: string | null
): Promise<string> {
    const profile = await loadProfileAfterLogin(accessToken, updaters);
    return resolvePostLoginRoute(profile, nextPath);
}
