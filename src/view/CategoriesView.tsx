import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Empty, Layout, Select, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    fetchBooksBySubject,
    fetchBookSubjects,
} from "../service/BookService";
import { Book } from "../model/Book";
import HeaderView from "./HeaderView";
import BookCard from "../components/BookCard";
import { useAuth } from "../contexts/AuthContext";
import "../styles/CategoriesView.css";

const MAX_SUBJECTS = 5;

/**
 * Remove itens vazios e duplicados (case-insensitive) da lista de assuntos.
 *
 * @param rawSubjects Lista original retornada pela API.
 * @returns Lista normalizada para uso no seletor.
 */
function normalizeSubjects(rawSubjects: string[]): string[] {
    const map = new Map<string, string>();

    rawSubjects.forEach((subject) => {
        const normalized = subject.trim();
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

export default function CategoriesView() {
    const navigate = useNavigate();
    const { message } = AntdApp.useApp();
    const { Content } = Layout;
    const { getAccessToken, library } = useAuth();

    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [booksBySubject, setBooksBySubject] = useState<Record<string, Book[]>>({});
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
    const [isLoadingBooks, setIsLoadingBooks] = useState(false);

    const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        let isActive = true;

        /**
         * Carrega os assuntos disponíveis da biblioteca selecionada.
         *
         * @returns Promise<void>
         */
        async function loadSubjects(): Promise<void> {
            setIsLoadingSubjects(true);
            try {
                const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
                const accessToken = await getAccessToken({ redirectOnFail: false });
                const subjects = await fetchBookSubjects(libraryId, accessToken || undefined);
                const normalizedSubjects = normalizeSubjects(subjects);

                if (!isActive) {
                    return;
                }

                setAvailableSubjects(normalizedSubjects);
                setSelectedSubjects((previous) => {
                    const filtered = previous.filter((subject) =>
                        normalizedSubjects.includes(subject)
                    );

                    if (filtered.length > 0) {
                        return filtered.slice(0, MAX_SUBJECTS);
                    }

                    return normalizedSubjects.slice(0, MAX_SUBJECTS);
                });
            } catch (error) {
                if (isActive) {
                    message.error("Erro ao carregar categorias.");
                }
                console.error("Failed to load book subjects", error);
            } finally {
                if (isActive) {
                    setIsLoadingSubjects(false);
                }
            }
        }

        loadSubjects();

        return () => {
            isActive = false;
        };
    }, [getAccessToken, library, message]);

    useEffect(() => {
        let isActive = true;

        /**
         * Carrega livros para os assuntos selecionados.
         *
         * @returns Promise<void>
         */
        async function loadBooksBySubject(): Promise<void> {
            if (selectedSubjects.length === 0) {
                setBooksBySubject({});
                setIsLoadingBooks(false);
                return;
            }

            setIsLoadingBooks(true);
            try {
                const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
                const accessToken = await getAccessToken({ redirectOnFail: false });

                const subjectBooks = await Promise.all(
                    selectedSubjects.map(async (subject) => {
                        const books = await fetchBooksBySubject(
                            subject,
                            libraryId,
                            accessToken || undefined
                        );
                        return [subject, books] as const;
                    })
                );

                if (!isActive) {
                    return;
                }

                setBooksBySubject(Object.fromEntries(subjectBooks));
            } catch (error) {
                if (isActive) {
                    message.error("Erro ao carregar livros por categoria.");
                }
                console.error("Failed to load books by subject", error);
            } finally {
                if (isActive) {
                    setIsLoadingBooks(false);
                }
            }
        }

        loadBooksBySubject();

        return () => {
            isActive = false;
        };
    }, [selectedSubjects, getAccessToken, library, message]);

    const subjectOptions = useMemo(
        () =>
            availableSubjects.map((subject) => ({
                value: subject,
                label: subject,
            })),
        [availableSubjects]
    );

    /**
     * Atualiza os assuntos filtrados respeitando o limite máximo de 5.
     *
     * @param values Valores selecionados no componente de multiseleção.
     * @returns void
     */
    const handleSubjectsChange = (values: string[]): void => {
        if (values.length > MAX_SUBJECTS) {
            message.warning("Selecione no máximo 5 assuntos.");
            return;
        }

        setSelectedSubjects(values);
    };

    /**
     * Desloca o carrossel horizontal de um assunto.
     *
     * @param subject Assunto dono do carrossel.
     * @param direction Direção de deslocamento.
     * @returns void
     */
    const handleScroll = (subject: string, direction: "left" | "right"): void => {
        const target = carouselRefs.current[subject];
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
                            Assuntos
                        </Typography.Title>
                    </div>

                    <div className="glass-panel categories-filter-wrap">
                        <Typography.Text className="categories-filter-label">
                            Assuntos exibidos (máx. {MAX_SUBJECTS})
                        </Typography.Text>
                        <Select
                            mode="multiple"
                            value={selectedSubjects}
                            onChange={handleSubjectsChange}
                            options={subjectOptions}
                            className="categories-filter-select"
                            placeholder="Selecione os assuntos"
                            loading={isLoadingSubjects}
                            maxTagCount="responsive"
                            allowClear
                        />
                    </div>

                    {!isLoadingSubjects && availableSubjects.length === 0 && (
                        <div className="glass-panel categories-empty-panel">
                            <Empty description="Nenhuma categoria disponível para esta biblioteca." />
                        </div>
                    )}

                    {selectedSubjects.length === 0 && availableSubjects.length > 0 && (
                        <div className="glass-panel categories-empty-panel">
                            <Empty description="Selecione ao menos um assunto para navegar." />
                        </div>
                    )}

                    {selectedSubjects.map((subject) => {
                        const books = booksBySubject[subject] || [];
                        const isLoadingSection = isLoadingBooks && books.length === 0;

                        return (
                            <section key={subject} className="page-section">
                                <div className="section-header">
                                    <Typography.Title level={4} className="section-title categories-subject-title">
                                        {subject}
                                    </Typography.Title>
                                </div>

                                <div className="carousel-shell glass-panel categories-carousel-shell">
                                    <Button
                                        className="carousel-button left"
                                        icon={<LeftOutlined />}
                                        type="text"
                                        onClick={() => handleScroll(subject, "left")}
                                        aria-label={`Voltar carrossel da categoria ${subject}`}
                                    />

                                    <div
                                        className="book-carousel categories-carousel"
                                        ref={(element) => {
                                            carouselRefs.current[subject] = element;
                                        }}
                                    >
                                        {isLoadingSection && (
                                            <div className="carousel-empty">
                                                <Typography.Text>Carregando...</Typography.Text>
                                            </div>
                                        )}

                                        {!isLoadingSection && books.length === 0 && (
                                            <div className="carousel-empty">
                                                <Empty description="Nenhum livro encontrado neste assunto." />
                                            </div>
                                        )}

                                        {books.map((book) => (
                                            <BookCard
                                                key={`${subject}-${book.id}`}
                                                book={book}
                                                onClick={() => navigate(`/book/${book.id}`)}
                                            />
                                        ))}
                                    </div>

                                    <Button
                                        className="carousel-button right"
                                        icon={<RightOutlined />}
                                        type="text"
                                        onClick={() => handleScroll(subject, "right")}
                                        aria-label={`Avançar carrossel da categoria ${subject}`}
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
