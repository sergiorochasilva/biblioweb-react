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
