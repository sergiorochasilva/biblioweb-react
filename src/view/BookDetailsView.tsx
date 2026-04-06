import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Card, Descriptions, Divider, Image, Layout, Row, Col, Typography } from "antd";
import book_icon from "../assets/book_icon.png";
import { DEFAULT_PUBLIC_LIBRARY_ID, lendBook, registerBookAccess } from "../service/BookService";
import "../styles/BookDetailsView.css";
import { useAuth } from "../contexts/AuthContext";
import { savePendingLendAction } from "../service/postLoginAction";
import HeaderView from "./HeaderView";

interface BookDetailsViewProps {
    id: string;
    title: string;
    author: string;
    edition: string;
    publisher: string;
    year: string;
    isbn: string;
    pages: string;
    language: string;
    review: string;
    type?: string;
    external_url?: string;
    external_source?: string;
    file_name?: string;
    image_url?: string | null;
}

export default function BookDetailsView({
    id,
    title,
    author,
    edition,
    publisher,
    year,
    isbn,
    pages,
    language,
    review,
    type: bookType,
    external_url,
    external_source,
    file_name,
    image_url,
}: BookDetailsViewProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [loadingLendBook, setLoadingLendBook] = useState(false);
    const { Content } = Layout;
    const { token, library, getAccessToken } = useAuth();
    const { message } = AntdApp.useApp();
    const freeBooksBaseUrl = (import.meta.env.VITE_BOOKS_BASE_URL || "https://storage.googleapis.com/fronesis_bucket/").trim();
    const normalizedFreeBooksBaseUrl = freeBooksBaseUrl.endsWith("/")
        ? freeBooksBaseUrl
        : `${freeBooksBaseUrl}/`;

    function openInNewTab(url: string) {
        const newWindow = window.open(url, "_blank", "noopener,noreferrer");
        if (!newWindow) {
            message.error("Não foi possível abrir a nova aba. Verifique o bloqueio de pop-ups.");
        }
    }

    return (
        <Layout className="page-shell">
            <HeaderView />
            <div className="details-hero glass-panel">
                <Button
                    className="back-button"
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(-1)}
                    aria-label="Voltar"
                />
                <Typography.Title level={4} className="details-title">
                    Detalhes do livro
                </Typography.Title>
            </div>
            <Content className="page-content">
                <Card className="glass-card details-card">
                    <Typography.Title level={4} className="section-details-title">
                        Sobre o livro
                    </Typography.Title>
                    <Row gutter={[24, 24]} className="book-details-grid">
                        <Col xs={24} lg={16}>
                            <Typography.Title level={3} className="book-details-title">
                                {title}
                            </Typography.Title>
                            <Descriptions
                                column={1}
                                size="small"
                                className="book-details-info"
                                labelStyle={{ fontWeight: 600 }}
                            >
                                <Descriptions.Item label="Autor">{author}</Descriptions.Item>
                                <Descriptions.Item label="Edição">{edition}</Descriptions.Item>
                                <Descriptions.Item label="Editora">{publisher}</Descriptions.Item>
                                <Descriptions.Item label="Ano">{year}</Descriptions.Item>
                                <Descriptions.Item label="ISBN">{isbn}</Descriptions.Item>
                                <Descriptions.Item label="Páginas">{pages}</Descriptions.Item>
                                <Descriptions.Item label="Idioma">{language}</Descriptions.Item>
                                <Descriptions.Item label="Fonte Externa">
                                    {external_source ? (
                                        <Typography.Link
                                            href={external_source}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {external_source}
                                        </Typography.Link>
                                    ) : (
                                        "-"
                                    )}
                                </Descriptions.Item>
                            </Descriptions>
                            <Button
                                type="primary"
                                size="large"
                                className="book-details-ler"
                                loading={loadingLendBook}
                                onClick={async () => {
                                    const resolvedType = (bookType || "protected").toLowerCase();
                                    let accessToken: string | undefined = token || undefined;
                                    if (token) {
                                        const refreshedToken = await getAccessToken({ redirectOnFail: false });
                                        accessToken = refreshedToken || token;
                                    }

                                    try {
                                        await registerBookAccess(id, accessToken);
                                    } catch (error) {
                                        console.warn("Failed to register book access", error);
                                    }

                                    if (resolvedType === "external") {
                                        if (!external_url) {
                                            message.error("URL externa não cadastrada para este livro.");
                                            return;
                                        }
                                        openInNewTab(external_url);
                                        return;
                                    }
                                    if (resolvedType === "free") {
                                        if (!file_name) {
                                            message.error("Arquivo não cadastrado para este livro.");
                                            return;
                                        }
                                        openInNewTab(`${normalizedFreeBooksBaseUrl}${file_name}`);
                                        return;
                                    }
                                    const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
                                    if (!token) {
                                        const returnTo = `${location.pathname}${location.search}`;
                                        savePendingLendAction({
                                            type: "lend",
                                            bookId: id,
                                            libraryId,
                                            returnTo,
                                        });
                                        navigate(`/login?next=${encodeURIComponent(returnTo)}`);
                                        return;
                                    }
                                    setLoadingLendBook(true);
                                    try {
                                        const lendingToken = await getAccessToken({ redirectOnFail: false });
                                        if (!lendingToken) {
                                            const returnTo = `${location.pathname}${location.search}`;
                                            savePendingLendAction({
                                                type: "lend",
                                                bookId: id,
                                                libraryId,
                                                returnTo,
                                            });
                                            navigate(`/login?next=${encodeURIComponent(returnTo)}`);
                                            return;
                                        }
                                        await lendBook(id, libraryId, lendingToken);
                                    } catch (error: unknown) {
                                        const messageText =
                                            error instanceof Error && error.message
                                                ? error.message
                                                : "Erro ao solicitar empréstimo.";
                                        message.error(messageText);
                                    } finally {
                                        setLoadingLendBook(false);
                                    }
                                }}
                            >
                                Ler agora
                            </Button>
                        </Col>
                        <Col xs={24} lg={8}>
                            <div className="book-details-cover glass-panel">
                                <Image
                                    src={image_url || book_icon}
                                    alt="Capa do livro"
                                    preview={false}
                                />
                            </div>
                        </Col>
                    </Row>
                    <Divider />
                    <Typography.Title level={4} className="section-details-title">
                        Resenha
                    </Typography.Title>
                    <Typography.Paragraph className="details-review">
                        {review}
                    </Typography.Paragraph>
                </Card>
            </Content>
        </Layout>
    );
}
