import { useNavigate } from "react-router-dom";
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
    image_url?: string;
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
    image_url
}: BookDetailsViewProps) {
    const navigate = useNavigate();
    const [loadingLendBook, setLoadingLendBook] = useState(false);

    return (
        <div className="library-home">
            <header className="details-header">
                <button
                    className="back-button"
                    onClick={() => navigate(-1)}
                    aria-label="Voltar"
                >
                    &#8592;
                </button>
                <h2 className="details-title">Detalhes do livro</h2>
            </header>

            <main className="main-content">
                <section className="book-details-section">
                    <h2 className="section-details-title">Sobre o livro</h2>

                    <h3 className="book-details-title">{title}</h3>

                    <div className="book-details-grid">
                        <div className="book-details-info">
                            <p>Autor: {author}</p>
                            <p>Edição: {edition}</p>
                            <p>Editora: {publisher}</p>
                            <p>Ano: {year}</p>
                            <p>ISBN: {isbn}</p>
                            <p>Páginas: {pages}</p>
                            <p>Idioma: {language}</p>
                        </div>

                        <div className="book-details-cover">
                            <img
                                src={image_url || book_icon}
                                alt="Capa do livro"
                                className="book-details-cover-img"
                            />

                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            setLoadingLendBook(true);
                            await lendBook(id);
                            setLoadingLendBook(false);
                        }}
                        className="book-details-ler"
                    >
                        {loadingLendBook && <>Carregando...</>}
                        {!loadingLendBook && <>Ler agora</>}
                    </button>

                    <h3 className="section-details-title" style={{ marginTop: '20px' }}>Resenha</h3>
                    <p style={{ textAlign: 'justify' }}>{review}</p>
                </section>
            </main>
        </div >
    );
}
