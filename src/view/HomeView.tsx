import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Button, Empty, Layout, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useCarousel } from "../controller/CarrouselController";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    fetchMostAccessedPublications,
    fetchRecentPublications,
} from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "../view/HeaderView";
import BookCard from "../components/BookCard";
import "../styles/HomeView.css";
import { useAuth } from "../contexts/useAuth";

export default function HomeView() {
    const { handleScroll } = useCarousel();
    const navigate = useNavigate();
    const recentCarouselRef = useRef<HTMLDivElement>(null);
    const mostAccessedCarouselRef = useRef<HTMLDivElement>(null);
    const { getAccessToken, library } = useAuth();

    const [recentPublications, setRecentPublications] = useState<Book[]>([]);
    const [mostAccessedBooks, setMostAccessedBooks] = useState<Book[]>([]);

    useEffect(() => {
        let isActive = true;

        async function loadRecentPublications() {
            const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
            const accessToken = await getAccessToken();

            try {
                const [recentResult, mostAccessedResult] = await Promise.allSettled([
                    fetchRecentPublications(
                        libraryId,
                        accessToken || undefined
                    ),
                    fetchMostAccessedPublications(
                        libraryId,
                        accessToken || undefined
                    ),
                ]);

                if (!isActive) {
                    return;
                }

                if (recentResult.status === "fulfilled") {
                    setRecentPublications(recentResult.value);
                } else {
                    setRecentPublications([]);
                    console.error("Failed to load recent publications", recentResult.reason);
                }

                if (mostAccessedResult.status === "fulfilled") {
                    setMostAccessedBooks(mostAccessedResult.value);
                } else {
                    setMostAccessedBooks([]);
                    console.error("Failed to load most accessed publications", mostAccessedResult.reason);
                }
            } catch (error) {
                if (isActive) {
                    setRecentPublications([]);
                    setMostAccessedBooks([]);
                }
                console.error("Failed to load home publications", error);
            }
        }

        loadRecentPublications();

        return () => {
            isActive = false;
        };
    }, [getAccessToken, library]);

    const { Content } = Layout;

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <div className="section-header">
                        <Typography.Title level={3} className="section-title">
                            Publicações recentes
                        </Typography.Title>
                    </div>
                    <div className="carousel-shell glass-panel">
                        <Button
                            className="carousel-button left"
                            icon={<LeftOutlined />}
                            type="text"
                            onClick={() => handleScroll(recentCarouselRef, "left", "recent")}
                            aria-label="Voltar carrossel"
                        />
                        <div className="book-carousel" ref={recentCarouselRef}>
                            {recentPublications.length === 0 && (
                                <div className="carousel-empty">
                                    <Empty description="Nenhuma publicação recente." />
                                </div>
                            )}
                            {recentPublications.map((book) => (
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    onClick={() => navigate(`/book/${book.id}`)}
                                />
                            ))}
                        </div>
                        <Button
                            className="carousel-button right"
                            icon={<RightOutlined />}
                            type="text"
                            onClick={() => handleScroll(recentCarouselRef, "right", "recent")}
                            aria-label="Avançar carrossel"
                        />
                    </div>
                </section>

                <section className="page-section">
                    <div className="section-header">
                        <Typography.Title level={3} className="section-title">
                            Mais acessados
                        </Typography.Title>
                    </div>
                    <div className="carousel-shell glass-panel">
                        <Button
                            className="carousel-button left"
                            icon={<LeftOutlined />}
                            type="text"
                            onClick={() =>
                                handleScroll(mostAccessedCarouselRef, "left", "most_accessed")
                            }
                            aria-label="Voltar carrossel de mais acessados"
                        />
                        <div className="book-carousel" ref={mostAccessedCarouselRef}>
                            {mostAccessedBooks.length === 0 && (
                                <div className="carousel-empty">
                                    <Empty description="Nenhum livro acessado ainda." />
                                </div>
                            )}
                            {mostAccessedBooks.map((book) => (
                                <BookCard
                                    key={`${book.id}-most-accessed`}
                                    book={book}
                                    onClick={() => navigate(`/book/${book.id}`)}
                                />
                            ))}
                        </div>
                        <Button
                            className="carousel-button right"
                            icon={<RightOutlined />}
                            type="text"
                            onClick={() =>
                                handleScroll(mostAccessedCarouselRef, "right", "most_accessed")
                            }
                            aria-label="Avançar carrossel de mais acessados"
                        />
                    </div>
                </section>
            </Content>
        </Layout>
    );
}
