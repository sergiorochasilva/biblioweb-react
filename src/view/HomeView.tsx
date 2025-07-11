import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useCarousel } from "../controller/CarrouselController";
import { fetchRecentPublications } from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "../view/HeaderView";
import book_icon from "../assets/book_icon.png";
import "../styles/HomeView.css";

export default function HomeView() {
    const { handleScroll } = useCarousel();
    const navigate = useNavigate();
    // const firstCarouselRef = useRef<HTMLDivElement>(null);
    const secondCarouselRef = useRef<HTMLDivElement>(null);

    const [recentPublications, setRecentPublications] = useState<Book[]>([]);

    useEffect(() => {
        async function loadRecentPublications() {
            try {
                const books = await fetchRecentPublications();
                setRecentPublications(books);
            } catch (error) {
                console.error("Failed to load recent publications", error);
            }
        }

        loadRecentPublications();
    }, []);

    return (
        <div className="library-home">
            <div className="page-container">
                <HeaderView />

                {/* Book Sections */}
                <main className="main-content">
                    {/* Livros Texto
                <section className="book-section">
                    <h2 className="section-title">Livros texto</h2>
                    <div className="book-carousel-container">
                        <button
                            className="carousel-button left"
                            onClick={() => handleScroll(firstCarouselRef, "left", "first")}
                        >
                            &#8249;
                        </button>
                        <div className="book-carousel" ref={firstCarouselRef}>
                            {[...Array(15)].map((_, index) => (
                                <div key={index} className="book-item">
                                    <div className="book-cover"></div>
                                    <div className="book-title">Título do livro</div>
                                    <div className="book-author">Autor: Nome do autor</div>
                                    <div className="book-publisher">Editora: Nome da editora</div>
                                </div>
                            ))}
                        </div>
                        <button
                            className="carousel-button right"
                            onClick={() => handleScroll(firstCarouselRef, "right", "first")}
                        >
                            &#8250;
                        </button>
                    </div>
                </section> */}

                    {/* Publicações recentes */}
                    <section className="book-section">
                        <h2 className="section-title">Publicações recentes</h2>
                        <div className="book-carousel-container">
                            <button
                                className="carousel-button left"
                                onClick={() => handleScroll(secondCarouselRef, "left", "second")}
                            >
                                &#8249;
                            </button>
                            <div className="book-carousel" ref={secondCarouselRef}>
                                {recentPublications.map((book) => (
                                    <div key={book.id} className="book-item" onClick={() => navigate(`/book/${book.id}`)}>
                                        {/* <div className="book-cover" style={{ backgroundImage: `url(${book.image_url})` }}></div> */}
                                        <div className="book-cover">
                                            <img src={book.image_url ? book.image_url : book_icon} alt="Book Icon" className="book-icon" />
                                        </div>
                                        <div className="book-title">{book.title}</div>
                                        <div className="book-author">Autor: {book.author}</div>
                                        <div className="book-publisher">Editora: {book.publisher}</div>
                                    </div>
                                ))}
                            </div>
                            <button
                                className="carousel-button right"
                                onClick={() => handleScroll(secondCarouselRef, "right", "second")}
                            >
                                &#8250;
                            </button>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}