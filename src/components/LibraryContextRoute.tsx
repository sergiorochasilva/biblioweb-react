import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { getEligibleLibraries, validateStoredLibrary } from "../service/librarySession";

/**
 * Guarda rotas de leitor que exigem um acervo autenticado e válido.
 *
 * @returns Conteúdo protegido ou redirecionamento para a seleção de acervo.
 */
export default function LibraryContextRoute() {
    const location = useLocation();
    const { profile, library } = useAuth();
    const hasSelectedLibrary = Boolean(validateStoredLibrary(library, profile));
    const hasEligibleLibrary = getEligibleLibraries(profile).length > 0;

    if (hasSelectedLibrary) {
        return <Outlet />;
    }

    const nextPath = `${location.pathname}${location.search}`;
    if (!hasEligibleLibrary && profile) {
        return location.pathname === "/profile" ? <Outlet /> : <Navigate to="/profile" replace />;
    }
    return <Navigate to={`/selection?next=${encodeURIComponent(nextPath)}`} replace />;
}
