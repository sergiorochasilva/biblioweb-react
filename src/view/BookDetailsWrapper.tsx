import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Layout, Result, Spin, Typography } from "antd";
import { fetchBookDetails } from "../service/BookService";
import BookDetailsView from "./BookDetailsView";
import { Book } from "../model/Book";

export default function BookDetailsWrapper() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const { Content } = Layout;

    useEffect(() => {
        if (id) {
            setLoading(true);
            fetchBookDetails(id)
                .then((b) => setBook(b))
                .finally(() => setLoading(false));
        }
    }, [id]);

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
