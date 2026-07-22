import { API_BASE_URL, api, buildAuthHeaders } from "./api";
import type { Book } from "../model/Book";

export type ChatActionType =
    | "open_route"
    | "open_book"
    | "open_profile"
    | "open_my_books";

export interface ChatActionPayload {
    type: ChatActionType;
    label: string;
    route?: string | null;
    params?: Record<string, unknown>;
    book_id?: string | null;
    target?: string | null;
}

export interface ChatBookPayload {
    book_id: string;
    title: string;
    publisher?: string | null;
    authors?: string | null;
    summary?: string | null;
    image_url?: string | null;
    type?: string | null;
    score?: number;
    source?: string;
    chunk_number?: number | null;
    total_chunks?: number | null;
    excerpt?: string | null;
    context_excerpt?: string | null;
    action?: ChatActionPayload | null;
}

export interface ChatTurnPayload {
    text: string;
    actions: ChatActionPayload[];
    books: ChatBookPayload[];
    provider?: string;
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    tool_names?: string[];
}

export interface ChatMessageRecord {
    id: string;
    conversation_id: string;
    role: "user" | "assistant";
    message_type: string;
    content?: string | null;
    payload?: ChatTurnPayload | Record<string, unknown> | null;
    tool_name?: string | null;
    provider?: string | null;
    model?: string | null;
    status?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ChatConversationRecord {
    id: string;
    user_email?: string | null;
    client_key?: string | null;
    anonymous?: boolean;
    library?: number | null;
    title?: string | null;
    summary?: string | null;
    status?: string | null;
    total_tokens?: number;
    daily_tokens?: number;
    created_at?: string;
    updated_at?: string;
    messages?: ChatMessageRecord[];
}

export interface ChatConversationPage {
    next: string | null;
    result: ChatConversationRecord[];
}

export interface ChatSubmitRequest {
    message: string;
    conversation_id?: string | null;
    client_key?: string;
    library?: number;
    source?: string;
    initial_context?: Record<string, unknown>;
}

export interface ChatSubmitResponse {
    conversation_id: string;
    message_id: string;
    queued: boolean;
    job_id?: string | null;
    event_stream_url: string;
    current_status: string;
}

export interface ChatSseEvent {
    id?: string;
    conversation_id?: string;
    message_type?: string;
    event?: string;
    tool?: string | null;
    role?: string;
    content?: string | null;
    payload?: ChatTurnPayload | Record<string, unknown> | null;
    tool_name?: string | null;
    status?: string | null;
    created_at?: string;
    updated_at?: string;
}

function normalizeConversationPage(data: unknown): ChatConversationPage {
    if (Array.isArray(data)) {
        return { next: null, result: data as ChatConversationRecord[] };
    }
    if (
        data &&
        typeof data === "object" &&
        "result" in data &&
        Array.isArray((data as { result?: unknown }).result)
    ) {
        const payload = data as { next?: unknown; result: ChatConversationRecord[] };
        return {
            next: typeof payload.next === "string" && payload.next ? payload.next : null,
            result: payload.result,
        };
    }
    return { next: null, result: [] };
}

/**
 * Cria uma conversa e enfileira a mensagem do usuário.
 *
 * @param payload Dados da mensagem inicial.
 * @param token Token JWT opcional.
 * @returns Resposta com conversation_id e URL do SSE.
 */
export async function submitChatMessage(
    payload: ChatSubmitRequest,
    token?: string
): Promise<ChatSubmitResponse> {
    return api.post<ChatSubmitResponse>("/chat/conversations", payload, token);
}

/**
 * Recupera a primeira página de conversas do usuário atual ou da chave local.
 *
 * @param clientKey Chave estável da conversa anônima.
 * @param token Token JWT opcional.
 * @param limit Quantidade máxima de itens por página.
 * @returns Página com lista e link `next`.
 */
export async function fetchChatConversationsPage(
    clientKey: string,
    token?: string,
    limit = 20
): Promise<ChatConversationPage> {
    const query = new URLSearchParams();
    if (clientKey) {
        query.set("client_key", clientKey);
    }
    query.set("limit", String(limit > 0 ? limit : 20));
    const data = await api.get<unknown>(
        `/chat/conversations${query.toString() ? `?${query.toString()}` : ""}`,
        token
    );
    return normalizeConversationPage(data);
}

/**
 * Recupera uma página adicional de conversas a partir do link `next`.
 *
 * @param nextUrl URL retornada pela API.
 * @param token Token JWT opcional.
 * @returns Página com lista e link `next`.
 */
export async function fetchChatConversationsPageByUrl(
    nextUrl: string,
    token?: string
): Promise<ChatConversationPage> {
    const response = await fetch(new URL(nextUrl, API_BASE_URL).toString(), {
        method: "GET",
        headers: buildAuthHeaders(token),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `API Error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;
    return normalizeConversationPage(data);
}

/**
 * Recupera uma conversa com suas mensagens.
 *
 * @param conversationId Identificador da conversa.
 * @param token Token JWT opcional.
 * @returns Conversa carregada do backend.
 */
export async function fetchChatConversation(
    conversationId: string,
    token?: string
): Promise<ChatConversationRecord> {
    return api.get<ChatConversationRecord>(`/chat/conversations/${conversationId}`, token);
}

/**
 * Abre o stream SSE de uma conversa.
 *
 * @param conversationId Identificador da conversa.
 * @param clientKey Chave local anônima, quando necessário.
 * @param onEvent Callback para cada evento recebido.
 * @returns Instância de EventSource.
 */
export function openChatConversationStream(
    conversationId: string,
    clientKey: string,
    onEvent: (event: ChatSseEvent) => void
): EventSource {
    const streamUrl = new URL(`/chat/conversations/${conversationId}/events`, API_BASE_URL);
    if (clientKey) {
        streamUrl.searchParams.set("client_key", clientKey);
    }

    const eventSource = new EventSource(streamUrl.toString());
    let finished = false;
    const handleMessage = (event: MessageEvent<string>) => {
        try {
            const parsed = JSON.parse(event.data) as ChatSseEvent;
            if (parsed.message_type === "done" || parsed.event === "done") {
                finished = true;
            }
            onEvent(parsed);
        } catch (error) {
            console.error("Failed to parse chat SSE event", error);
        }
    };

    eventSource.addEventListener("user", handleMessage as EventListener);
    eventSource.addEventListener("assistant", handleMessage as EventListener);
    eventSource.addEventListener("status", handleMessage as EventListener);
    eventSource.addEventListener("tool_start", handleMessage as EventListener);
    eventSource.addEventListener("tool_result", handleMessage as EventListener);
    eventSource.addEventListener("action", handleMessage as EventListener);
    eventSource.addEventListener("done", handleMessage as EventListener);
    eventSource.addEventListener("message", handleMessage as EventListener);
    eventSource.onerror = (error) => {
        if (finished || eventSource.readyState === EventSource.CLOSED) {
            return;
        }
        console.error("Chat SSE error", error);
    };
    return eventSource;
}

/**
 * Converte um payload de livro do chat em um livro compatível com o componente visual.
 *
 * @param payload Livro retornado pelo chatbot.
 * @returns Livro no formato usado pelo card.
 */
export function toBookCardModel(payload: ChatBookPayload): Book {
    return {
        id: payload.book_id,
        title: payload.title,
        publisher: payload.publisher || "",
        authors: payload.authors
            ? payload.authors.split(",").map((author) => ({ author: 0, author_name: author.trim() }))
            : [],
        author: payload.authors || "",
        type: payload.type || "external",
        edition: "",
        year: "",
        isbn: "",
        pages: "",
        language: "",
        summary: payload.summary || payload.excerpt || payload.context_excerpt || "",
        image_url: payload.image_url || undefined,
    };
}
