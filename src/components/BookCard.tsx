import { Card, Typography } from "antd";
import book_icon from "../assets/book_icon.png";
import { Book } from "../model/Book";

interface BookCardProps {
    book: Book;
    onClick?: () => void;
    className?: string;
}

export default function BookCard({ book, onClick, className = "" }: BookCardProps) {
    return (
        <Card
            hoverable
            className={`glass-card book-card ${className}`.trim()}
            onClick={onClick}
            cover={
                <div className="book-card-cover">
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
            <Typography.Text className="book-card-meta">Autor: {book.author}</Typography.Text>
            <Typography.Text className="book-card-meta">Editora: {book.publisher}</Typography.Text>
        </Card>
    );
}
