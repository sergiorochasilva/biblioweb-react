import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Layout, Result, Spin, Typography } from "antd";
import { DEFAULT_PUBLIC_LIBRARY_ID, fetchBookDetails } from "../service/BookService";
import BookDetailsView from "./BookDetailsView";
import { Book } from "../model/Book";
import { useAuth } from "../contexts/AuthContext";

export default function BookDetailsWrapper() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const { Content } = Layout;
    const { getAccessToken, library } = useAuth();

    useEffect(() => {
        let isActive = true;

        if (id) {
            setLoading(true);
            const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
            (async () => {
                try {
                    const accessToken = await getAccessToken();
                    const loadedBook = await fetchBookDetails(
                        id,
                        libraryId,
                        accessToken || undefined
                    );
                    if (isActive) {
                        setBook(loadedBook);
                    }
                } finally {
                    if (isActive) {
                        setLoading(false);
                    }
                }
            })();
        }

        return () => {
            isActive = false;
        };
    }, [id, getAccessToken, library]);

    if (loading) {
        return (
            <Layout className="page-shell">
                <Content className="page-content">
                    <Card className="glass-card state-card">
                        <div className="loading-state">
                            <Spin size="large" />
                            <Typography.Text>Carregando detalhes...</Typography.Text>
                        </div>
                    </Card>
                </Content>
            </Layout>
        );
    }

    if (!book) {
        return (
            <Layout className="page-shell">
                <Content className="page-content">
                    <Card className="glass-card state-card">
                        <Result
                            status="404"
                            title="Livro não encontrado"
                            subTitle="Verifique se o link está correto."
                            extra={(
                                <Button type="primary" onClick={() => navigate("/")}>Voltar para a home</Button>
                            )}
                        />
                    </Card>
                </Content>
            </Layout>
        );
    }

    // repassa todas as props do livro para o BookDetailsView
    return <BookDetailsView
        id={book.id}
        title={book.title}
        author={book.author}
        edition={book.edition}
        publisher={book.publisher}
        year={book.year}
        isbn={book.isbn}
        pages={book.pages}
        language={book.language}
        review={book.review}
        image_url={book.image_url}
    />;
}
