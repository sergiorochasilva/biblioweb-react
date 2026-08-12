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
import { useParams } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { getBookAuthorsText, type Book } from "../model/Book";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    downloadPurchasedBook,
    fetchBookDetails,
} from "../service/BookService";
import "../styles/EbookMiniView.css";

const MANUAL_URL = "/pos-download/manual.html";

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
    downloading,
    onReadNow,
}: {
    book: Book;
    authorLabel: string;
    downloading: boolean;
    onReadNow: () => void;
}) {
    return (
        <header className="ebook-hero">
            <div className="ebook-cover-frame">
                <EbookCover book={book} />
            </div>
            <div className="ebook-hero-copy">
                <span className="ebook-badge">
                    <SafetyCertificateOutlined aria-hidden="true" />
                    Livro protegido
                </span>
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
                        loading={downloading}
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
    const { getAccessToken, library, token } = useAuth();
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [messageApi, contextHolder] = message.useMessage();

    const libraryId = resolveLibraryId(library?.id);
    const authorLabel = book ? getAuthorLabel(book) : "";

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

    const handleReadNow = useCallback(async (): Promise<void> => {
        if (!id) return;

        setDownloading(true);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                throw new Error("Sessão expirada. Faça login novamente.");
            }

            await downloadPurchasedBook(id, libraryId, accessToken);
            messageApi.success("Certificado do livro baixado.");
        } catch (error) {
            messageApi.error(
                error instanceof Error ? error.message : "Não foi possível baixar o livro."
            );
        } finally {
            setDownloading(false);
        }
    }, [getAccessToken, id, libraryId, messageApi]);

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
                            downloading={downloading}
                            onReadNow={() => void handleReadNow()}
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
