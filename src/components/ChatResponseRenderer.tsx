import { Button, Divider, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BookCard from "./BookCard";
import { type ChatActionPayload, type ChatTurnPayload, toBookCardModel } from "../service/ChatService";

interface ChatResponseRendererProps {
    payload: ChatTurnPayload | null;
    loading?: boolean;
    loadingLabel?: string;
    onAction?: (route: string) => void;
}

/**
 * Remove ações genéricas que apenas duplicam os botões dos livros já renderizados.
 *
 * @param payload Resposta estruturada do chatbot.
 * @returns Ações realmente úteis fora do contexto dos cards.
 */
function getVisibleActions(payload: ChatTurnPayload) {
    if (payload.books.length === 0) {
        return payload.actions;
    }

    const bookActionKeys = new Set(
        payload.books.map((book) =>
            `${book.action?.type || "open_book"}::${book.action?.route || `/book/${book.book_id}`}`
        )
    );

    return payload.actions.filter((action) => {
        const actionKey = `${action.type}::${action.route || ""}`;
        return !bookActionKeys.has(actionKey);
    });
}

/**
 * Monta a rota navegável de uma action, preservando parâmetros como query string.
 *
 * @param action Action estruturada retornada pelo backend.
 * @returns Rota pronta para o React Router ou string vazia quando inválida.
 */
function buildActionRoute(action: ChatActionPayload): string {
    const baseRoute = action.route || (action.type === "open_book" && action.book_id ? `/book/${action.book_id}` : "");
    if (!baseRoute) {
        return "";
    }

    const params = action.params || {};
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
            return;
        }
        query.set(key, String(value));
    });
    const queryString = query.toString();
    return queryString ? `${baseRoute}?${queryString}` : baseRoute;
}

/**
 * Renderiza a resposta do chat em texto, actions e lista de livros.
 *
 * @param payload Resposta estruturada do chatbot.
 * @param loading Indica que o bot ainda está analisando.
 * @param onAction Callback para ações de navegação.
 * @returns JSX do conteúdo da resposta.
 */
export default function ChatResponseRenderer({
    payload,
    loading = false,
    loadingLabel = "Analisando...",
    onAction,
}: ChatResponseRendererProps) {
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="chat-loading-panel">
                <div className="chat-loading-orb" />
                <Typography.Text strong>{loadingLabel}</Typography.Text>
            </div>
        );
    }

    if (!payload) {
        return null;
    }

    const visibleActions = getVisibleActions(payload);

    const handleAction = (action: ChatActionPayload) => {
        const route = buildActionRoute(action);
        if (!route) {
            return;
        }
        if (onAction) {
            onAction(route);
            return;
        }
        navigate(route);
    };

    return (
        <div className="chat-response-renderer">
            {payload.text && (
                <div className="chat-response-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{payload.text}</ReactMarkdown>
                </div>
            )}

            {visibleActions.length > 0 && (
                <Space wrap className="chat-action-row">
                    {visibleActions.map((action, index) => (
                        <Button
                            key={`${action.type}-${index}`}
                            className="chat-action-button"
                            onClick={() => handleAction(action)}
                        >
                            {action.label}
                        </Button>
                    ))}
                </Space>
            )}

            {payload.books.length > 0 && (
                <div className="chat-books-block">
                    <Divider>Livros relacionados</Divider>
                    <div className="chat-books-grid">
                        {payload.books.map((book) => {
                            const model = toBookCardModel(book);
                            return (
                                <div key={book.book_id} className="chat-book-card-wrap">
                                    <Tag className="chat-book-score-tag">
                                        Score {book.score?.toFixed(3) || "0.000"}
                                    </Tag>
                                    <BookCard
                                        book={model}
                                        onClick={() =>
                                            handleAction(
                                                book.action || {
                                                    type: "open_book",
                                                    label: "Abrir",
                                                    route: `/book/${book.book_id}`,
                                                    book_id: book.book_id,
                                                }
                                            )
                                        }
                                        secondaryActionLabel={book.action?.label || "Abrir"}
                                        onSecondaryAction={() =>
                                            handleAction(
                                                book.action || {
                                                    type: "open_book",
                                                    label: "Abrir",
                                                    route: `/book/${book.book_id}`,
                                                    book_id: book.book_id,
                                                }
                                            )
                                        }
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
