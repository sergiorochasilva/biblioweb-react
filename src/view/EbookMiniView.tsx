import { useCallback, useEffect, useMemo, useState } from "react";
import {
    BookOutlined,
    CheckCircleOutlined,
    DownloadOutlined,
    InfoCircleOutlined,
    QuestionCircleOutlined,
    SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Alert, Button, Layout, Spin, Typography, message } from "antd";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { getBookAuthorsText, type Book } from "../model/Book";
import BookTypeTag from "../components/BookTypeTag";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    downloadPurchasedBook,
    fetchBookDetails,
    lendBook,
    registerBookAccessWithType,
} from "../service/BookService";
import { savePendingLendAction } from "../service/postLoginAction";
import "../styles/EbookMiniView.css";

const MANUAL_URL = "/pos-download/manual.html";
const FREE_BOOKS_BASE_URL = (import.meta.env.VITE_BOOKS_BASE_URL ||
    "https://storage.googleapis.com/fronesis_bucket/").trim();

type EnvironmentKey = "windows" | "mac" | "linux" | "android" | "ios";

type EnvironmentGuide = {
    key: EnvironmentKey;
    label: string;
    statusLabel: string;
    steps: string[];
    primaryAction: {
        label: string;
        href: string;
    };
    secondaryAction: {
        label: string;
        href: string;
    };
};

const ENVIRONMENT_GUIDES: EnvironmentGuide[] = [
    {
        key: "windows",
        label: "Windows",
        statusLabel: "Detectamos instruções para Windows.",
        steps: [
            "Baixe e instale o Thorium Reader para Windows.",
            "Abra o arquivo *.lcpl baixado diretamente no leitor.",
            "Aguarde o carregamento da licença e clique na capa do livro para iniciar.",
        ],
        primaryAction: {
            label: "Baixar Thorium Reader",
            href: "https://www.edrlab.org/software/thorium-reader/github/win10",
        },
        secondaryAction: {
            label: "Site oficial",
            href: "https://thorium.edrlab.org/en/",
        },
    },
    {
        key: "mac",
        label: "macOS",
        statusLabel: "Detectamos instruções para macOS.",
        steps: [
            "Instale o Thorium Reader para macOS.",
            "Abra o arquivo *.lcpl baixado no leitor.",
            "Aguarde o processamento da licença e comece a leitura.",
        ],
        primaryAction: {
            label: "Baixar Thorium Reader",
            href: "https://www.edrlab.org/software/thorium-reader/github/macos",
        },
        secondaryAction: {
            label: "Site oficial",
            href: "https://thorium.edrlab.org/en/",
        },
    },
    {
        key: "linux",
        label: "Linux",
        statusLabel: "Detectamos instruções para Linux.",
        steps: [
            "Instale o Thorium Reader para sua distribuição Linux.",
            "Abra o arquivo *.lcpl baixado no aplicativo.",
            "Aguarde a sincronização e inicie a leitura.",
        ],
        primaryAction: {
            label: "Baixar Thorium Reader",
            href: "https://www.edrlab.org/software/thorium-reader/github/linux",
        },
        secondaryAction: {
            label: "Site oficial",
            href: "https://thorium.edrlab.org/en/",
        },
    },
    {
        key: "android",
        label: "Android",
        statusLabel: "Detectamos instruções para Android.",
        steps: [
            "Instale o aplicativo Aldiko Next pela Google Play Store.",
            "Importe o arquivo *.lcpl baixado para o aplicativo.",
            "Aguarde o carregamento e toque na capa do livro.",
        ],
        primaryAction: {
            label: "Abrir na Google Play",
            href: "https://play.google.com/store/apps/details?id=com.aldiko.android&pli=1",
        },
        secondaryAction: {
            label: "Site do Aldiko",
            href: "https://www.aldiko.com/",
        },
    },
    {
        key: "ios",
        label: "iOS",
        statusLabel: "Detectamos instruções para iOS.",
        steps: [
            "Instale o aplicativo Aldiko Next pela App Store.",
            "Abra o arquivo *.lcpl baixado no aplicativo.",
            "Aguarde a abertura da licença e inicie a leitura.",
        ],
        primaryAction: {
            label: "Abrir na App Store",
            href: "https://apps.apple.com/us/app/aldiko-next/id1476410111",
        },
        secondaryAction: {
            label: "Site do Aldiko",
            href: "https://www.aldiko.com/",
        },
    },
];

const USAGE_RULES = [
    {
        title: "Uso individual",
        description: "O acesso é pessoal e intransferível.",
    },
    {
        title: "Prazo da licença",
        description: "O arquivo funciona apenas durante o período do empréstimo.",
    },
    {
        title: "Leitura offline",
        description: "Após baixar no app compatível, você pode ler sem internet.",
    },
    {
        title: "Expiração",
        description: "Após o prazo, o conteúdo será bloqueado automaticamente.",
    },
];

function resolveLibraryId(libraryId?: number): number {
    return libraryId ?? DEFAULT_PUBLIC_LIBRARY_ID;
}

function detectEnvironment(userAgent: string): EnvironmentKey {
    if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
    if (/Android/i.test(userAgent)) return "android";
    if (/Windows/i.test(userAgent)) return "windows";
    if (/Mac OS|Macintosh/i.test(userAgent)) return "mac";
    if (/Linux/i.test(userAgent)) return "linux";
    return "windows";
}

function getAuthorLabel(book: Book): string {
    return getBookAuthorsText(book) || book.corporate_author?.trim() || "";
}

function EbookCover({ book }: { book: Book }) {
    if (book.image_url) {
        return (
            <img
                className="ebook-cover-image"
                src={book.image_url}
                alt={`Capa de ${book.title}`}
            />
        );
    }

    return (
        <div className="ebook-cover-placeholder" role="img" aria-label="Capa indisponível">
            <BookOutlined aria-hidden="true" />
        </div>
    );
}

function EbookHero({
    book,
    authorLabel,
    reading,
    showWebVersion,
    webVersionLabel,
    onReadNow,
    onReadWebVersion,
}: {
    book: Book;
    authorLabel: string;
    reading: boolean;
    showWebVersion: boolean;
    webVersionLabel: string;
    onReadNow: () => void;
    onReadWebVersion: () => void;
}) {
    return (
        <header className="ebook-hero">
            <div className="ebook-cover-frame">
                <EbookCover book={book} />
            </div>
            <div className="ebook-hero-copy">
                <BookTypeTag type={book.type} className="ebook-book-type-tag" />
                <Typography.Title level={1} className="ebook-title">
                    {book.title}
                </Typography.Title>
                {authorLabel ? <p className="ebook-author">{authorLabel}</p> : null}
                <p className="ebook-description">
                    Este livro usa proteção LCP. Baixe o certificado, abra-o em um leitor
                    compatível e siga o guia abaixo para começar a leitura.
                </p>
                <div className="ebook-actions">
                    <Button
                        type="primary"
                        size="large"
                        icon={<DownloadOutlined />}
                        loading={reading}
                        onClick={onReadNow}
                    >
                        Ler agora
                    </Button>
                    <Button
                        size="large"
                        icon={<QuestionCircleOutlined />}
                        href={MANUAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Manual completo
                    </Button>
                    {showWebVersion ? (
                        <Button size="large" onClick={onReadWebVersion}>
                            {webVersionLabel}
                        </Button>
                    ) : null}
                </div>
            </div>
        </header>
    );
}

function EnvironmentGuide() {
    const [selectedEnvironment, setSelectedEnvironment] = useState<EnvironmentKey>(() =>
        detectEnvironment(typeof navigator === "undefined" ? "" : navigator.userAgent)
    );
    const selectedGuide = useMemo(
        () =>
            ENVIRONMENT_GUIDES.find((guide) => guide.key === selectedEnvironment) ??
            ENVIRONMENT_GUIDES[0],
        [selectedEnvironment]
    );

    return (
        <section className="ebook-card ebook-guide" aria-labelledby="ebook-guide-title">
            <div className="ebook-card-title">
                <InfoCircleOutlined aria-hidden="true" />
                <Typography.Title id="ebook-guide-title" level={2}>
                    Guia de instalação
                </Typography.Title>
            </div>
            <p className="ebook-detected-status">{selectedGuide.statusLabel}</p>
            <div className="ebook-env-selector" aria-label="Escolha seu sistema">
                {ENVIRONMENT_GUIDES.map((guide) => (
                    <button
                        key={guide.key}
                        type="button"
                        className={`ebook-env-button${
                            selectedEnvironment === guide.key ? " is-active" : ""
                        }`}
                        aria-pressed={selectedEnvironment === guide.key}
                        onClick={() => setSelectedEnvironment(guide.key)}
                    >
                        {guide.label}
                    </button>
                ))}
            </div>
            <ol className="ebook-step-list">
                {selectedGuide.steps.map((step, index) => (
                    <li className="ebook-step-item" key={step}>
                        <span className="ebook-step-number">{index + 1}</span>
                        <span>{step}</span>
                    </li>
                ))}
            </ol>
            <div className="ebook-guide-actions">
                <Button
                    type="primary"
                    href={selectedGuide.primaryAction.href}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {selectedGuide.primaryAction.label}
                </Button>
                <Button
                    href={selectedGuide.secondaryAction.href}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {selectedGuide.secondaryAction.label}
                </Button>
            </div>
        </section>
    );
}

function UsageRules() {
    return (
        <aside className="ebook-card ebook-rules" aria-labelledby="ebook-rules-title">
            <div className="ebook-card-title">
                <SafetyCertificateOutlined aria-hidden="true" />
                <Typography.Title id="ebook-rules-title" level={2}>
                    Regras de uso
                </Typography.Title>
            </div>
            <ul className="ebook-rules-list">
                {USAGE_RULES.map((rule) => (
                    <li className="ebook-rule-item" key={rule.title}>
                        <CheckCircleOutlined aria-hidden="true" />
                        <span>
                            <strong>{rule.title}</strong>
                            {rule.description}
                        </span>
                    </li>
                ))}
            </ul>
        </aside>
    );
}

export default function EbookMiniView() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { getAccessToken, library, token } = useAuth();
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const [reading, setReading] = useState(false);
    const [messageApi, contextHolder] = message.useMessage();

    const libraryId = resolveLibraryId(library?.id);
    const authorLabel = book ? getAuthorLabel(book) : "";
    const resolvedType = (book?.type || "protected").toLowerCase();
    const resolvedLoanState = (book?.loan_state || "default").toLowerCase();
    const normalizedHtmlVersionUrl = book?.html_version_url?.trim() || "";
    const hasWebVersion =
        (resolvedType === "external" || resolvedType === "free") &&
        Boolean(normalizedHtmlVersionUrl);
    const webVersionLabel =
        resolvedLoanState === "recent" && normalizedHtmlVersionUrl
            ? "Continuar lendo versão web"
            : "Ler versão web";

    useEffect(() => {
        let active = true;

        async function loadBook(): Promise<void> {
            if (!id) {
                setBook(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const accessToken = token ? await getAccessToken({ redirectOnFail: false }) : null;
                const loadedBook = await fetchBookDetails(id, libraryId, accessToken ?? undefined);
                if (active) {
                    setBook(loadedBook);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void loadBook();

        return () => {
            active = false;
        };
    }, [getAccessToken, id, libraryId, token]);

    /**
     * Salva o empréstimo pendente e redireciona para a autenticação, preservando a rota atual.
     *
     * @returns `true` quando o redirecionamento foi iniciado.
     */
    const redirectToLoginForLend = useCallback((): boolean => {
        if (!id) {
            return false;
        }

        const returnTo = `${location.pathname}${location.search}`;
        savePendingLendAction({
            type: "lend",
            bookId: id,
            libraryId,
            returnTo,
        });
        navigate(`/login?next=${encodeURIComponent(returnTo)}`);
        return true;
    }, [id, libraryId, location.pathname, location.search, navigate]);

    /**
     * Registra o acesso e abre a URL de leitura em uma nova aba.
     *
     * @param url URL externa ou pública do livro.
     * @returns Promise<void>.
     */
    const registerAccessAndOpen = useCallback(
        async (actionType: "read_now" | "read_web", url?: string): Promise<void> => {
            if (!id || !url) {
                messageApi.error("URL não cadastrada para este livro.");
                return;
            }

            let accessToken: string | undefined = token || undefined;
            if (token) {
                accessToken = (await getAccessToken({ redirectOnFail: false })) || token;
            }

            try {
                await registerBookAccessWithType(id, actionType, libraryId, accessToken);
            } catch (error) {
                console.warn("Failed to register book access", error);
            }

            const readingWindow = window.open(url, "_blank", "noopener,noreferrer");
            if (!readingWindow) {
                messageApi.error("Não foi possível abrir a nova aba. Verifique o bloqueio de pop-ups.");
            }
        },
        [getAccessToken, id, libraryId, messageApi, token]
    );

    /**
     * Executa o mesmo fluxo principal de leitura da página de detalhes do livro.
     *
     * @returns Promise<void>.
     */
    const handleReadNow = useCallback(async (): Promise<void> => {
        if (!id || !book) {
            return;
        }

        setReading(true);
        try {
            if ((book.loan_state || "").toLowerCase() === "unavailable") {
                messageApi.warning("Não há licença disponível para este livro no momento.");
                return;
            }

            if (book.purchased_by_user) {
                let accessToken: string | undefined = token || undefined;
                if (token) {
                    accessToken = (await getAccessToken({ redirectOnFail: false })) || token;
                }

                if (!accessToken) {
                    const returnTo = `${location.pathname}${location.search}`;
                    navigate(`/login?next=${encodeURIComponent(returnTo)}`);
                    return;
                }

                await downloadPurchasedBook(id, libraryId, accessToken);
                messageApi.success("Certificado do livro baixado.");
                return;
            }

            if (resolvedType === "external") {
                await registerAccessAndOpen("read_now", book.external_url);
                return;
            }

            if (resolvedType === "free") {
                const baseUrl = FREE_BOOKS_BASE_URL.endsWith("/")
                    ? FREE_BOOKS_BASE_URL
                    : `${FREE_BOOKS_BASE_URL}/`;
                await registerAccessAndOpen(
                    "read_now",
                    book.file_name ? `${baseUrl}${book.file_name}` : ""
                );
                return;
            }

            if (!token) {
                redirectToLoginForLend();
                return;
            }

            const accessToken = await getAccessToken({ redirectOnFail: false });
            if (!accessToken) {
                redirectToLoginForLend();
                return;
            }

            await lendBook(id, libraryId, accessToken);
            messageApi.success("Certificado do livro baixado.");
        } catch (error) {
            messageApi.error(
                error instanceof Error ? error.message : "Não foi possível iniciar a leitura."
            );
        } finally {
            setReading(false);
        }
    }, [
        book,
        getAccessToken,
        id,
        libraryId,
        location.pathname,
        location.search,
        messageApi,
        navigate,
        redirectToLoginForLend,
        registerAccessAndOpen,
        resolvedType,
        token,
    ]);

    /**
     * Abre a versão web quando o livro externo ou livre a disponibiliza.
     *
     * @returns Promise<void>.
     */
    const handleWebVersionAction = useCallback(async (): Promise<void> => {
        await registerAccessAndOpen("read_web", normalizedHtmlVersionUrl);
    }, [normalizedHtmlVersionUrl, registerAccessAndOpen]);

    return (
        <Layout className="page-shell ebook-shell">
            {contextHolder}
            <Layout.Content className="ebook-page">
                {loading ? (
                    <div className="ebook-loading-state" aria-label="Carregando livro">
                        <Spin size="large" />
                    </div>
                ) : !book ? (
                    <Alert
                        showIcon
                        type="error"
                        message="Livro não encontrado"
                        description="Verifique o endereço ou tente novamente mais tarde."
                    />
                ) : (
                    <>
                        <EbookHero
                            book={book}
                            authorLabel={authorLabel}
                            reading={reading}
                            showWebVersion={hasWebVersion}
                            webVersionLabel={webVersionLabel}
                            onReadNow={() => void handleReadNow()}
                            onReadWebVersion={() => void handleWebVersionAction()}
                        />
                        <main className="ebook-main-layout">
                            <EnvironmentGuide />
                            <UsageRules />
                        </main>
                    </>
                )}
            </Layout.Content>
        </Layout>
    );
}
