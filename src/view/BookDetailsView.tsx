import { useState } from "react";
import book_icon from "../assets/book_icon.png";
import { lendBook } from "../service/BookService";
import "../styles/BookDetailsView.css";

interface BookDetailsViewProps {
    id: string;
    title: string;
    author: string;
    edition: string;
    publisher: string;
    year: string;
    isbn: string;
    pages: string;
    language: string;
    review: string;
    coverUrl?: string;
}

export default function BookDetailsView({
    id,
    title,
    author,
    edition,
    publisher,
    year,
    isbn,
    pages,
    language,
    review,
    coverUrl
}: BookDetailsViewProps) {
    const [loadingLendBook, setLoadingLendBook] = useState(false);

    return (
        <div className="library-home">
            <main className="main-content">
                <section className="book-section">
                    <h2 className="section-title">Sobre o livro</h2>

                    <h3 className="book-title">{title}</h3>

                    <div className="book-details-grid" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginTop: '20px' }}>
                        <div className="book-info" style={{ flex: 1 }}>
                            <p>Autor: {author}</p>
                            <p>Edição: {edition}</p>
                            <p>Editora: {publisher}</p>
                            <p>Ano: {year}</p>
                            <p>ISBN: {isbn}</p>
                            <p>Páginas: {pages}</p>
                            <p>Idioma: {language}</p>
                        </div>

                        <div className="book-cover" style={{ width: '180px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', flexDirection: 'column' }}>
                            <img
                                src={coverUrl || book_icon}
                                alt="Capa do livro"
                                className="book-icon"
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                            <button
                                onClick={async () => {
                                    setLoadingLendBook(true);
                                    await lendBook(id);
                                    setLoadingLendBook(false);
                                }}
                            >
                                Ler agora
                            </button>
                            {loadingLendBook && <p>Carregando...</p>}
                        </div>
                    </div>

                    <h3 className="section-title" style={{ marginTop: '20px' }}>Resenha</h3>
                    <p style={{ textAlign: 'justify' }}>{review}</p>
                </section>
            </main>
        </div >
    );
}
