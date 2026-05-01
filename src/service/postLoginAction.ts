import { lendBook } from "./BookService";
import { getErrorMessage } from "./errorMessage";

export type PendingLendAction = {
    type: "lend";
    bookId: string;
    libraryId: number;
    returnTo: string;
};

const PENDING_ACTION_KEY = "pending_post_login_action";

/**
 * Persiste uma ação de empréstimo para execução após autenticação.
 *
 * @param action Dados da ação pendente.
 * @returns void
 */
export function savePendingLendAction(action: PendingLendAction) {
    sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
}

/**
 * Recupera a ação pendente de empréstimo, quando existir.
 *
 * @returns PendingLendAction | null
 */
export function getPendingLendAction(): PendingLendAction | null {
    const rawValue = sessionStorage.getItem(PENDING_ACTION_KEY);
    if (!rawValue) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawValue) as PendingLendAction;
        if (parsed?.type !== "lend") {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Remove a ação pendente de empréstimo armazenada na sessão.
 *
 * @returns void
 */
export function clearPendingLendAction() {
    sessionStorage.removeItem(PENDING_ACTION_KEY);
}

/**
 * Executa o empréstimo pendente após o login e redireciona para a tela de origem.
 *
 * @param accessToken Token de acesso recém-obtido.
 * @param navigate Função de navegação da rota atual.
 * @param onError Callback opcional para exibir falhas no empréstimo.
 * @returns `true` quando havia ação pendente e ela foi encaminhada.
 */
export async function handlePendingLendActionAfterLogin(
    accessToken: string,
    navigate: (path: string) => void,
    onError?: (message: string) => void
): Promise<boolean> {
    const pendingLendAction = getPendingLendAction();
    if (!pendingLendAction) {
        return false;
    }

    clearPendingLendAction();
    navigate(pendingLendAction.returnTo);

    // Deixa a rota renderizar antes de disparar o download licenciado.
    setTimeout(async () => {
        try {
            await lendBook(
                pendingLendAction.bookId,
                pendingLendAction.libraryId,
                accessToken
            );
        } catch (error: unknown) {
            onError?.(getErrorMessage(error, "Não foi possível finalizar o empréstimo."));
        }
    }, 0);

    return true;
}
