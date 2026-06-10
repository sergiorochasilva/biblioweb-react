import { Button, Card, Tag, Typography } from "antd";
import book_icon from "../assets/book_icon.png";
import { Book, getBookAuthorsText } from "../model/Book";
import BookTypeTag from "./BookTypeTag";

interface BookCardProps {
    book: Book;
    onClick?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    secondaryActionLoading?: boolean;
    className?: string;
}

export default function BookCard({
    book,
    onClick,
    secondaryActionLabel,
    onSecondaryAction,
    secondaryActionLoading = false,
    className = "",
}: BookCardProps) {
    const authorsText = getBookAuthorsText(book);

    return (
        <Card
            hoverable
            className={`glass-card book-card ${className}`.trim()}
            onClick={onClick}
            cover={
                <div className="book-card-cover">
                    <BookTypeTag type={book.type} className="book-card-type-tag" />
                    {book.purchased_by_user && (
                        <Tag color="orange" className="book-card-purchase-tag">
                            Já comprado
                        </Tag>
                    )}
                    <img
                        src={book.image_url ? book.image_url : book_icon}
                        alt={`Capa do livro ${book.title}`}
                    />
                </div>
            }
        >
            <Typography.Title level={5} className="book-card-title">
                {book.title}
            </Typography.Title>
            <Typography.Text className="book-card-meta">
                Autor: {authorsText || "Autor não informado"}
            </Typography.Text>
            <Typography.Text className="book-card-meta">Editora: {book.publisher}</Typography.Text>
            {secondaryActionLabel && onSecondaryAction && (
                <div className="book-card-actions">
                    <Button
                        size="small"
                        className="book-card-secondary-action"
                        loading={secondaryActionLoading}
                        onClick={(event) => {
                            event.stopPropagation();
                            onSecondaryAction();
                        }}
                    >
                        {secondaryActionLabel}
                    </Button>
                </div>
            )}
        </Card>
    );
}
