import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Layout, Result, Spin, Typography } from "antd";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    downloadPurchasedBook,
    fetchBookDetails,
} from "../service/BookService";
import BookDetailsView from "./BookDetailsView";
import { Book } from "../model/Book";
import { useAuth } from "../contexts/useAuth";
import HeaderView from "./HeaderView";

export default function BookDetailsWrapper() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const { Content } = Layout;
    const { token, getAccessToken, library } = useAuth();
    const isMountedRef = useRef(true);
    const checkoutHandledRef = useRef(false);

    const loadBook = useCallback(async () => {
        if (!id) {
            setLoading(false);
            return null;
        }

        setLoading(true);
        const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
        try {
            const accessToken = token ? await getAccessToken() : undefined;
            const loadedBook = await fetchBookDetails(
                id,
                libraryId,
                accessToken || undefined
            );
            if (isMountedRef.current) {
                setBook(loadedBook);
            }
            return loadedBook;
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [getAccessToken, id, library, token]);

    const checkoutPollingEnabled =
        new URLSearchParams(location.search).get("pooling_checkout") === "true";

    const clearCheckoutQuery = useCallback((): void => {
        navigate(
            {
                pathname: location.pathname,
                search: "",
            },
            { replace: true }
        );
    }, [location.pathname, navigate]);

    const downloadPurchasedCopy = useCallback(async (): Promise<void> => {
        if (!book) {
            return;
        }

        const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
        const accessToken = await getAccessToken();
        if (!accessToken) {
            navigate(`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
            return;
        }

        try {
            await downloadPurchasedBook(book.id, libraryId, accessToken);
        } catch (error) {
            console.error("Failed to download purchased copy after checkout", error);
        } finally {
            clearCheckoutQuery();
        }
    }, [book, clearCheckoutQuery, getAccessToken, library, location.pathname, location.search, navigate]);

    useEffect(() => {
        isMountedRef.current = true;
        if (id) {
            void loadBook();
        }

        return () => {
            isMountedRef.current = false;
        };
    }, [id, loadBook]);

    useEffect(() => {
        if (!checkoutPollingEnabled || !book || checkoutHandledRef.current) {
            return;
        }

        if (book.purchased_by_user) {
            checkoutHandledRef.current = true;
            void downloadPurchasedCopy();
            return;
        }

        let cancelled = false;

        async function pollCheckout(): Promise<void> {
            for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 3000));
                if (cancelled) {
                    return;
                }

                const refreshedBook = await loadBook();
                if (cancelled) {
                    return;
                }

                if (refreshedBook?.purchased_by_user) {
                    checkoutHandledRef.current = true;
                    await downloadPurchasedCopy();
                    return;
                }
            }

            if (!cancelled) {
                clearCheckoutQuery();
            }
        }

        void pollCheckout();

        return () => {
            cancelled = true;
        };
    }, [book, clearCheckoutQuery, checkoutPollingEnabled, downloadPurchasedCopy, loadBook]);

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
            preco_sugerido={book.preco_sugerido}
            preco_compra={book.preco_compra}
            loan_state={book.loan_state}
            loan_expires_at={book.loan_expires_at}
            last_access_at={book.last_access_at}
            current_book_active_licenses={book.current_book_active_licenses}
            available_licenses={book.available_licenses}
            current_user_active_loans={book.current_user_active_loans}
            max_concurrent_loans={book.max_concurrent_loans}
            unavailable_users_count={book.unavailable_users_count}
            purchased_by_user={book.purchased_by_user}
            purchase_license_id={book.purchase_license_id}
            purchase_issued_at={book.purchase_issued_at}
            onReloadBook={() => {
                void loadBook();
            }}
        />
    );
}
