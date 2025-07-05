import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchSearchResults } from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "./HeaderView";
import book_icon from "../assets/book_icon.png";
import "../styles/SearchView.css";

export default function SearchView() {
    const navigate = useNavigate();
    const [searchResults, setSearchResults] = useState<Book[]>([]);
    const [searchParams] = useSearchParams();
    const query = searchParams.get("query") || ""; // "" se não existir

    useEffect(() => {
        async function loadSearchResults() {
            try {
                const books = await fetchSearchResults(query);
                setSearchResults(books);
            } catch (error) {
                console.error("Failed to load search results", error);
            }
        }
        loadSearchResults();
    }, [query]);

    return (
        <div className="library-home">
            <HeaderView />
            <main className="main-content">
                <section className="book-section">
                    <h2 className="section-title">Resultado da pesquisa</h2>
                    <div className="book-results-grid">
                        {searchResults.map((book) => (
                            <div key={book.id} className="book-item" onClick={() => navigate(`/book/${book.id}`)}>
                                <div className="book-cover">
                                    <img src={book_icon} alt="Book Icon" className="book-icon" />
                                </div>
                                <div className="book-title">{book.title}</div>
                                <div className="book-author">Autor: {book.author}</div>
                                <div className="book-publisher">Editora: {book.publisher}</div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
