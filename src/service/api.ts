/**
 * Resolve o host base da API considerando o ambiente atual do navegador.
 *
 * Quando a aplicação roda em `localhost`, prioriza a API local do devcontainer
 * para evitar CORS desnecessário. Fora disso, usa a URL configurada em ambiente.
 *
 * @returns Host base sem barra final.
 */
function resolveApiHost(): string {
    const configuredHost = (
        import.meta.env.VITE_API_BASE_URL || "https://biblioweb.online:8080"
    ).trim();
    const currentHostname = window.location.hostname;

    if (currentHostname === "localhost" || currentHostname === "127.0.0.1") {
        return "http://localhost:15000";
    }

    return configuredHost;
}

const API_HOST = resolveApiHost().replace(/\/+$/, "");

export const API_BASE_URL = API_HOST;
export type ApiError = Error & { status?: number; body?: unknown };

/**
 * Extrai uma mensagem legível de corpos de erro retornados pela API.
 *
 * @param body Corpo bruto retornado pelo backend.
 * @returns Mensagem legível ou `null` quando não houver texto útil.
 */
function extractErrorMessage(body: unknown): string | null {
    if (typeof body === "string") {
        const trimmed = body.trim();
        return trimmed || null;
    }

    if (Array.isArray(body)) {
        const messages = body
            .map((item) => {
                if (!item || typeof item !== "object") {
                    return "";
                }

                const message = (item as { message?: unknown }).message;
                return typeof message === "string" ? message.trim() : "";
            })
            .filter(Boolean);

        if (messages.length > 0) {
            return messages.join(" ");
        }
    }

    if (body && typeof body === "object") {
        const message = (body as { message?: unknown }).message;
        if (typeof message === "string") {
            const trimmed = message.trim();
            return trimmed || null;
        }
    }

    return null;
}

/**
 * Monta headers padrão para chamadas HTTP da aplicação.
 *
 * @param token Token JWT opcional para autenticação Bearer.
 * @param withJson Define se deve incluir Content-Type JSON.
 * @returns Objeto HeadersInit com Accept e, opcionalmente, Authorization/Content-Type.
 */
function buildHeaders(token?: string, withJson = false): HeadersInit {
    const headers: HeadersInit = {
        Accept: "application/json",
    };

    if (withJson) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
}

/**
 * Normaliza respostas da API e converte erros HTTP em exceções.
 *
 * @param response Resposta bruta retornada pelo fetch.
 * @returns Payload JSON convertido para o tipo informado.
 * @throws Error Quando a resposta não é OK.
 */
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        let parsedBody: unknown = null;
        let message = `API Error: ${response.status} ${response.statusText}`;

        try {
            const rawBody = await response.text();
            parsedBody = rawBody.trim() ? JSON.parse(rawBody) : null;
        } catch {
            parsedBody = null;
        }

        if (
            parsedBody &&
            typeof parsedBody === "object" &&
            "message" in parsedBody &&
            typeof (parsedBody as { message?: unknown }).message === "string"
        ) {
            const parsedMessage = extractErrorMessage(parsedBody);
            if (parsedMessage) {
                message = parsedMessage;
            }
        } else {
            const parsedMessage = extractErrorMessage(parsedBody);
            if (parsedMessage) {
                message = parsedMessage;
            }
        }

        const apiError = new Error(message) as ApiError;
        apiError.status = response.status;
        apiError.body = parsedBody;
        throw apiError;
    }

    if (response.status === 204) {
        return {} as T;
    }

    const rawBody = await response.text();
    if (!rawBody.trim()) {
        return {} as T;
    }

    try {
        return JSON.parse(rawBody) as T;
    } catch {
        return rawBody as T;
    }
}

export const api = {
    /**
     * Executa requisição GET.
     *
     * @param endpoint Caminho relativo da API.
     * @param token Token JWT opcional.
     * @returns Payload tipado da resposta.
     */
    get: async <T>(endpoint: string, token?: string): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "GET",
            headers: buildHeaders(token),
        });

        return handleResponse<T>(response);
    },

    /**
     * Executa requisição POST com corpo JSON.
     *
     * @param endpoint Caminho relativo da API.
     * @param body Payload enviado no corpo.
     * @param token Token JWT opcional.
     * @returns Payload tipado da resposta.
     */
    post: async <T>(endpoint: string, body: unknown, token?: string): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: buildHeaders(token, true),
            body: JSON.stringify(body),
        });

        return handleResponse<T>(response);
    },

    /**
     * Executa requisição PUT com corpo JSON.
     *
     * @param endpoint Caminho relativo da API.
     * @param body Payload enviado no corpo.
     * @param token Token JWT opcional.
     * @returns Payload tipado da resposta.
     */
    put: async <T>(endpoint: string, body: unknown, token?: string): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "PUT",
            headers: buildHeaders(token, true),
            body: JSON.stringify(body),
        });

        return handleResponse<T>(response);
    },

    /**
     * Executa requisição PATCH com corpo JSON.
     *
     * @param endpoint Caminho relativo da API.
     * @param body Payload enviado no corpo.
     * @param token Token JWT opcional.
     * @returns Payload tipado da resposta.
     */
    patch: async <T>(endpoint: string, body: unknown, token?: string): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "PATCH",
            headers: buildHeaders(token, true),
            body: JSON.stringify(body),
        });

        return handleResponse<T>(response);
    },

    /**
     * Executa requisição DELETE.
     *
     * @param endpoint Caminho relativo da API.
     * @param token Token JWT opcional.
     * @returns Payload tipado da resposta.
     */
    delete: async <T>(endpoint: string, token?: string): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "DELETE",
            headers: buildHeaders(token),
        });

        return handleResponse<T>(response);
    },
};

/**
 * Wrapper público para montagem de headers de autenticação.
 *
 * @param token Token JWT opcional.
 * @param withJson Define se adiciona Content-Type JSON.
 * @returns Objeto de headers para requisições autenticadas.
 */
export function buildAuthHeaders(token?: string, withJson = false): HeadersInit {
    return buildHeaders(token, withJson);
}
