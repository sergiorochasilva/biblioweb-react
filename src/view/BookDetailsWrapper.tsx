import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Layout, Result, Spin, Typography } from "antd";
import { DEFAULT_PUBLIC_LIBRARY_ID, fetchBookDetails } from "../service/BookService";
import BookDetailsView from "./BookDetailsView";
import { Book } from "../model/Book";
import { useAuth } from "../contexts/useAuth";
import HeaderView from "./HeaderView";

export default function BookDetailsWrapper() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const { Content } = Layout;
    const { getAccessToken, library } = useAuth();
    const isMountedRef = useRef(true);

    const loadBook = useCallback(async () => {
        if (!id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
        try {
            const accessToken = await getAccessToken();
            const loadedBook = await fetchBookDetails(
                id,
                libraryId,
                accessToken || undefined
            );
            if (isMountedRef.current) {
                setBook(loadedBook);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [getAccessToken, id, library]);

    useEffect(() => {
        isMountedRef.current = true;
        if (id) {
            void loadBook();
        }

        return () => {
            isMountedRef.current = false;
        };
    }, [id, loadBook]);

    if (loading) {
        return (
            <Layout className="page-shell">
                <HeaderView />
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
                <HeaderView />
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
    return (
        <BookDetailsView
            id={book.id}
            title={book.title}
            subtitle={book.subtitle}
            original_title={book.original_title}
            corporate_author={book.corporate_author}
            author={book.author}
            authors={book.authors}
            edition={book.edition}
            publisher={book.publisher}
            publication_place={book.publication_place}
            dewey_decimal={book.dewey_decimal}
            year={book.year}
            isbn={book.isbn}
            pages={book.pages}
            language={book.language}
            summary={book.summary}
            general_note={book.general_note}
            bibliography_note={book.bibliography_note}
            content_type={book.content_type}
            media_type={book.media_type}
            carrier_type={book.carrier_type}
            subjects={book.subjects}
            type={book.type}
            external_url={book.external_url}
            external_source={book.external_source}
            html_version_url={book.html_version_url}
            file_name={book.file_name}
            image_url={book.image_url}
            loan_state={book.loan_state}
            loan_expires_at={book.loan_expires_at}
            last_access_at={book.last_access_at}
            current_book_active_licenses={book.current_book_active_licenses}
            available_licenses={book.available_licenses}
            current_user_active_loans={book.current_user_active_loans}
            max_concurrent_loans={book.max_concurrent_loans}
            unavailable_users_count={book.unavailable_users_count}
            onReloadBook={() => {
                void loadBook();
            }}
        />
    );
}
