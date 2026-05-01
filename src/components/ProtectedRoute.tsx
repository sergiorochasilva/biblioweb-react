import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";

/**
 * Guarda de rota que exige autenticação.
 *
 * @returns Outlet da rota protegida quando autenticado, ou redirecionamento
 * para login com parâmetro ``next`` para retorno pós-login.
 */
export default function ProtectedRoute() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        const nextPath = `${location.pathname}${location.search}`;
        return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
    }

    return <Outlet />;
}
