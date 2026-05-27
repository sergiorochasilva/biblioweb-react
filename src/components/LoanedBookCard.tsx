import { Button, Card, Tag, Typography } from "antd";
import book_icon from "../assets/book_icon.png";
import { Book, getBookAuthorsText } from "../model/Book";
import BookTypeTag from "./BookTypeTag";

type LoanedBookCardProps = {
    book: Book;
    onDownloadAgain: () => void;
    onReturn: () => void;
    loadingDownload?: boolean;
    loadingReturn?: boolean;
};

/**
 * Formata a data de expiração do empréstimo.
 *
 * @param value Data bruta recebida da API.
 * @returns Data local ou texto original.
 */
function formatExpirationDate(value?: string): string {
    const rawValue = typeof value === "string" ? value.trim() : "";
    if (!rawValue) {
        return "-";
    }

    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return rawValue;
    }

    return parsedDate.toLocaleDateString("pt-BR");
}

/**
 * Card compacto para livros com empréstimo ativo.
 *
 * @param props Propriedades do card.
 * @returns Componente visual com capa clicável e botão de devolução.
 */
export default function LoanedBookCard({
    book,
    onDownloadAgain,
    onReturn,
    loadingDownload = false,
    loadingReturn = false,
}: LoanedBookCardProps) {
    const authorsText = getBookAuthorsText(book);
    const expirationLabel = formatExpirationDate(book.loan_expires_at);

    return (
        <Card className="glass-card book-card loaned-book-card">
            <div
                className="book-card-cover loaned-book-card-cover"
                role="button"
                tabIndex={0}
                onClick={onDownloadAgain}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onDownloadAgain();
                    }
                }}
            >
                <BookTypeTag type={book.type} className="book-card-type-tag" />
                <Tag color="blue" className="loaned-book-expiry-tag">
                    Expira em: {expirationLabel}
                </Tag>
                <img
                    src={book.image_url ? book.image_url : book_icon}
                    alt={`Capa do livro ${book.title}`}
                />
            </div>
            <Typography.Title level={5} className="book-card-title">
                {book.title}
            </Typography.Title>
            <Typography.Text className="book-card-meta">
                Autor: {authorsText || "Autor não informado"}
            </Typography.Text>
            <Typography.Text className="book-card-meta">Editora: {book.publisher}</Typography.Text>
            <Button
                className="loaned-book-return-button"
                type="default"
                loading={loadingDownload}
                onClick={onDownloadAgain}
            >
                Baixar novamente
            </Button>
            <Button
                className="loaned-book-return-button"
                type="primary"
                danger
                loading={loadingReturn}
                onClick={onReturn}
            >
                Devolver
            </Button>
        </Card>
    );
}
