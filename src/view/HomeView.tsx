import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Button, Empty, Layout, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useCarousel } from "../controller/CarrouselController";
import { fetchRecentPublications } from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "../view/HeaderView";
import BookCard from "../components/BookCard";
import "../styles/HomeView.css";

export default function HomeView() {
    const { handleScroll } = useCarousel();
    const navigate = useNavigate();
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
                            onClick={() => handleScroll(secondCarouselRef, "left", "second")}
                            aria-label="Voltar carrossel"
                        />
                        <div className="book-carousel" ref={secondCarouselRef}>
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
                            onClick={() => handleScroll(secondCarouselRef, "right", "second")}
                            aria-label="Avançar carrossel"
                        />
                    </div>
                </section>
            </Content>
        </Layout>
    );
}
