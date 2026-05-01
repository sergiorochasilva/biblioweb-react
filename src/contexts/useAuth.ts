import { useContext } from "react";
import { AuthContext } from "./authContext";

/**
 * Hook de acesso ao contexto de autenticação.
 *
 * @returns Objeto com estado e ações de autenticação.
 * @throws Error Quando utilizado fora de `AuthProvider`.
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
