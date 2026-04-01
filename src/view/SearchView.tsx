import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Empty, Layout, Row, Col, Typography } from "antd";
import { DEFAULT_PUBLIC_LIBRARY_ID, fetchSearchResults } from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "./HeaderView";
import BookCard from "../components/BookCard";
import "../styles/SearchView.css";
import { useAuth } from "../contexts/AuthContext";

export default function SearchView() {
    const navigate = useNavigate();
    const [searchResults, setSearchResults] = useState<Book[]>([]);
    const [searchParams] = useSearchParams();
    const query = searchParams.get("query") || ""; // "" se não existir
    const { getAccessToken, library } = useAuth();

    useEffect(() => {
        let isActive = true;

        async function loadSearchResults() {
            try {
                const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
                const accessToken = await getAccessToken();
                const books = await fetchSearchResults(
                    query,
                    libraryId,
                    accessToken || undefined
                );
                if (isActive) {
                    setSearchResults(books);
                }
            } catch (error) {
                console.error("Failed to load search results", error);
            }
        }
        loadSearchResults();

        return () => {
            isActive = false;
        };
    }, [query, getAccessToken, library]);

    const { Content } = Layout;

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <Typography.Title level={3} className="section-title">
                        Resultado da pesquisa
                    </Typography.Title>
                    {searchResults.length === 0 ? (
                        <div className="grid-empty glass-panel">
                            <Empty description="Nenhum resultado encontrado." />
                        </div>
                    ) : (
                        <Row gutter={[20, 20]} className="book-results-grid">
                            {searchResults.map((book) => (
                                <Col key={book.id} xs={24} sm={12} md={8} lg={6}>
                                    <BookCard
                                        book={book}
                                        onClick={() => navigate(`/book/${book.id}`)}
                                    />
                                </Col>
                            ))}
                        </Row>
                    )}
                </section>
            </Content>
        </Layout>
    );
}
