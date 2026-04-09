import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Empty, Layout, Select, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    fetchBookAuthors,
    fetchBooksByAuthor,
} from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "./HeaderView";
import BookCard from "../components/BookCard";
import { useAuth } from "../contexts/AuthContext";
import "../styles/CategoriesView.css";

const MAX_AUTHORS = 5;

/**
 * Remove itens vazios e duplicados (case-insensitive) da lista de autores.
 *
 * @param rawAuthors Lista original retornada pela API.
 * @returns Lista normalizada para uso no seletor.
 */
function normalizeAuthors(rawAuthors: string[]): string[] {
    const map = new Map<string, string>();

    rawAuthors.forEach((author) => {
        const normalized = author.trim();
        if (!normalized) {
            return;
        }

        const key = normalized.toLowerCase();
        if (!map.has(key)) {
            map.set(key, normalized);
        }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

export default function AuthorsView() {
    const navigate = useNavigate();
    const { message } = AntdApp.useApp();
    const { Content } = Layout;
    const { getAccessToken, library } = useAuth();

    const [availableAuthors, setAvailableAuthors] = useState<string[]>([]);
    const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
    const [booksByAuthor, setBooksByAuthor] = useState<Record<string, Book[]>>({});
    const [isLoadingAuthors, setIsLoadingAuthors] = useState(false);
    const [isLoadingBooks, setIsLoadingBooks] = useState(false);

    const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        let isActive = true;

        /**
         * Carrega os autores disponíveis da biblioteca selecionada.
         *
         * @returns Promise<void>
         */
        async function loadAuthors(): Promise<void> {
            setIsLoadingAuthors(true);
            try {
                const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
                const accessToken = await getAccessToken({ redirectOnFail: false });
                const authors = await fetchBookAuthors(libraryId, accessToken || undefined);
                const normalizedAuthors = normalizeAuthors(authors);

                if (!isActive) {
                    return;
                }

                setAvailableAuthors(normalizedAuthors);
                setSelectedAuthors((previous) => {
                    const filtered = previous.filter((author) =>
                        normalizedAuthors.includes(author)
                    );

                    if (filtered.length > 0) {
                        return filtered.slice(0, MAX_AUTHORS);
                    }

                    return normalizedAuthors.slice(0, MAX_AUTHORS);
                });
            } catch (error) {
                if (isActive) {
                    message.error("Erro ao carregar autores.");
                }
                console.error("Failed to load book authors", error);
            } finally {
                if (isActive) {
                    setIsLoadingAuthors(false);
                }
            }
        }

        void loadAuthors();

        return () => {
            isActive = false;
        };
    }, [getAccessToken, library, message]);

    useEffect(() => {
        let isActive = true;

        /**
         * Carrega livros para os autores selecionados.
         *
         * @returns Promise<void>
         */
        async function loadBooksByAuthor(): Promise<void> {
            if (selectedAuthors.length === 0) {
                setBooksByAuthor({});
                setIsLoadingBooks(false);
                return;
            }

            setIsLoadingBooks(true);
            try {
                const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
                const accessToken = await getAccessToken({ redirectOnFail: false });

                const authorBooks = await Promise.all(
                    selectedAuthors.map(async (author) => {
                        const books = await fetchBooksByAuthor(
                            author,
                            libraryId,
                            accessToken || undefined
                        );
                        return [author, books] as const;
                    })
                );

                if (!isActive) {
                    return;
                }

                setBooksByAuthor(Object.fromEntries(authorBooks));
            } catch (error) {
                if (isActive) {
                    message.error("Erro ao carregar livros por autor.");
                }
                console.error("Failed to load books by author", error);
            } finally {
                if (isActive) {
                    setIsLoadingBooks(false);
                }
            }
        }

        void loadBooksByAuthor();

        return () => {
            isActive = false;
        };
    }, [selectedAuthors, getAccessToken, library, message]);

    const authorOptions = useMemo(
        () =>
            availableAuthors.map((author) => ({
                value: author,
                label: author,
            })),
        [availableAuthors]
    );

    /**
     * Atualiza os autores filtrados respeitando o limite máximo de 5.
     *
     * @param values Valores selecionados no componente de multiseleção.
     * @returns void
     */
    const handleAuthorsChange = (values: string[]): void => {
        if (values.length > MAX_AUTHORS) {
            message.warning("Selecione no máximo 5 autores.");
            return;
        }

        setSelectedAuthors(values);
    };

    /**
     * Desloca o carrossel horizontal de um autor.
     *
     * @param author Autor dono do carrossel.
     * @param direction Direção de deslocamento.
     * @returns void
     */
    const handleScroll = (author: string, direction: "left" | "right"): void => {
        const target = carouselRefs.current[author];
        if (!target) {
            return;
        }

        target.scrollBy({
            left: direction === "left" ? -320 : 320,
            behavior: "smooth",
        });
    };

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <div className="section-header">
                        <Typography.Title level={3} className="section-title">
                            Autores
                        </Typography.Title>
                    </div>

                    <div className="glass-panel categories-filter-wrap">
                        <Typography.Text className="categories-filter-label">
                            Autores exibidos (máx. {MAX_AUTHORS})
                        </Typography.Text>
                        <Select
                            mode="multiple"
                            value={selectedAuthors}
                            onChange={handleAuthorsChange}
                            options={authorOptions}
                            className="categories-filter-select"
                            placeholder="Selecione os autores"
                            loading={isLoadingAuthors}
                            maxTagCount="responsive"
                            allowClear
                        />
                    </div>

                    {!isLoadingAuthors && availableAuthors.length === 0 && (
                        <div className="glass-panel categories-empty-panel">
                            <Empty description="Nenhum autor disponível para esta biblioteca." />
                        </div>
                    )}

                    {selectedAuthors.length === 0 && availableAuthors.length > 0 && (
                        <div className="glass-panel categories-empty-panel">
                            <Empty description="Selecione ao menos um autor para navegar." />
                        </div>
                    )}

                    {selectedAuthors.map((author) => {
                        const books = booksByAuthor[author] || [];
                        const isLoadingSection = isLoadingBooks && books.length === 0;

                        return (
                            <section key={author} className="page-section">
                                <div className="section-header">
                                    <Typography.Title level={4} className="section-title categories-subject-title">
                                        {author}
                                    </Typography.Title>
                                </div>

                                <div className="carousel-shell glass-panel categories-carousel-shell">
                                    <Button
                                        className="carousel-button left"
                                        icon={<LeftOutlined />}
                                        type="text"
                                        onClick={() => handleScroll(author, "left")}
                                        aria-label={`Voltar carrossel do autor ${author}`}
                                    />

                                    <div
                                        className="book-carousel categories-carousel"
                                        ref={(element) => {
                                            carouselRefs.current[author] = element;
                                        }}
                                    >
                                        {isLoadingSection && (
                                            <div className="carousel-empty">
                                                <Typography.Text>Carregando...</Typography.Text>
                                            </div>
                                        )}

                                        {!isLoadingSection && books.length === 0 && (
                                            <div className="carousel-empty">
                                                <Empty description="Nenhum livro encontrado para este autor." />
                                            </div>
                                        )}

                                        {books.map((book) => (
                                            <BookCard
                                                key={`${author}-${book.id}`}
                                                book={book}
                                                onClick={() => navigate(`/book/${book.id}`)}
                                            />
                                        ))}
                                    </div>

                                    <Button
                                        className="carousel-button right"
                                        icon={<RightOutlined />}
                                        type="text"
                                        onClick={() => handleScroll(author, "right")}
                                        aria-label={`Avançar carrossel do autor ${author}`}
                                    />
                                </div>
                            </section>
                        );
                    })}
                </section>
            </Content>
        </Layout>
    );
}
