import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Empty, Layout, Row, Col, Typography } from "antd";
import { fetchSearchResults } from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "./HeaderView";
import BookCard from "../components/BookCard";
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
