import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Empty, Input, Layout, List, Spin, Typography, message } from "antd";
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
    const [loadingLabel, setLoadingLabel] = useState("Analisando...");
    const [loadingConversation, setLoadingConversation] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);
    const loadingToolStartedAtRef = useRef<number | null>(null);
    const loadingDoneTimeoutRef = useRef<number | null>(null);
    const autoSendRef = useRef(false);
    const previousConversationIdRef = useRef<string | null>(null);
    const [pendingAutoSendMessage, setPendingAutoSendMessage] = useState<string | null>(null);
    const queryMessage = new URLSearchParams(location.search).get("message") || "";
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
        loadingToolStartedAtRef.current = null;
        setCurrentConversationId(null);
        setMessages([]);
        setLoading(false);
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
     * @param delayMs Atraso opcional antes de encerrar o loading.
     * @returns void
     */
    const completeLoading = (delayMs = 0): void => {
        if (loadingDoneTimeoutRef.current) {
            window.clearTimeout(loadingDoneTimeoutRef.current);
            loadingDoneTimeoutRef.current = null;
        }

        const finish = (): void => {
            setLoading(false);
            setLoadingLabel("Analisando...");
            loadingToolStartedAtRef.current = null;
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            loadingDoneTimeoutRef.current = null;
            void refreshConversations();
        };

        if (delayMs > 0) {
            loadingDoneTimeoutRef.current = window.setTimeout(finish, delayMs);
            return;
        }

        finish();
    };

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
        if (
            previousConversationIdRef.current &&
            previousConversationIdRef.current !== currentConversationId
        ) {
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
        }
        previousConversationIdRef.current = currentConversationId;
        if (currentConversationId) {
            void loadConversationHistory(currentConversationId);
        } else {
            setMessages([]);
        }
    }, [currentConversationId, loadConversationHistory]);

    useEffect(() => {
        return () => {
            eventSourceRef.current?.close();
            if (loadingDoneTimeoutRef.current) {
                window.clearTimeout(loadingDoneTimeoutRef.current);
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
        if (messageType === "status") {
            const payloadStatus =
                event.payload &&
                typeof event.payload === "object" &&
                "status" in event.payload &&
                typeof (event.payload as { status?: unknown }).status === "string"
                    ? String((event.payload as { status: string }).status).trim()
                    : "";
            const nextStatus =
                typeof event.status === "string" && event.status.trim()
                    ? event.status.trim()
                    : typeof event.content === "string" && event.content.trim()
                      ? event.content.trim()
                      : payloadStatus;
            if (nextStatus) {
                const hasToolLabel = loadingLabel.includes("(");
                if (nextStatus.includes("(")) {
                    loadingToolStartedAtRef.current = Date.now();
                    setLoadingLabel(nextStatus);
                    return;
                }
                if (hasToolLabel && nextStatus === "Analisando...") {
                    return;
                }
                setLoadingLabel(nextStatus);
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
            setLoadingLabel(toolName ? `Analisando (${toolName})...` : "Analisando...");
        }
        if (messageType === "assistant" || messageType === "status" || messageType === "tool_start" || messageType === "tool_result" || messageType === "action" || messageType === "done") {
            setMessages((previous) => [
                ...previous,
                {
                    id: String(event.id || crypto.randomUUID()),
                    conversation_id: String(event.conversation_id || currentConversationId || ""),
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
            ]);
        }
        if (messageType === "done") {
            const startedAt = loadingToolStartedAtRef.current;
            const elapsed = startedAt ? Date.now() - startedAt : 0;
            const remaining = startedAt ? Math.max(0, 400 - elapsed) : 0;
            completeLoading(remaining);
        }
        if (messageType === "assistant" && loading) {
            completeLoading(120);
        }
    };

    /**
     * Envia a mensagem do usuário para o backend.
     *
     * @param rawMessage Texto digitado.
     * @returns Promise<void>
     */
    const handleSend = useCallback(async (rawMessage: string): Promise<void> => {
        const normalized = rawMessage.trim();
        if (!normalized || loadingConversation) {
            return;
        }
        setLoadingConversation(true);
        setLoading(true);
        setLoadingLabel("Analisando...");
        loadingToolStartedAtRef.current = null;
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
                applyStreamEvent
            );
            void syncConversationSnapshot(response.conversation_id);
        } catch (error) {
            setInput(normalized);
            setLoading(false);
            setLoadingLabel("Analisando...");
            loadingToolStartedAtRef.current = null;
            message.error(getChatErrorMessage(error));
            console.error(error);
        } finally {
            setLoadingConversation(false);
        }
    }, [clientKey, currentConversationId, getAccessToken, library?.id, location.pathname, loadingConversation, queryMessage]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (loading) {
            if (loadingLabel && loadingLabel !== "Analisando...") {
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
                    if (payloadStatus && payloadStatus !== "Analisando...") {
                        return payloadStatus;
                    }
                    if (
                        typeof messageItem.content === "string" &&
                        messageItem.content.trim() &&
                        messageItem.content.trim() !== "Analisando..."
                    ) {
                        return messageItem.content.trim();
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
                if (payloadStatus) {
                    return payloadStatus;
                }
                if (typeof messageItem.content === "string" && messageItem.content.trim()) {
                    return messageItem.content.trim();
                }
            }
        }
        return loadingLabel;
    }, [messages, loading, loadingLabel]);

    const visibleMessages = useMemo(
        () => messages.filter((messageItem) => isUserMessage(messageItem) || isAssistantMessage(messageItem)),
        [messages]
    );

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
                                renderItem={(conversation) => (
                                    <List.Item
                                        className={`chat-history-item ${conversation.id === currentConversationId ? "active" : ""}`}
                                        onClick={() => setCurrentConversationId(conversation.id)}
                                    >
                                        <List.Item.Meta
                                            title={conversation.title || "Conversa sem título"}
                                            description={conversation.summary || conversation.status || "Aberta"}
                                        />
                                    </List.Item>
                                )}
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

                        <div className="chat-message-stream">
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
                                        className={`chat-bubble ${chatMessage.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}`}
                                    >
                                        {chatMessage.role === "user" ? (
                                            <Typography.Paragraph>{chatMessage.content}</Typography.Paragraph>
                                        ) : (
                                            <ChatResponseRenderer
                                                payload={(chatMessage.payload as ChatTurnPayload) || null}
                                                loading={chatMessage.message_type === "status" && loading}
                                                loadingLabel={activeLoadingLabel}
                                                onAction={(route) => navigate(route)}
                                            />
                                        )}
                                    </div>
                                ))
                            )}

                            {loading && (
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
                                        void handleSend(input);
                                    }
                                }}
                            />
                            <Button type="primary" loading={loadingConversation} onClick={() => void handleSend(input)}>
                                Enviar
                            </Button>
                        </div>
                    </div>
                </section>
            </Content>
        </Layout>
    );
}
