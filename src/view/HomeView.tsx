import React from "react";
import { useRef } from "react";
import { useCarousel } from "./CarrouselController";
import logo from "../assets/logo.png";

export default function HomeView() {
    const { handleScroll } = useCarousel();

    const firstCarouselRef = useRef<HTMLDivElement>(null);
    const secondCarouselRef = useRef<HTMLDivElement>(null);

    return (
        <div className="library-home">
            {/* Header */}
            <header className="header">
                <img src={logo} alt="BiblioWeb Logo" className="logo-image" />
                <button className="menu-button">☰</button>
            </header>

            {/* Search Bar */}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Procure por: título, autor ou descrição de um livro"
                    className="search-input"
                />
            </div>

            {/* Book Sections */}
            <main className="main-content">
                {/* Livros Texto */}
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
                </section>

                {/* Suas Recomendações */}
                <section className="book-section">
                    <h2 className="section-title">Suas recomendações</h2>
                    <div className="book-carousel-container">
                        <button
                            className="carousel-button left"
                            onClick={() => handleScroll(secondCarouselRef, "left", "second")}
                        >
                            &#8249;
                        </button>
                        <div className="book-carousel" ref={secondCarouselRef}>
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
                            onClick={() => handleScroll(secondCarouselRef, "right", "second")}
                        >
                            &#8250;
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}
