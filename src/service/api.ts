const API_HOST = (
    import.meta.env.VITE_API_BASE_URL || "https://biblioweb.online:8080"
).replace(/\/+$/, "");

export const API_BASE_URL = API_HOST;

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
        try {
            const errorBody = await response.json();
            throw new Error(errorBody.message || `API Error: ${response.statusText}`);
        } catch (e) {
            throw new Error(`API Error: ${response.statusText}`);
        }
    }

    if (response.status === 204 || response.status === 202) {
        return {} as T;
    }

    return response.json();
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
    post: async <T>(endpoint: string, body: any, token?: string): Promise<T> => {
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
    put: async <T>(endpoint: string, body: any, token?: string): Promise<T> => {
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
    patch: async <T>(endpoint: string, body: any, token?: string): Promise<T> => {
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
