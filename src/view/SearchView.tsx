import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, Col, Empty, Layout, Row, Skeleton, Typography } from "antd";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    fetchSemanticSearchResults,
} from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "./HeaderView";
import BookCard from "../components/BookCard";
import "../styles/SearchView.css";
import { useAuth } from "../contexts/useAuth";

/**
 * Renderiza a tela de busca pública com resultados semânticos e feedback visual de carregamento.
 *
 * Returns:
 *   JSX da página de busca.
 */
export default function SearchView() {
    const navigate = useNavigate();
    const [searchResults, setSearchResults] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const query = searchParams.get("query") || ""; // "" se não existir
    const normalizedQuery = query.trim();
    const { getAccessToken, library } = useAuth();

    useEffect(() => {
        let isActive = true;

        async function loadSearchResults() {
            if (!normalizedQuery) {
                if (isActive) {
                    setSearchResults([]);
                    setIsLoading(false);
                }
                return;
            }
            if (isActive) {
                setIsLoading(true);
                setSearchResults([]);
            }
            try {
                const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
                const accessToken = await getAccessToken();
                const books = await fetchSemanticSearchResults(
                    normalizedQuery,
                    libraryId,
                    accessToken || undefined,
                    20,
                );
                if (isActive) {
                    setSearchResults(books);
                }
            } catch (error) {
                console.error("Failed to load search results", error);
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
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
                    {!normalizedQuery ? (
                        <div className="grid-empty glass-panel">
                            <Empty description="Digite um termo para iniciar a pesquisa." />
                        </div>
                    ) : isLoading ? (
                        <Row
                            gutter={[20, 20]}
                            className="book-results-grid search-loading-grid"
                            aria-busy="true"
                            aria-live="polite"
                        >
                            {Array.from({ length: 8 }, (_, index) => (
                                <Col key={`search-skeleton-${index}`} xs={24} sm={12} md={8} lg={6}>
                                    <SearchResultSkeletonCard />
                                </Col>
                            ))}
                        </Row>
                    ) : searchResults.length === 0 ? (
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

/**
 * Renderiza um card esqueleto com shimmer para indicar pesquisa em andamento.
 *
 * Returns:
 *   JSX do card placeholder.
 */
function SearchResultSkeletonCard() {
    return (
        <Card
            className="glass-card book-card search-skeleton-card"
            cover={
                <div className="book-card-cover search-skeleton-cover">
                    <Skeleton.Image active />
                </div>
            }
        >
            <div className="search-skeleton-meta">
                <Skeleton active title={{ width: "78%" }} paragraph={{ rows: 2 }} />
            </div>
        </Card>
    );
}
