import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchBookDetails } from "../service/BookService";
import BookDetailsView from "./BookDetailsView";
import { Book } from "../model/Book";

export default function BookDetailsWrapper() {
    const { id } = useParams();
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            setLoading(true);
            fetchBookDetails(id)
                .then((b) => setBook(b))
                .finally(() => setLoading(false));
        }
    }, [id]);

    if (loading) return <div style={{ padding: 24 }}>Carregando detalhes...</div>;
    if (!book) return <div style={{ padding: 24, color: "red" }}>Livro não encontrado.</div>;

    // repassa todas as props do livro para o BookDetailsView
    return <BookDetailsView
        id={book.id}
        title={book.title}
        author={book.author}
        edition={book.edition}
        publisher={book.publisher}
        year={book.year}
        isbn={book.isbn}
        pages={book.pages}
        language={book.language}
        review={book.review}
        image_url={book.image_url}
    />;
}
