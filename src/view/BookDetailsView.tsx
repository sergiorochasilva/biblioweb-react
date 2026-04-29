import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeftOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import {
    App as AntdApp,
    Button,
    Card,
    Col,
    Descriptions,
    Divider,
    Image,
    Layout,
    Modal,
    Row,
    Typography,
} from "antd";
import book_icon from "../assets/book_icon.png";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    fetchBookMarc21,
    formatMarc21Record,
    lendBook,
    registerBookAccess,
} from "../service/BookService";
import { getBookAuthorsText } from "../model/Book";
import BookTypeTag from "../components/BookTypeTag";
import "../styles/BookDetailsView.css";
import { useAuth } from "../contexts/AuthContext";
import { savePendingLendAction } from "../service/postLoginAction";
import HeaderView from "./HeaderView";

interface BookDetailsViewProps {
    id: string;
    title: string;
    subtitle?: string;
    original_title?: string;
    corporate_author?: string;
    author?: string;
    authors?: Array<{ author: number; author_name?: string }>;
    edition: string;
    publisher: string;
    publication_place?: string;
    dewey_decimal?: string;
    year: string;
    isbn: string;
    pages: string;
    language: string;
    summary?: string;
    general_note?: string;
    bibliography_note?: string;
    content_type?: string;
    media_type?: string;
    carrier_type?: string;
    subjects?: Array<{ subject: number; subject_name?: string }>;
    type?: string;
    external_url?: string;
    external_source?: string;
    file_name?: string;
    image_url?: string | null;
}

type ReferenceFormat = "apa" | "abnt";

interface BibliographicReferenceInput {
    title: string;
    subtitle?: string;
    author?: string;
    authors?: Array<{ author: number; author_name?: string }>;
    edition?: string;
    publisher?: string;
    publication_place?: string;
    year?: string;
}

/**
 * Remove espaços extras e normaliza campos textuais opcionais.
 *
 * @param value Valor de entrada.
 * @returns String limpa ou vazia.
 */
function normalizeFieldValue(value?: string): string {
    return typeof value === "string" ? value.trim() : "";
}

/**
 * Garante pontuação final em segmentos textuais de referência.
 *
 * @param value Valor textual sem formatação final.
 * @returns Valor terminado com ponto.
 */
function ensureTrailingPeriod(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
        return "";
    }
    return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

/**
 * Resolve autores priorizando relacionamento `authors`.
 *
 * @param author Autor legado em string.
 * @param authors Relação de autores do livro.
 * @returns Lista deduplicada de autores.
 */
function resolveAuthorNames(
    author?: string,
    authors?: Array<{ author: number; author_name?: string }>
): string[] {
    const relationalAuthors = Array.isArray(authors)
        ? authors
              .map((item) => normalizeFieldValue(item?.author_name))
              .filter((item) => Boolean(item))
        : [];

    const rawNames =
        relationalAuthors.length > 0
            ? relationalAuthors
            : normalizeFieldValue(author)
            ? normalizeFieldValue(author).split(/\s*;\s*|\s+\/\s+/)
            : [];

    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const rawName of rawNames) {
        const normalized = normalizeFieldValue(rawName);
        if (!normalized) {
            continue;
        }
        const key = normalized.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(normalized);
    }

    return deduped;
}

/**
 * Formata um autor para estilo APA.
 *
 * @param authorName Nome completo do autor.
 * @returns Nome formatado em estilo APA.
 */
function formatApaAuthor(authorName: string): string {
    const parts = authorName.split(/\s+/).filter((item) => Boolean(item));
    if (parts.length === 0) {
        return "";
    }
    if (parts.length === 1) {
        return parts[0];
    }
    const lastName = parts[parts.length - 1];
    const initials = parts
        .slice(0, -1)
        .map((item) => `${item[0]?.toUpperCase()}.`)
        .join(" ");
    return initials ? `${lastName}, ${initials}` : lastName;
}

/**
 * Formata lista de autores para APA.
 *
 * @param authorNames Lista de autores.
 * @returns Texto de autores no padrão APA.
 */
function formatApaAuthors(authorNames: string[]): string {
    const formatted = authorNames
        .map((item) => formatApaAuthor(item))
        .filter((item) => Boolean(item));

    if (formatted.length === 0) {
        return "";
    }
    if (formatted.length === 1) {
        return formatted[0];
    }
    if (formatted.length === 2) {
        return `${formatted[0]} & ${formatted[1]}`;
    }
    return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
}

/**
 * Formata um autor para estilo ABNT.
 *
 * @param authorName Nome completo do autor.
 * @returns Nome formatado em estilo ABNT.
 */
function formatAbntAuthor(authorName: string): string {
    const parts = authorName.split(/\s+/).filter((item) => Boolean(item));
    if (parts.length === 0) {
        return "";
    }
    if (parts.length === 1) {
        return parts[0].toUpperCase();
    }
    const lastName = parts[parts.length - 1].toUpperCase();
    const firstNames = parts.slice(0, -1).join(" ");
    return firstNames ? `${lastName}, ${firstNames}` : lastName;
}

/**
 * Monta título completo a partir de título e subtítulo.
 *
 * @param title Título principal.
 * @param subtitle Subtítulo opcional.
 * @returns Título completo sem campos vazios.
 */
function composeBookTitle(title: string, subtitle?: string): string {
    const normalizedTitle = normalizeFieldValue(title);
    const normalizedSubtitle = normalizeFieldValue(subtitle);
    if (!normalizedTitle && !normalizedSubtitle) {
        return "";
    }
    if (!normalizedSubtitle) {
        return normalizedTitle;
    }
    if (!normalizedTitle) {
        return normalizedSubtitle;
    }
    return `${normalizedTitle}: ${normalizedSubtitle}`;
}

/**
 * Formata referência bibliográfica no formato solicitado.
 *
 * @param input Metadados do livro.
 * @param format Formato bibliográfico (`apa` ou `abnt`).
 * @returns Referência formatada.
 */
function formatBibliographicReference(
    input: BibliographicReferenceInput,
    format: ReferenceFormat
): string {
    const authorNames = resolveAuthorNames(input.author, input.authors);
    const title = composeBookTitle(input.title, input.subtitle);
    const edition = normalizeFieldValue(input.edition);
    const publisher = normalizeFieldValue(input.publisher);
    const publicationPlace = normalizeFieldValue(input.publication_place);
    const year = normalizeFieldValue(input.year);

    if (format === "apa") {
        const segments: string[] = [];
        const authorsText = formatApaAuthors(authorNames);
        if (authorsText) {
            segments.push(ensureTrailingPeriod(authorsText));
        }
        if (year) {
            segments.push(`(${year}).`);
        }
        if (title) {
            const titleSegment = edition ? `${title} (${edition}).` : ensureTrailingPeriod(title);
            segments.push(titleSegment);
        }
        if (publisher) {
            segments.push(ensureTrailingPeriod(publisher));
        }
        return segments.join(" ").trim();
    }

    const segments: string[] = [];
    if (authorNames.length > 0) {
        const abntAuthors = authorNames
            .map((item) => formatAbntAuthor(item))
            .filter((item) => Boolean(item))
            .join("; ");
        if (abntAuthors) {
            segments.push(ensureTrailingPeriod(abntAuthors));
        }
    }
    if (title) {
        segments.push(ensureTrailingPeriod(title));
    }
    if (edition) {
        const editionSegment = /ed\.?$/i.test(edition) ? edition : `${edition} ed.`;
        segments.push(ensureTrailingPeriod(editionSegment));
    }

    const publicationSegments = [publicationPlace, publisher].filter((item) => Boolean(item));
    let publicationText = "";
    if (publicationSegments.length === 2) {
        publicationText = `${publicationSegments[0]}: ${publicationSegments[1]}`;
    } else if (publicationSegments.length === 1) {
        publicationText = publicationSegments[0];
    }
    if (year) {
        publicationText = publicationText ? `${publicationText}, ${year}` : year;
    }
    if (publicationText) {
        segments.push(ensureTrailingPeriod(publicationText));
    }

    return segments.join(" ").trim();
}

export default function BookDetailsView({
    id,
    title,
    subtitle,
    original_title,
    corporate_author,
    author,
    authors,
    edition,
    publisher,
    publication_place,
    dewey_decimal,
    year,
    isbn,
    pages,
    language,
    summary,
    general_note,
    bibliography_note,
    content_type,
    media_type,
    carrier_type,
    subjects,
    type: bookType,
    external_url,
    external_source,
    file_name,
    image_url,
}: BookDetailsViewProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [loadingLendBook, setLoadingLendBook] = useState(false);
    const [loadingMarcExport, setLoadingMarcExport] = useState(false);
    const [isMarcModalOpen, setIsMarcModalOpen] = useState(false);
    const [marcContent, setMarcContent] = useState("");
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
    const [referenceFormat, setReferenceFormat] = useState<ReferenceFormat>("apa");
    const { Content } = Layout;
    const { token, library, getAccessToken } = useAuth();
    const { message } = AntdApp.useApp();
    const resolvedType = (bookType || "protected").toLowerCase();
    const freeBooksBaseUrl = (import.meta.env.VITE_BOOKS_BASE_URL || "https://storage.googleapis.com/fronesis_bucket/").trim();
    const normalizedFreeBooksBaseUrl = freeBooksBaseUrl.endsWith("/")
        ? freeBooksBaseUrl
        : `${freeBooksBaseUrl}/`;
    const resolvedSubjects = Array.isArray(subjects)
        ? subjects
              .map((item) => (typeof item?.subject_name === "string" ? item.subject_name.trim() : ""))
              .filter((item) => Boolean(item))
        : [];
    const subjectsText =
        resolvedSubjects.length > 0
            ? resolvedSubjects.join(", ")
            : "-";
    const authorsText = getBookAuthorsText({
        author,
        authors,
    });
    const bibliographyReference = formatBibliographicReference(
        {
            title,
            subtitle,
            author,
            authors,
            edition,
            publisher,
            publication_place,
            year,
        },
        referenceFormat
    );

    /**
     * Abre links externos do livro em nova aba com proteção de opener.
     *
     * @param url URL de destino.
     */
    function openInNewTab(url: string) {
        const newWindow = window.open(url, "_blank", "noopener,noreferrer");
        if (!newWindow) {
            message.error("Não foi possível abrir a nova aba. Verifique o bloqueio de pop-ups.");
        }
    }

    /**
     * Consulta o registro MARC21 do livro atual e abre o modal de visualização.
     */
    async function openMarcModal(): Promise<void> {
        setLoadingMarcExport(true);
        try {
            const marcRecord = await fetchBookMarc21(id);
            setMarcContent(formatMarc21Record(marcRecord));
            setIsMarcModalOpen(true);
        } catch (error: unknown) {
            const messageText =
                error instanceof Error && error.message
                    ? error.message
                    : "Erro ao exportar o MARC21 do livro.";
            message.error(messageText);
        } finally {
            setLoadingMarcExport(false);
        }
    }

    /**
     * Copia o conteúdo MARC21 para a área de transferência.
     */
    async function copyMarcToClipboard(): Promise<void> {
        const payload = marcContent.trim();
        if (!payload) {
            message.warning("Não há conteúdo MARC21 para copiar.");
            return;
        }

        try {
            await navigator.clipboard.writeText(payload);
            message.success("MARC21 copiado para a área de transferência.");
        } catch {
            const hiddenTextarea = document.createElement("textarea");
            hiddenTextarea.value = payload;
            hiddenTextarea.style.position = "fixed";
            hiddenTextarea.style.opacity = "0";
            document.body.appendChild(hiddenTextarea);
            hiddenTextarea.focus();
            hiddenTextarea.select();
            document.execCommand("copy");
            document.body.removeChild(hiddenTextarea);
            message.success("MARC21 copiado para a área de transferência.");
        }
    }

    /**
     * Copia a referência bibliográfica formatada para a área de transferência.
     */
    async function copyReferenceToClipboard(): Promise<void> {
        const payload = bibliographyReference.trim();
        if (!payload) {
            message.warning("Não há referência bibliográfica para copiar.");
            return;
        }

        try {
            await navigator.clipboard.writeText(payload);
            message.success("Referência bibliográfica copiada para a área de transferência.");
        } catch {
            const hiddenTextarea = document.createElement("textarea");
            hiddenTextarea.value = payload;
            hiddenTextarea.style.position = "fixed";
            hiddenTextarea.style.opacity = "0";
            document.body.appendChild(hiddenTextarea);
            hiddenTextarea.focus();
            hiddenTextarea.select();
            document.execCommand("copy");
            document.body.removeChild(hiddenTextarea);
            message.success("Referência bibliográfica copiada para a área de transferência.");
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
                                <Descriptions.Item label={<>Título <span className="marc-chip">245$a</span></>}>
                                    {title || "-"}
                                </Descriptions.Item>
                                <Descriptions.Item label={<>Subtítulo <span className="marc-chip">246$a</span></>}>
                                    {subtitle || "-"}
                                </Descriptions.Item>
                                <Descriptions.Item label={<>Título original <span className="marc-chip">240$a</span></>}>
                                    {original_title || "-"}
                                </Descriptions.Item>
                                <Descriptions.Item label={<>Autor <span className="marc-chip">100$a</span></>}>
                                    {authorsText || "-"}
                                </Descriptions.Item>
                                <Descriptions.Item label={<>Autor Pessoa Jurídica <span className="marc-chip">110$a</span></>}>
                                    {corporate_author || "-"}
                                </Descriptions.Item>
                                <Descriptions.Item label={<>Edição <span className="marc-chip">250$a</span></>}>{edition}</Descriptions.Item>
                                <Descriptions.Item label={<>Editora <span className="marc-chip">260$b</span></>}>{publisher}</Descriptions.Item>
                                <Descriptions.Item label={<>Local de Publicação <span className="marc-chip">260$a</span></>}>{publication_place || "-"}</Descriptions.Item>
                                <Descriptions.Item label={<>Data de publicação <span className="marc-chip">260$c</span></>}>{year}</Descriptions.Item>
                                <Descriptions.Item label={<>ISBN <span className="marc-chip">020$a</span></>}>{isbn}</Descriptions.Item>
                                <Descriptions.Item label="Páginas">{pages}</Descriptions.Item>
                                <Descriptions.Item label={<>Idioma <span className="marc-chip">041$a</span></>}>{language}</Descriptions.Item>
                                <Descriptions.Item label={<>Assuntos <span className="marc-chip">650$a</span></>}>{subjectsText}</Descriptions.Item>
                                <Descriptions.Item label={<>CDD <span className="marc-chip">082$a</span></>}>{dewey_decimal || "-"}</Descriptions.Item>
                                <Descriptions.Item label={<>Tipo de conteúdo <span className="marc-chip">336$a</span></>}>{content_type || "-"}</Descriptions.Item>
                                <Descriptions.Item label={<>Tipo de mídia <span className="marc-chip">337$a</span></>}>{media_type || "-"}</Descriptions.Item>
                                <Descriptions.Item label={<>Tipo de suporte <span className="marc-chip">338$a</span></>}>{carrier_type || "-"}</Descriptions.Item>
                                <Descriptions.Item label={<>Fonte Externa <span className="marc-chip">500$a</span></>}>
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
                        </Col>
                        <Col xs={24} lg={8}>
                            <div className="book-details-sidebar">
                                <div className="book-details-cover glass-panel">
                                    <BookTypeTag type={bookType} className="book-details-type-tag" />
                                    <Image
                                        src={image_url || book_icon}
                                        alt="Capa do livro"
                                        preview={false}
                                    />
                                </div>
                                <div className="book-details-actions">
                                    <Button
                                        type="primary"
                                        size="large"
                                        className="book-details-ler"
                                        loading={loadingLendBook}
                                        onClick={async () => {
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
                                    {resolvedType === "protected" && (
                                        <Button
                                            type="default"
                                            size="large"
                                            className="book-details-help"
                                            icon={<QuestionCircleOutlined />}
                                            onClick={() => {
                                                openInNewTab("/pos-download/manual.html");
                                            }}
                                            aria-label="Abrir instruções de leitura"
                                        />
                                    )}
                                </div>
                                <Button
                                    size="large"
                                    className="book-details-secondary"
                                    loading={loadingMarcExport}
                                    onClick={() => {
                                        void openMarcModal();
                                    }}
                                >
                                    Exportar MARC21
                                </Button>
                                <Button
                                    size="large"
                                    className="book-details-secondary"
                                    onClick={() => {
                                        setReferenceFormat("apa");
                                        setIsReferenceModalOpen(true);
                                    }}
                                >
                                    Referência Bibliográfica
                                </Button>
                            </div>
                        </Col>
                    </Row>
                    <Divider />
                    <Typography.Title level={4} className="section-details-title">
                        Resumo
                        <span className="marc-chip">[520$a]</span>
                    </Typography.Title>
                    <Typography.Paragraph className="details-review">
                        {summary || "-"}
                    </Typography.Paragraph>
                    <Typography.Title level={4} className="section-details-title">
                        Nota Geral
                        <span className="marc-chip">[500$a]</span>
                    </Typography.Title>
                    <Typography.Paragraph className="details-review">
                        {general_note || "-"}
                    </Typography.Paragraph>
                    <Typography.Title level={4} className="section-details-title">
                        Nota de Bibliografia
                        <span className="marc-chip">[504$a]</span>
                    </Typography.Title>
                    <Typography.Paragraph className="details-review">
                        {bibliography_note || "-"}
                    </Typography.Paragraph>
                </Card>
            </Content>
            <Modal
                title="Exportar MARC21"
                open={isMarcModalOpen}
                onCancel={() => setIsMarcModalOpen(false)}
                width={760}
                footer={[
                    <Button
                        key="copy"
                        type="primary"
                        onClick={() => {
                            void copyMarcToClipboard();
                        }}
                    >
                        Copiar
                    </Button>,
                    <Button key="close" onClick={() => setIsMarcModalOpen(false)}>
                        Fechar
                    </Button>,
                ]}
            >
                <pre className="book-details-marc-content">{marcContent || "-"}</pre>
            </Modal>
            <Modal
                title="Referência Bibliográfica"
                open={isReferenceModalOpen}
                onCancel={() => setIsReferenceModalOpen(false)}
                footer={[
                    <Button
                        key="copy-reference"
                        type="primary"
                        onClick={() => {
                            void copyReferenceToClipboard();
                        }}
                    >
                        Copiar
                    </Button>,
                    <Button
                        key="apa"
                        type={referenceFormat === "apa" ? "primary" : "default"}
                        onClick={() => setReferenceFormat("apa")}
                    >
                        APA
                    </Button>,
                    <Button
                        key="abnt"
                        type={referenceFormat === "abnt" ? "primary" : "default"}
                        onClick={() => setReferenceFormat("abnt")}
                    >
                        ABNT
                    </Button>,
                    <Button key="close-reference" onClick={() => setIsReferenceModalOpen(false)}>
                        Fechar
                    </Button>,
                ]}
            >
                <Typography.Paragraph className="book-details-reference-format">
                    {bibliographyReference || "Dados insuficientes para gerar a referência deste livro."}
                </Typography.Paragraph>
            </Modal>
        </Layout>
    );
}
