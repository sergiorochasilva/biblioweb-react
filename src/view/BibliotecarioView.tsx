import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Empty, Input, Layout, List, Spin, Tag, Typography, message } from "antd";
import HeaderView from "./HeaderView";
import "../styles/BibliotecarioView.css";
import { useAuth } from "../contexts/useAuth";
import { type ApiError } from "../service/api";
import {
    fetchChatConversation,
    fetchChatConversationsPage,
    fetchChatConversationsPageByUrl,
    openChatConversationStream,
    submitChatMessage,
    type ChatConversationRecord,
    type ChatMessageRecord,
    type ChatSseEvent,
    type ChatTurnPayload,
} from "../service/ChatService";
import ChatResponseRenderer from "../components/ChatResponseRenderer";

const CHAT_CLIENT_KEY_STORAGE = "biblioweb.chat.client_key";

function getOrCreateClientKey(): string {
    const saved = localStorage.getItem(CHAT_CLIENT_KEY_STORAGE);
    if (saved) {
        return saved;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(CHAT_CLIENT_KEY_STORAGE, created);
    return created;
}

function isAssistantMessage(message: ChatMessageRecord): boolean {
    return message.role === "assistant" && message.message_type === "assistant";
}

function isUserMessage(message: ChatMessageRecord): boolean {
    return message.role === "user" && message.message_type === "user";
}

/**
 * Converte o status interno da conversa para uma tag em português.
 *
 * @param status Status retornado pela API.
 * @returns Texto curto para exibição no histórico.
 */
function getConversationStatusLabel(status?: string | null): string {
    const normalized = String(status || "").trim().toLowerCase();
    const labels: Record<string, string> = {
        done: "Concluída",
        queued: "Em fila...",
        open: "Aberta",
        error: "Erro",
        running: "Analisando...",
    };
    return labels[normalized] || "Aberta";
}

/**
 * Define a cor visual da tag de status da conversa.
 *
 * @param status Status retornado pela API.
 * @returns Nome de cor aceito pelo Ant Design.
 */
function getConversationStatusColor(status?: string | null): string {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "done") {
        return "green";
    }
    if (normalized === "error") {
        return "red";
    }
    if (normalized === "queued" || normalized === "running") {
        return "blue";
    }
    return "default";
}

/**
 * Converte status de execução em texto de espera, sem tratar o status da
 * conversa como se fosse uma etapa de processamento da resposta.
 *
 * @param status Texto recebido do backend ou do estado local.
 * @returns Texto de execução ou `null` quando o valor pertence à conversa.
 */
function getLoadingStatusLabel(status?: string | null): string | null {
    const normalized = String(status || "").trim();
    const technicalStatus = normalized.toLowerCase();
    if (!normalized) {
        return "Analisando...";
    }
    if (technicalStatus === "queued") {
        return "Em fila...";
    }
    if (technicalStatus === "running") {
        return "Analisando...";
    }
    if (technicalStatus === "open" || technicalStatus === "done") {
        return null;
    }
    return normalized;
}

/**
 * Extrai mensagens legíveis de um erro HTTP do backend.
 *
 * @param body Corpo bruto retornado pela API.
 * @returns Lista de mensagens legíveis.
 */
function extractApiErrorMessages(body: unknown): string[] {
    if (typeof body === "string") {
        return body.trim() ? [body.trim()] : [];
    }

    if (Array.isArray(body)) {
        return body
            .map((item) => {
                if (!item || typeof item !== "object") {
                    return "";
                }

                const message = (item as { message?: unknown }).message;
                return typeof message === "string" ? message.trim() : "";
            })
            .filter((message) => Boolean(message));
    }

    if (body && typeof body === "object") {
        const message = (body as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) {
            return [message.trim()];
        }
    }

    return [];
}

/**
 * Normaliza a mensagem exibida quando o chat esbarra em limites de uso.
 *
 * @param error Erro retornado pela API.
 * @returns Mensagem pronta para o usuário.
 */
function getChatErrorMessage(error: unknown): string {
    const apiError = error as ApiError | null;
    const apiMessages = extractApiErrorMessages(apiError?.body);
    const fallbackMessages = [
        typeof apiError?.message === "string" ? apiError.message.trim() : "",
        ...apiMessages,
    ].filter(Boolean);

    const joinedMessage = fallbackMessages.join(" ").trim();
    if (/limite de tokens por dia/i.test(joinedMessage)) {
        return "Você atingiu o limite diário de uso do bibliotecário. Tente novamente amanhã ou abra uma nova conversa.";
    }

    if (/limite de tokens por conversa/i.test(joinedMessage)) {
        return "Você atingiu o limite desta conversa. Abra uma nova conversa para continuar.";
    }

    if (joinedMessage) {
        return joinedMessage;
    }

    return "Não foi possível enviar a mensagem. Tente novamente.";
}

/**
 * Mescla uma nova versão do histórico sem descartar mensagens mais recentes já
 * recebidas via SSE no estado local.
 *
 * @param previous Estado local atual.
 * @param incoming Snapshot retornado pela API.
 * @returns Lista mesclada preservando itens novos já presentes no estado.
 */
function mergeConversationMessages(
    previous: ChatMessageRecord[],
    incoming: ChatMessageRecord[]
): ChatMessageRecord[] {
    const incomingIds = new Set(incoming.map((message) => message.id));
    const merged = [...incoming];
    previous.forEach((message) => {
        if (!incomingIds.has(message.id)) {
            merged.push(message);
        }
    });
    return merged;
}

/**
 * Verifica se o snapshot contém uma resposta final depois da mensagem atual.
 *
 * @param conversation Conversa retornada pela API.
 * @param userMessageId Identificador da mensagem que iniciou a rodada atual.
 * @returns Verdadeiro quando a rodada pode ser considerada encerrada.
 */
function hasFinalConversationMessage(conversation: ChatConversationRecord, userMessageId: string): boolean {
    const nextMessages = conversation.messages || [];
    const userMessageIndex = nextMessages.findIndex((messageItem) => messageItem.id === userMessageId);
    if (userMessageIndex < 0) {
        return false;
    }

    return nextMessages.slice(userMessageIndex + 1).some(
        (messageItem) =>
            messageItem.role === "assistant" &&
            (messageItem.message_type === "assistant" ||
                messageItem.message_type === "done" ||
                messageItem.status === "error")
    );
}

/**
 * Identifica o encerramento artificial do SSE por limite de tempo.
 *
 * @param event Evento recebido do stream.
 * @returns Verdadeiro quando o backend encerrou o stream por timeout.
 */
function isStreamTimeoutEvent(event: ChatSseEvent): boolean {
    const payloadStatus =
        event.payload &&
        typeof event.payload === "object" &&
        "status" in event.payload &&
        typeof (event.payload as { status?: unknown }).status === "string"
            ? String((event.payload as { status: string }).status).trim().toLowerCase()
            : "";
    return String(event.status || payloadStatus).trim().toLowerCase() === "timeout";
}

export default function BibliotecarioView() {
    const { Content } = Layout;
    const navigate = useNavigate();
    const location = useLocation();
    const { getAccessToken, profile, library } = useAuth();
    const [clientKey] = useState(() => getOrCreateClientKey());
    const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
    const [conversationsNext, setConversationsNext] = useState<string | null>(null);
    const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
    const [loadingMessageId, setLoadingMessageId] = useState<string | null>(null);
    const [fallbackPollingConversationId, setFallbackPollingConversationId] = useState<string | null>(null);
    const [loadingLabel, setLoadingLabel] = useState("Analisando...");
    const [loadingConversation, setLoadingConversation] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);
    const messageStreamRef = useRef<HTMLDivElement | null>(null);
    const pendingAssistantScrollRef = useRef(false);
    const pendingUserScrollRef = useRef(false);
    const lastAutoScrolledAssistantIdRef = useRef<string | null>(null);
    const lastAutoScrolledUserIdRef = useRef<string | null>(null);
    const currentConversationIdRef = useRef<string | null>(null);
    const loadingConversationIdRef = useRef<string | null>(null);
    const loadingMessageIdRef = useRef<string | null>(null);
    const fallbackPollingConversationIdRef = useRef<string | null>(null);
    const loadingToolStartedAtRef = useRef<number | null>(null);
    const loadingLabelRef = useRef("Analisando...");
    const loadingDoneTimeoutRef = useRef<number | null>(null);
    const streamReconnectTimeoutRef = useRef<number | null>(null);
    const streamRecoveringRef = useRef(false);
    const autoSendRef = useRef(false);
    const previousConversationIdRef = useRef<string | null>(null);
    const [pendingAutoSendMessage, setPendingAutoSendMessage] = useState<string | null>(null);
    const queryMessage = new URLSearchParams(location.search).get("message") || "";
    const isCurrentConversationLoading = Boolean(
        loading && currentConversationId && loadingConversationId === currentConversationId
    );

    useEffect(() => {
        currentConversationIdRef.current = currentConversationId;
    }, [currentConversationId]);

    useEffect(() => {
        loadingConversationIdRef.current = loadingConversationId;
    }, [loadingConversationId]);

    useEffect(() => {
        loadingMessageIdRef.current = loadingMessageId;
    }, [loadingMessageId]);

    useEffect(() => {
        fallbackPollingConversationIdRef.current = fallbackPollingConversationId;
    }, [fallbackPollingConversationId]);

    /**
     * Limpa a conversa atual e prepara a tela para uma nova interação.
     *
     * @returns void
     */
    const resetCurrentConversation = (): void => {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        if (loadingDoneTimeoutRef.current) {
            window.clearTimeout(loadingDoneTimeoutRef.current);
            loadingDoneTimeoutRef.current = null;
        }
        if (streamReconnectTimeoutRef.current) {
            window.clearTimeout(streamReconnectTimeoutRef.current);
            streamReconnectTimeoutRef.current = null;
        }
        streamRecoveringRef.current = false;
        loadingToolStartedAtRef.current = null;
        setCurrentConversationId(null);
        setMessages([]);
        setLoading(false);
        setLoadingConversationId(null);
        setLoadingMessageId(null);
        loadingConversationIdRef.current = null;
        loadingMessageIdRef.current = null;
        fallbackPollingConversationIdRef.current = null;
        setFallbackPollingConversationId(null);
        loadingLabelRef.current = "Analisando...";
        setLoadingLabel("Analisando...");
    };

    /**
     * Carrega as conversas recentes do usuário ou da chave anônima.
     *
     * @returns Promise<void>
     */
    const loadConversations = useCallback(
        async (nextUrl?: string | null): Promise<void> => {
            const accessToken = await getAccessToken({ redirectOnFail: false });
            const page = nextUrl
                ? await fetchChatConversationsPageByUrl(nextUrl, accessToken || undefined)
                : await fetchChatConversationsPage(clientKey, accessToken || undefined, 20);
            setConversations((previous) => {
                if (!nextUrl) {
                    return page.result;
                }
                const merged = new Map<string, ChatConversationRecord>();
                previous.forEach((conversation) => {
                    merged.set(conversation.id, conversation);
                });
                page.result.forEach((conversation) => {
                    merged.set(conversation.id, conversation);
                });
                return Array.from(merged.values());
            });
            setConversationsNext(page.next);
        },
        [clientKey, getAccessToken]
    );

    /**
     * Carrega as conversas recentes do usuário ou da chave anônima.
     *
     * @returns Promise<void>
     */
    const refreshConversations = useCallback(async (): Promise<void> => {
        const accessToken = await getAccessToken({ redirectOnFail: false });
        const page = await fetchChatConversationsPage(clientKey, accessToken || undefined, 20);
        setConversations(page.result);
        setConversationsNext(page.next);
    }, [clientKey, getAccessToken]);

    /**
     * Carrega o histórico de uma conversa específica.
     *
     * @param conversationId Identificador da conversa.
     * @returns Promise<void>
     */
    const loadConversationHistory = useCallback(async (conversationId: string): Promise<void> => {
        setLoadingHistory(true);
        try {
            const accessToken = await getAccessToken({ redirectOnFail: false });
            const conversation = await fetchChatConversation(conversationId, accessToken || undefined);
            if (currentConversationIdRef.current !== conversationId) {
                return;
            }
            const nextMessages = conversation.messages || [];
            setMessages((previous) => {
                if (previous.length === 0) {
                    return nextMessages;
                }
                if (!previous.every((message) => message.conversation_id === conversationId)) {
                    return nextMessages;
                }
                return mergeConversationMessages(previous, nextMessages);
            });
        } finally {
            setLoadingHistory(false);
        }
    }, [getAccessToken]);

    /**
     * Sincroniza rapidamente o snapshot da conversa sem mostrar spinner global.
     *
     * @param conversationId Identificador da conversa.
     * @returns Promise<void>
     */
    const syncConversationSnapshot = useCallback(async (conversationId: string): Promise<void> => {
        const accessToken = await getAccessToken({ redirectOnFail: false });
        const conversation = await fetchChatConversation(conversationId, accessToken || undefined);
        if (currentConversationIdRef.current !== conversationId) {
            return;
        }
        const nextMessages = conversation.messages || [];
        setMessages((previous) => {
            if (previous.length === 0) {
                return nextMessages;
            }
            if (!previous.every((message) => message.conversation_id === conversationId)) {
                return nextMessages;
            }
            return mergeConversationMessages(previous, nextMessages);
        });
    }, [getAccessToken]);

    /**
     * Finaliza a análise atual, fechando o stream e recarregando a lista de conversas.
     *
     * @param conversationId Identificador da conversa em processamento.
     * @param delayMs Atraso opcional antes de encerrar o loading.
     * @returns void
     */
    const completeLoading = useCallback(
        (conversationId: string | null, delayMs = 0, errorText?: string): void => {
            const targetConversationId = conversationId || loadingConversationIdRef.current;
            if (targetConversationId && loadingConversationIdRef.current !== targetConversationId) {
                return;
            }
            if (loadingDoneTimeoutRef.current) {
                window.clearTimeout(loadingDoneTimeoutRef.current);
                loadingDoneTimeoutRef.current = null;
            }

            const finish = (): void => {
                if (targetConversationId && loadingConversationIdRef.current !== targetConversationId) {
                    return;
                }
                setLoading(false);
                setLoadingConversationId(null);
                setLoadingMessageId(null);
                loadingConversationIdRef.current = null;
                loadingMessageIdRef.current = null;
                fallbackPollingConversationIdRef.current = null;
                setFallbackPollingConversationId(null);
                loadingLabelRef.current = "Analisando...";
                setLoadingLabel("Analisando...");
                loadingToolStartedAtRef.current = null;
                eventSourceRef.current?.close();
                eventSourceRef.current = null;
                if (streamReconnectTimeoutRef.current) {
                    window.clearTimeout(streamReconnectTimeoutRef.current);
                    streamReconnectTimeoutRef.current = null;
                }
                streamRecoveringRef.current = false;
                loadingDoneTimeoutRef.current = null;
                if (errorText) {
                    message.error(errorText);
                }
                void refreshConversations();
            };

            if (delayMs > 0) {
                loadingDoneTimeoutRef.current = window.setTimeout(finish, delayMs);
                return;
            }

            finish();
        },
        [refreshConversations]
    );

    useEffect(() => {
        void refreshConversations();
    }, [refreshConversations, profile?.email]);

    useEffect(() => {
        if (queryMessage) {
            setPendingAutoSendMessage(queryMessage);
            autoSendRef.current = false;
            resetCurrentConversation();
            setInput(queryMessage);
            return;
        }

        if (!queryMessage) {
            setPendingAutoSendMessage(null);
            autoSendRef.current = false;
            setInput("");
            resetCurrentConversation();
        }
    }, [location.key, queryMessage]);

    useEffect(() => {
        previousConversationIdRef.current = currentConversationId;
        if (currentConversationId) {
            void loadConversationHistory(currentConversationId);
            if (
                loadingConversationIdRef.current === currentConversationId &&
                (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED)
            ) {
                void recoverConversationStream(currentConversationId);
            }
        } else {
            setMessages([]);
        }
    }, [currentConversationId, loadConversationHistory]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        return () => {
            eventSourceRef.current?.close();
            if (loadingDoneTimeoutRef.current) {
                window.clearTimeout(loadingDoneTimeoutRef.current);
            }
            if (streamReconnectTimeoutRef.current) {
                window.clearTimeout(streamReconnectTimeoutRef.current);
            }
        };
    }, []);

    /**
     * Atualiza o estado local com o evento vindo do SSE.
     *
     * @param event Evento emitido pelo backend.
     * @returns void
     */
    const applyStreamEvent = (event: ChatSseEvent): void => {
        const messageType = String(event.message_type || event.event || "");
        const eventConversationId = String(
            event.conversation_id || loadingConversationIdRef.current || currentConversationIdRef.current || ""
        );
        const isVisibleConversation =
            !eventConversationId || currentConversationIdRef.current === eventConversationId;
        if (eventConversationId && fallbackPollingConversationIdRef.current === eventConversationId) {
            fallbackPollingConversationIdRef.current = null;
            setFallbackPollingConversationId(null);
        }
        if (messageType === "status") {
            const payloadStatus =
                event.payload &&
                typeof event.payload === "object" &&
                "status" in event.payload &&
                typeof (event.payload as { status?: unknown }).status === "string"
                    ? String((event.payload as { status: string }).status).trim()
                    : "";
            const nextStatus = getLoadingStatusLabel(
                typeof event.status === "string" && event.status.trim()
                    ? event.status.trim()
                    : typeof event.content === "string" && event.content.trim()
                      ? event.content.trim()
                      : payloadStatus
            );
            if (nextStatus) {
                const hasToolLabel = loadingLabelRef.current.includes("(");
                if (nextStatus.includes("(")) {
                    loadingToolStartedAtRef.current = Date.now();
                    if (isVisibleConversation) {
                        loadingLabelRef.current = nextStatus;
                        setLoadingLabel(nextStatus);
                    }
                    return;
                }
                if (hasToolLabel && ["Em fila...", "Analisando..."].includes(nextStatus)) {
                    return;
                }
                if (isVisibleConversation) {
                    loadingLabelRef.current = nextStatus;
                    setLoadingLabel(nextStatus);
                }
            }
        }
        if (messageType === "tool_start") {
            const toolName =
                typeof event.tool_name === "string"
                    ? event.tool_name
                    : typeof event.tool === "string"
                      ? event.tool
                      : "";
            loadingToolStartedAtRef.current = Date.now();
            if (isVisibleConversation) {
                const nextLabel = toolName ? `Analisando (${toolName})...` : "Analisando...";
                loadingLabelRef.current = nextLabel;
                setLoadingLabel(nextLabel);
            }
        }
        if (messageType === "done" && isStreamTimeoutEvent(event)) {
            completeLoading(
                eventConversationId,
                0,
                "Ocorreu um erro desconhecido durante a análise. Tente novamente mais tarde."
            );
            return;
        }
        if (messageType === "assistant" || messageType === "status" || messageType === "tool_start" || messageType === "tool_result" || messageType === "action" || messageType === "done") {
            const eventId = String(event.id || crypto.randomUUID());
            if (isVisibleConversation) {
                setMessages((previous) => {
                    if (previous.some((messageItem) => messageItem.id === eventId)) {
                        return previous;
                    }
                    return [
                        ...previous,
                        {
                            id: eventId,
                            conversation_id: eventConversationId,
                            role: "assistant",
                            message_type: messageType,
                            content: typeof event.content === "string" ? event.content : messageType,
                            payload: (event.payload as ChatTurnPayload | Record<string, unknown> | null) || null,
                            tool_name:
                                typeof event.tool_name === "string"
                                    ? event.tool_name
                                    : typeof event.tool === "string"
                                      ? event.tool
                                      : null,
                            status: typeof event.status === "string" ? event.status : null,
                            created_at: typeof event.created_at === "string" ? event.created_at : undefined,
                        },
                    ];
                });
            }
        }
        if (messageType === "done") {
            const startedAt = loadingToolStartedAtRef.current;
            const elapsed = startedAt ? Date.now() - startedAt : 0;
            const remaining = startedAt ? Math.max(0, 400 - elapsed) : 0;
            completeLoading(eventConversationId, remaining);
        }
        if (messageType === "assistant" && loadingConversationIdRef.current === eventConversationId) {
            completeLoading(eventConversationId, 120);
        }
    };

    /**
     * Reabre o SSE da conversa atual depois de uma queda sem `done`.
     *
     * @param conversationId Identificador da conversa em processamento.
     * @returns void
     */
    function reopenConversationStream(conversationId: string): void {
        if (loadingConversationIdRef.current !== conversationId) {
            return;
        }
        eventSourceRef.current?.close();
        eventSourceRef.current = openChatConversationStream(
            conversationId,
            clientKey,
            applyStreamEvent,
            () => recoverConversationStream(conversationId)
        );
    }

    /**
     * Recupera o estado da conversa quando a conexão SSE cai antes do evento final.
     *
     * @param conversationId Identificador da conversa em processamento.
     * @returns Promise<void>
     */
    async function recoverConversationStream(conversationId: string): Promise<void> {
        if (streamRecoveringRef.current || loadingConversationIdRef.current !== conversationId) {
            return;
        }
        fallbackPollingConversationIdRef.current = conversationId;
        setFallbackPollingConversationId(conversationId);
        streamRecoveringRef.current = true;
        try {
            await syncConversationSnapshot(conversationId);
            const accessToken = await getAccessToken({ redirectOnFail: false });
            const conversation = await fetchChatConversation(conversationId, accessToken || undefined);
            const currentLoadingMessageId = loadingMessageIdRef.current;
            if (!currentLoadingMessageId) {
                return;
            }
            if (!hasFinalConversationMessage(conversation, currentLoadingMessageId)) {
                if (streamReconnectTimeoutRef.current) {
                    window.clearTimeout(streamReconnectTimeoutRef.current);
                }
                streamReconnectTimeoutRef.current = window.setTimeout(() => {
                    streamReconnectTimeoutRef.current = null;
                    reopenConversationStream(conversationId);
                }, 1500);
                return;
            }
            completeLoading(conversationId, 120);
        } catch (error) {
            console.error("Falha ao recuperar stream do chat", error);
            if (streamReconnectTimeoutRef.current) {
                window.clearTimeout(streamReconnectTimeoutRef.current);
            }
            streamReconnectTimeoutRef.current = window.setTimeout(() => {
                streamReconnectTimeoutRef.current = null;
                reopenConversationStream(conversationId);
            }, 3000);
        } finally {
            streamRecoveringRef.current = false;
        }
    }

    /**
     * Envia a mensagem do usuário para o backend.
     *
     * @param rawMessage Texto digitado.
     * @returns Promise<void>
     */
    const handleSend = useCallback(async (rawMessage: string): Promise<void> => {
        const normalized = rawMessage.trim();
        if (!normalized || loading || loadingConversation) {
            return;
        }
        setLoadingConversation(true);
        setLoading(true);
        setLoadingConversationId(currentConversationId);
        loadingConversationIdRef.current = currentConversationId;
        setLoadingLabel("Analisando...");
        loadingLabelRef.current = "Analisando...";
        loadingToolStartedAtRef.current = null;
        pendingAssistantScrollRef.current = true;
        pendingUserScrollRef.current = true;
        setInput("");
        try {
            const accessToken = await getAccessToken({ redirectOnFail: false });
            const response = await submitChatMessage(
                {
                    message: normalized,
                    conversation_id: currentConversationId,
                    client_key: clientKey,
                    library: library?.id || 1,
                    source: "bibliotecario-ui",
                    initial_context: {
                        route: location.pathname,
                        query: queryMessage || undefined,
                    },
                },
                accessToken || undefined
            );
            setLoadingConversationId(response.conversation_id);
            setLoadingMessageId(response.message_id);
            loadingConversationIdRef.current = response.conversation_id;
            loadingMessageIdRef.current = response.message_id;
            setCurrentConversationId(response.conversation_id);
            setMessages((previous) => [
                ...previous,
                {
                    id: response.message_id,
                    conversation_id: response.conversation_id,
                    role: "user",
                    message_type: "user",
                    content: normalized,
                    payload: { message: normalized },
                },
            ]);
            eventSourceRef.current?.close();
            eventSourceRef.current = openChatConversationStream(
                response.conversation_id,
                clientKey,
                applyStreamEvent,
                () => recoverConversationStream(response.conversation_id)
            );
            void syncConversationSnapshot(response.conversation_id);
        } catch (error) {
            setInput(normalized);
            setLoading(false);
            setLoadingConversationId(null);
            setLoadingMessageId(null);
            loadingConversationIdRef.current = null;
            loadingMessageIdRef.current = null;
            fallbackPollingConversationIdRef.current = null;
            setFallbackPollingConversationId(null);
            loadingLabelRef.current = "Analisando...";
            setLoadingLabel("Analisando...");
            loadingToolStartedAtRef.current = null;
            message.error(getChatErrorMessage(error));
            console.error(error);
        } finally {
            setLoadingConversation(false);
        }
    }, [clientKey, currentConversationId, getAccessToken, library?.id, loading, location.pathname, loadingConversation, queryMessage]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!loading || !fallbackPollingConversationId) {
            return;
        }

        let stopped = false;
        const pollConversation = async (): Promise<void> => {
            if (loadingConversationIdRef.current !== fallbackPollingConversationId) {
                return;
            }
            try {
                const accessToken = await getAccessToken({ redirectOnFail: false });
                const conversation = await fetchChatConversation(fallbackPollingConversationId, accessToken || undefined);
                if (stopped || loadingConversationIdRef.current !== fallbackPollingConversationId) {
                    return;
                }
                if (currentConversationIdRef.current === fallbackPollingConversationId) {
                    const nextMessages = conversation.messages || [];
                    setMessages((previous) => mergeConversationMessages(previous, nextMessages));
                }
                const currentLoadingMessageId = loadingMessageIdRef.current;
                if (currentLoadingMessageId && hasFinalConversationMessage(conversation, currentLoadingMessageId)) {
                    completeLoading(fallbackPollingConversationId, 120);
                }
            } catch (error) {
                console.error("Falha ao sincronizar conversa em andamento", error);
            }
        };

        const intervalId = window.setInterval(() => {
            void pollConversation();
        }, 5000);
        void pollConversation();

        return () => {
            stopped = true;
            window.clearInterval(intervalId);
        };
    }, [completeLoading, fallbackPollingConversationId, getAccessToken, loading]);

    useEffect(() => {
        const pendingMessage = pendingAutoSendMessage;
        if (!pendingMessage || loadingConversation || currentConversationId) {
            return;
        }
        setPendingAutoSendMessage(null);
        autoSendRef.current = true;
        void handleSend(pendingMessage);
    }, [handleSend, pendingAutoSendMessage, currentConversationId, loadingConversation]);

    const assistantPayload = useMemo(() => {
        const assistantMessages = messages.filter(isAssistantMessage);
        const latest = assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null;
        return (latest?.payload as ChatTurnPayload | undefined) || null;
    }, [messages]);

    const activeLoadingLabel = useMemo(() => {
        if (isCurrentConversationLoading) {
            if (loadingLabel && loadingLabel !== "Analisando...") {
                return loadingLabel;
            }
            const loadingMessageIndex = loadingMessageId
                ? messages.findIndex((messageItem) => messageItem.id === loadingMessageId)
                : -1;
            if (loadingMessageIndex < 0) {
                return loadingLabel;
            }
            for (let index = messages.length - 1; index > loadingMessageIndex; index -= 1) {
                const messageItem = messages[index];
                if (messageItem.role !== "assistant") {
                    continue;
                }
                if (messageItem.message_type === "tool_start" && messageItem.tool_name) {
                    return `Analisando (${messageItem.tool_name})...`;
                }
                if (messageItem.message_type === "status") {
                    const payloadStatus =
                        messageItem.payload &&
                        typeof messageItem.payload === "object" &&
                        "status" in messageItem.payload &&
                        typeof (messageItem.payload as { status?: unknown }).status === "string"
                            ? String((messageItem.payload as { status: string }).status).trim()
                            : "";
                    const safePayloadStatus = getLoadingStatusLabel(payloadStatus);
                    if (safePayloadStatus) {
                        return safePayloadStatus;
                    }
                    if (
                        typeof messageItem.content === "string" &&
                        messageItem.content.trim() &&
                        getLoadingStatusLabel(messageItem.content)
                    ) {
                        return getLoadingStatusLabel(messageItem.content) as string;
                    }
                }
            }
            return loadingLabel;
        }
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const messageItem = messages[index];
            if (messageItem.role !== "assistant") {
                continue;
            }
            if (messageItem.message_type === "tool_start" && messageItem.tool_name) {
                return `Analisando (${messageItem.tool_name})...`;
            }
            if (messageItem.message_type === "status") {
                const payloadStatus =
                    messageItem.payload &&
                    typeof messageItem.payload === "object" &&
                    "status" in messageItem.payload &&
                    typeof (messageItem.payload as { status?: unknown }).status === "string"
                        ? String((messageItem.payload as { status: string }).status).trim()
                        : "";
                const safePayloadStatus = getLoadingStatusLabel(payloadStatus);
                if (safePayloadStatus) {
                    return safePayloadStatus;
                }
                if (
                    typeof messageItem.content === "string" &&
                    messageItem.content.trim() &&
                    getLoadingStatusLabel(messageItem.content)
                ) {
                    return getLoadingStatusLabel(messageItem.content) as string;
                }
            }
        }
        return loadingLabel;
    }, [messages, isCurrentConversationLoading, loadingLabel, loadingMessageId]);

    const visibleMessages = useMemo(
        () => messages.filter((messageItem) => isUserMessage(messageItem) || isAssistantMessage(messageItem)),
        [messages]
    );

    const latestAssistantMessageId = useMemo(() => {
        for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
            const messageItem = visibleMessages[index];
            if (isAssistantMessage(messageItem)) {
                return messageItem.id;
            }
        }
        return null;
    }, [visibleMessages]);

    const latestUserMessageId = useMemo(() => {
        for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
            const messageItem = visibleMessages[index];
            if (isUserMessage(messageItem)) {
                return messageItem.id;
            }
        }
        return null;
    }, [visibleMessages]);

    /**
     * Rola a área de mensagens até o início da bolha informada.
     *
     * @param messageId Identificador da mensagem no DOM.
     * @returns void
     */
    const scrollMessageIntoView = useCallback((messageId: string): void => {
        const escapedId = window.CSS?.escape
            ? window.CSS.escape(messageId)
            : messageId.replace(/["\\]/g, "\\$&");
        const messageElement = messageStreamRef.current?.querySelector(
            `[data-chat-message-id="${escapedId}"]`
        );
        messageElement?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (
            !pendingUserScrollRef.current ||
            !latestUserMessageId ||
            lastAutoScrolledUserIdRef.current === latestUserMessageId
        ) {
            return;
        }

        lastAutoScrolledUserIdRef.current = latestUserMessageId;
        pendingUserScrollRef.current = false;
        scrollMessageIntoView(latestUserMessageId);
    }, [latestUserMessageId, scrollMessageIntoView]);

    useEffect(() => {
        if (
            !pendingAssistantScrollRef.current ||
            !latestAssistantMessageId ||
            lastAutoScrolledAssistantIdRef.current === latestAssistantMessageId
        ) {
            return;
        }

        lastAutoScrolledAssistantIdRef.current = latestAssistantMessageId;
        pendingAssistantScrollRef.current = false;
        scrollMessageIntoView(latestAssistantMessageId);
    }, [latestAssistantMessageId, scrollMessageIntoView]);

    return (
        <Layout className="page-shell bibliotecario-shell">
            <HeaderView />
            <Content className="page-content bibliotecario-content">
                <section className="bibliotecario-layout">
                    <aside className="chat-history-sider glass-panel">
                        <Typography.Title level={4}>Conversas</Typography.Title>
                        <Button
                            block
                            className="chat-new-button"
                            disabled={loading || loadingConversation}
                            onClick={() => {
                                resetCurrentConversation();
                            }}
                        >
                            Nova conversa
                        </Button>
                        <div className="chat-history-list-wrap">
                            <List
                                className="chat-history-list"
                                dataSource={conversations}
                                renderItem={(conversation) => {
                                    const displayedStatus =
                                        loadingConversationId === conversation.id ? "open" : conversation.status;
                                    return (
                                        <List.Item
                                            className={`chat-history-item ${conversation.id === currentConversationId ? "active" : ""}`}
                                            onClick={() => setCurrentConversationId(conversation.id)}
                                        >
                                            <div className="chat-history-item-content">
                                                <Typography.Text className="chat-history-title">
                                                    {conversation.title || "Conversa sem título"}
                                                </Typography.Text>
                                                {conversation.summary ? (
                                                    <Typography.Text className="chat-history-summary" type="secondary">
                                                        {conversation.summary}
                                                    </Typography.Text>
                                                ) : null}
                                                <Tag
                                                    className="chat-history-status-tag"
                                                    color={getConversationStatusColor(displayedStatus)}
                                                >
                                                    {getConversationStatusLabel(displayedStatus)}
                                                </Tag>
                                            </div>
                                        </List.Item>
                                    );
                                }}
                            />
                        </div>
                        <div className="chat-history-footer">
                            {conversationsNext ? (
                                <Button
                                    block
                                    loading={loadingMoreConversations}
                                    onClick={async () => {
                                        setLoadingMoreConversations(true);
                                        try {
                                            await loadConversations(conversationsNext);
                                        } catch (error) {
                                            message.error("Não foi possível carregar mais conversas.");
                                            console.error(error);
                                        } finally {
                                            setLoadingMoreConversations(false);
                                        }
                                    }}
                                >
                                    Carregar mais
                                </Button>
                            ) : null}
                        </div>
                    </aside>

                    <div className="chat-main-panel glass-panel">
                        <div className="chat-panel-header">
                            <Typography.Title level={3}>Bibliotecário</Typography.Title>
                            <Typography.Text type="secondary">
                                Pergunte sobre livros, trechos, autores e navegação no sistema.
                            </Typography.Text>
                        </div>

                        <div className="chat-message-stream" ref={messageStreamRef}>
                            {loadingHistory ? (
                                <div className="chat-empty-state">
                                    <Spin size="large" />
                                </div>
                            ) : visibleMessages.length === 0 ? (
                                <div className="chat-empty-state">
                                    <Empty description="Digite uma pergunta para começar." />
                                </div>
                            ) : (
                                visibleMessages.map((chatMessage) => (
                                    <div
                                        key={chatMessage.id}
                                        data-chat-message-id={chatMessage.id}
                                        className={`chat-bubble ${chatMessage.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}`}
                                    >
                                        {chatMessage.role === "user" ? (
                                            <Typography.Paragraph>{chatMessage.content}</Typography.Paragraph>
                                        ) : (
                                            <ChatResponseRenderer
                                                payload={(chatMessage.payload as ChatTurnPayload) || null}
                                                loading={chatMessage.message_type === "status" && isCurrentConversationLoading}
                                                loadingLabel={activeLoadingLabel}
                                                onAction={(route) => navigate(route)}
                                            />
                                        )}
                                    </div>
                                ))
                            )}

                            {isCurrentConversationLoading && (
                                <div className="chat-bubble chat-bubble-assistant">
                                    <ChatResponseRenderer
                                        payload={assistantPayload}
                                        loading
                                        loadingLabel={activeLoadingLabel}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="chat-composer">
                            <Input.TextArea
                                rows={3}
                                placeholder="Digite sua pergunta ao bibliotecário..."
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                onPressEnter={(event) => {
                                    if (!event.shiftKey) {
                                        event.preventDefault();
                                        if (!loading && !loadingConversation) {
                                            void handleSend(input);
                                        }
                                    }
                                }}
                            />
                            <Button
                                type="primary"
                                loading={loadingConversation || isCurrentConversationLoading}
                                disabled={loading || loadingConversation || !input.trim()}
                                onClick={() => void handleSend(input)}
                            >
                                Enviar
                            </Button>
                        </div>
                    </div>
                </section>
            </Content>
        </Layout>
    );
}
