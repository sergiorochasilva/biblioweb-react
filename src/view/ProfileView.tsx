import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    Alert,
    App as AntdApp,
    Button,
    Card,
    Col,
    Descriptions,
    Input,
    Layout,
    Modal,
    Row,
    Space,
    Spin,
    Tag,
    Typography,
} from "antd";
import HeaderView from "./HeaderView";
import { useAuth } from "../contexts/useAuth";
import type { ProfileData } from "../types";
import { api } from "../service/api";
import { validateStrongPassword } from "../service/passwordPolicy";
import {
    DEFAULT_PUBLIC_LIBRARY_ID,
    downloadPurchasedBook,
    lendBook,
    returnBookLoan,
} from "../service/BookService";
import BookCard from "../components/BookCard";
import LoanedBookCard from "../components/LoanedBookCard";
import "../styles/AdminView.css";
import "../styles/ProfileView.css";

/**
 * Converte uma flag booleana para rótulo legível.
 *
 * @param value Flag booleana.
 * @returns ``Sim`` ou ``Não``.
 */
function formatYesNo(value: boolean): string {
    return value ? "Sim" : "Não";
}

function getTokenPayload(token: string | null): Record<string, unknown> | null {
    if (!token) {
        return null;
    }

    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }

    const payloadPart = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = payloadPart.padEnd(
        payloadPart.length + ((4 - (payloadPart.length % 4)) % 4),
        "="
    );

    try {
        return JSON.parse(atob(paddedPayload)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function getUserIdFromToken(token: string | null): string | null {
    const payload = getTokenPayload(token);
    const value = payload?.sub;
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

type SelfPasswordFormState = {
    senha_atual: string;
    nova_senha: string;
    confirmacao_senha: string;
};

type SelfPasswordFieldErrorKey = keyof SelfPasswordFormState;

type ValidationResult<TField extends string> = {
    message: string;
    fieldErrors: Partial<Record<TField, string>>;
};

const emptySelfPasswordForm: SelfPasswordFormState = {
    senha_atual: "",
    nova_senha: "",
    confirmacao_senha: "",
};

/**
 * Valida o formulário de troca de senha do próprio usuário.
 *
 * @param form Estado atual do formulário.
 * @returns Estrutura de erro com mensagem/campos inválidos ou ``null``.
 */
function validateSelfPasswordForm(
    form: SelfPasswordFormState
): ValidationResult<SelfPasswordFieldErrorKey> | null {
    const fieldErrors: Partial<Record<SelfPasswordFieldErrorKey, string>> = {};

    const currentPassword = form.senha_atual.trim();
    const newPassword = form.nova_senha.trim();
    const confirmPassword = form.confirmacao_senha.trim();

    if (!currentPassword) {
        fieldErrors.senha_atual = "Senha atual obrigatória.";
    }

    if (!newPassword) {
        fieldErrors.nova_senha = "Nova senha obrigatória.";
    } else {
        const strongPasswordError = validateStrongPassword(newPassword);
        if (strongPasswordError) {
            fieldErrors.nova_senha = strongPasswordError;
        }
    }

    if (!confirmPassword) {
        fieldErrors.confirmacao_senha = "Confirmação de senha obrigatória.";
    }

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        fieldErrors.confirmacao_senha = "As senhas precisam ser iguais.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            message: "Preencha os campos obrigatórios destacados.",
            fieldErrors,
        };
    }

    return null;
}

export default function ProfileView() {
    const navigate = useNavigate();
    const location = useLocation();
    const { message } = AntdApp.useApp();
    const { Content } = Layout;
    const { profile, setProfile, publisher, library, getAccessToken } = useAuth();
    const currentLibraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
    const isBooksOnlyView = location.pathname === "/meus-livros";

    const [isLoading, setIsLoading] = useState(false);
    const [currentProfile, setCurrentProfile] = useState<ProfileData | null>(profile);
    const [selfPasswordModalOpen, setSelfPasswordModalOpen] = useState(false);
    const [selfPasswordForm, setSelfPasswordForm] = useState<SelfPasswordFormState>(
        emptySelfPasswordForm
    );
    const [selfPasswordModalError, setSelfPasswordModalError] = useState("");
    const [selfPasswordFormErrors, setSelfPasswordFormErrors] = useState<
        Partial<Record<SelfPasswordFieldErrorKey, string>>
    >({});
    const [isSavingSelfPassword, setIsSavingSelfPassword] = useState(false);
    const [loanedBookLoadingId, setLoanedBookLoadingId] = useState<string | null>(null);
    const [purchasedBookLoadingId, setPurchasedBookLoadingId] = useState<string | null>(null);
    const [returnLoadingId, setReturnLoadingId] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    function openSelfPasswordModal(): void {
        setSelfPasswordForm(emptySelfPasswordForm);
        setSelfPasswordFormErrors({});
        setSelfPasswordModalError("");
        setSelfPasswordModalOpen(true);
    }

    function closeSelfPasswordModal(): void {
        setSelfPasswordModalOpen(false);
        setSelfPasswordForm(emptySelfPasswordForm);
        setSelfPasswordFormErrors({});
        setSelfPasswordModalError("");
    }

    async function saveSelfPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const validationError = validateSelfPasswordForm(selfPasswordForm);
        if (validationError) {
            setSelfPasswordModalError(validationError.message);
            setSelfPasswordFormErrors(validationError.fieldErrors);
            return;
        }

        setIsSavingSelfPassword(true);
        setSelfPasswordModalError("");

        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
                return;
            }

            const userId = getUserIdFromToken(accessToken);
            if (!userId) {
                message.error("Não foi possível identificar o usuário autenticado.");
                return;
            }

            await api.patch(
                `/users/${userId}`,
                {
                    senha_atual: selfPasswordForm.senha_atual,
                    nova_senha: selfPasswordForm.nova_senha,
                    confirmacao_senha: selfPasswordForm.confirmacao_senha,
                },
                accessToken
            );

            message.success("Senha atualizada com sucesso.");
            closeSelfPasswordModal();
        } catch (error) {
            console.error("Failed to update self password", error);
            message.error(
                error instanceof Error && error.message
                    ? error.message
                    : "Não foi possível atualizar sua senha."
            );
        } finally {
            setIsSavingSelfPassword(false);
        }
    }

    const loadProfile = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                const nextPath = location.pathname;
                navigate(`/login?next=${encodeURIComponent(nextPath)}`);
                return;
            }

            const loadedProfile = await api.get<ProfileData>(
                `/profile?library=${currentLibraryId}`,
                accessToken
            );
            if (!isMountedRef.current) {
                return;
            }

            setProfile(loadedProfile);
            setCurrentProfile(loadedProfile);
        } catch (error) {
            if (isMountedRef.current) {
                message.error("Erro ao carregar perfil do usuário.");
            }
            console.error("Failed to load profile", error);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [currentLibraryId, getAccessToken, location.pathname, message, navigate, setProfile]);

    useEffect(() => {
        isMountedRef.current = true;
        void loadProfile();

        return () => {
            isMountedRef.current = false;
        };
    }, [loadProfile]);

    const publishers = useMemo(() => currentProfile?.publishers || [], [currentProfile]);
    const libraries = useMemo(() => currentProfile?.libraries || [], [currentProfile]);
    const loanedBooks = useMemo(() => currentProfile?.loaned_books || [], [currentProfile]);
    const purchasedBooks = useMemo(() => currentProfile?.purchased_books || [], [currentProfile]);
    const recentReads = useMemo(() => currentProfile?.recent_reads || [], [currentProfile]);
    const maxConcurrentLoans = useMemo(
        () => currentProfile?.max_concurrent_loans || 3,
        [currentProfile]
    );
    const hasMultipleContexts = publishers.length > 1 || libraries.length > 1;

    /**
     * Baixa novamente o LCPL do livro emprestado.
     *
     * @param bookId Identificador do livro.
     * @returns Promise<void>
     */
    async function downloadLoanedBook(bookId: string): Promise<void> {
        const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
        const accessToken = await getAccessToken();
        if (!accessToken) {
            navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
            return;
        }

        setLoanedBookLoadingId(bookId);
        try {
            await lendBook(bookId, libraryId, accessToken);
        } catch (error) {
            console.warn("Failed to refresh loaned book", error);
            message.error("Não foi possível baixar novamente este livro.");
        } finally {
            setLoanedBookLoadingId(null);
        }
    }

    /**
     * Baixa a licença de uma cópia já comprada.
     *
     * @param bookId Identificador do livro.
     * @returns Promise<void>.
     */
    async function downloadPurchasedBookById(bookId: string): Promise<void> {
        const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;
        const accessToken = await getAccessToken();
        if (!accessToken) {
            navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
            return;
        }

        setPurchasedBookLoadingId(bookId);
        try {
            await downloadPurchasedBook(bookId, libraryId, accessToken);
        } catch (error) {
            console.warn("Failed to download purchased book", error);
            message.error("Não foi possível baixar sua cópia.");
        } finally {
            setPurchasedBookLoadingId(null);
        }
    }

    /**
     * Exibe confirmação e, se aprovada, devolve o livro.
     *
     * @param bookId Identificador do livro.
     * @returns void.
     */
    function confirmReturnLoanedBook(bookId: string): void {
        const libraryId = library?.id ?? DEFAULT_PUBLIC_LIBRARY_ID;

        Modal.confirm({
            title: "Devolver livro",
            content: "Tem certeza de que deseja devolver este livro?",
            okText: "Devolver",
            cancelText: "Cancelar",
            onOk: async () => {
                const accessToken = await getAccessToken();
                if (!accessToken) {
                    navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
                    return;
                }

                setReturnLoadingId(bookId);
                try {
                    await returnBookLoan(bookId, libraryId, accessToken);
                    message.success("Livro devolvido com sucesso.");
                    await loadProfile();
                } catch (error) {
                    console.error("Failed to return loaned book", error);
                    message.error("Não foi possível devolver este livro.");
                } finally {
                    setReturnLoadingId(null);
                }
            },
        });
    }

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <div className="section-header">
                        <Typography.Title level={3} className="section-title">
                            {isBooksOnlyView ? "Meus livros" : "Meu perfil"}
                        </Typography.Title>
                    </div>

                    <Card className="glass-card profile-card">
                        {isLoading ? (
                            <div className="profile-loading-state">
                                <Spin size="large" />
                                <Typography.Text>Carregando perfil...</Typography.Text>
                            </div>
                        ) : (
                            <Space direction="vertical" size={18} style={{ width: "100%" }}>
                                {!isBooksOnlyView && (
                                    <>
                                        <Descriptions
                                            column={1}
                                            size="small"
                                            labelStyle={{ fontWeight: 600 }}
                                        >
                                            <Descriptions.Item label="E-mail">
                                                {currentProfile?.email || "-"}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Administrador">
                                                {formatYesNo(Boolean(currentProfile?.admin))}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Limite de empréstimos simultâneos">
                                                {maxConcurrentLoans}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Biblioteca atual">
                                                {library?.name || "-"}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Editora atual">
                                                {publisher?.name || "-"}
                                            </Descriptions.Item>
                                        </Descriptions>

                                        <div className="profile-block">
                                            <Typography.Text className="profile-block-title">
                                                Bibliotecas vinculadas
                                            </Typography.Text>
                                            <div className="profile-tag-list">
                                                {libraries.length === 0 ? (
                                                    <Typography.Text type="secondary">
                                                        Nenhuma biblioteca vinculada.
                                                    </Typography.Text>
                                                ) : (
                                                    libraries.map((item) => (
                                                        <Tag key={`library-${item.id}`} color="blue">
                                                            {item.name}
                                                        </Tag>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="profile-block">
                                            <Typography.Text className="profile-block-title">
                                                Editoras vinculadas
                                            </Typography.Text>
                                            <div className="profile-tag-list">
                                                {publishers.length === 0 ? (
                                                    <Typography.Text type="secondary">
                                                        Nenhuma editora vinculada.
                                                    </Typography.Text>
                                                ) : (
                                                    publishers.map((item) => (
                                                        <Tag
                                                            key={`publisher-${item.id}`}
                                                            color="geekblue"
                                                        >
                                                            {item.name}
                                                        </Tag>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="profile-block">
                                    <Typography.Text className="profile-block-title">
                                        Livros emprestados comigo
                                    </Typography.Text>
                                    {loanedBooks.length === 0 ? (
                                        <Typography.Text type="secondary">
                                            Nenhum livro emprestado no momento.
                                        </Typography.Text>
                                    ) : (
                                        <Row gutter={[16, 16]} className="profile-book-grid">
                                            {loanedBooks.map((book) => (
                                                <Col key={`loaned-${book.id}`} xs={24} sm={12} md={8} lg={6}>
                                                    <LoanedBookCard
                                                        book={book}
                                                        loadingDownload={loanedBookLoadingId === book.id}
                                                        loadingReturn={returnLoadingId === book.id}
                                                        onDownloadAgain={() => {
                                                            void downloadLoanedBook(book.id);
                                                        }}
                                                        onReturn={() => {
                                                            confirmReturnLoanedBook(book.id);
                                                        }}
                                                    />
                                                </Col>
                                            ))}
                                        </Row>
                                    )}
                                </div>

                                <div className="profile-block">
                                    <Typography.Text className="profile-block-title">
                                        Livros que eu comprei
                                    </Typography.Text>
                                    {purchasedBooks.length === 0 ? (
                                        <Typography.Text type="secondary">
                                            Nenhum livro comprado ainda.
                                        </Typography.Text>
                                    ) : (
                                        <Row gutter={[16, 16]} className="profile-book-grid">
                                            {purchasedBooks.map((book) => (
                                                <Col key={`purchased-${book.id}`} xs={24} sm={12} md={8} lg={6}>
                                                    <BookCard
                                                        book={book}
                                                        onClick={() => navigate(`/book/${book.id}`)}
                                                        secondaryActionLabel="Ler sua cópia"
                                                        secondaryActionLoading={
                                                            purchasedBookLoadingId === book.id
                                                        }
                                                        onSecondaryAction={() => {
                                                            void downloadPurchasedBookById(book.id);
                                                        }}
                                                    />
                                                </Col>
                                            ))}
                                        </Row>
                                    )}
                                </div>

                                <div className="profile-block">
                                    <Typography.Text className="profile-block-title">
                                        Livros recentes
                                    </Typography.Text>
                                    {recentReads.length === 0 ? (
                                        <Typography.Text type="secondary">
                                            Nenhuma leitura recente encontrada.
                                        </Typography.Text>
                                    ) : (
                                        <Row gutter={[16, 16]} className="profile-book-grid">
                                            {recentReads.map((book) => (
                                                <Col key={`recent-${book.id}`} xs={24} sm={12} md={8} lg={6}>
                                                    <BookCard
                                                        book={book}
                                                        onClick={() => navigate(`/book/${book.id}`)}
                                                    />
                                                </Col>
                                            ))}
                                        </Row>
                                    )}
                                </div>

                                <div className="profile-actions">
                                    {!isBooksOnlyView && (
                                        <Button type="primary" onClick={openSelfPasswordModal}>
                                            Alterar minha senha
                                        </Button>
                                    )}
                                    {hasMultipleContexts && (
                                        <Button
                                            type="default"
                                            className="profile-switch-context-button"
                                            onClick={() => navigate("/selection")}
                                        >
                                            Trocar ambiente
                                        </Button>
                                    )}
                                </div>
                            </Space>
                        )}
                    </Card>
                </section>
            </Content>

            <Modal
                title="Alterar minha senha"
                open={selfPasswordModalOpen}
                onCancel={closeSelfPasswordModal}
                footer={null}
                width={560}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void saveSelfPassword(event)}>
                    {selfPasswordModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={selfPasswordModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    <Alert
                        type="info"
                        showIcon
                        message="Informe sua senha atual para confirmar a identidade. A nova senha precisa ter no mínimo 12 caracteres e conter letras maiúsculas, minúsculas, números e símbolos. A confirmação deve ser igual à nova senha."
                        className="admin-modal-alert"
                    />
                    <div className="form-field">
                        <label className="field-label">Senha atual (*)</label>
                        <Input.Password
                            className="admin-input"
                            status={selfPasswordFormErrors.senha_atual ? "error" : undefined}
                            value={selfPasswordForm.senha_atual}
                            onChange={(event) => {
                                setSelfPasswordForm((previous) => ({
                                    ...previous,
                                    senha_atual: event.target.value,
                                }));
                                setSelfPasswordFormErrors((previous) => ({
                                    ...previous,
                                    senha_atual: undefined,
                                }));
                                setSelfPasswordModalError("");
                            }}
                        />
                        {selfPasswordFormErrors.senha_atual && (
                            <span className="form-field-error">
                                {selfPasswordFormErrors.senha_atual}
                            </span>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="field-label">Nova senha (*)</label>
                        <Input.Password
                            className="admin-input"
                            status={selfPasswordFormErrors.nova_senha ? "error" : undefined}
                            value={selfPasswordForm.nova_senha}
                            onChange={(event) => {
                                setSelfPasswordForm((previous) => ({
                                    ...previous,
                                    nova_senha: event.target.value,
                                }));
                                setSelfPasswordFormErrors((previous) => ({
                                    ...previous,
                                    nova_senha: undefined,
                                }));
                                setSelfPasswordModalError("");
                            }}
                        />
                        {selfPasswordFormErrors.nova_senha && (
                            <span className="form-field-error">
                                {selfPasswordFormErrors.nova_senha}
                            </span>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="field-label">Confirmação de senha (*)</label>
                        <Input.Password
                            className="admin-input"
                            status={selfPasswordFormErrors.confirmacao_senha ? "error" : undefined}
                            value={selfPasswordForm.confirmacao_senha}
                            onChange={(event) => {
                                setSelfPasswordForm((previous) => ({
                                    ...previous,
                                    confirmacao_senha: event.target.value,
                                }));
                                setSelfPasswordFormErrors((previous) => ({
                                    ...previous,
                                    confirmacao_senha: undefined,
                                }));
                                setSelfPasswordModalError("");
                            }}
                        />
                        {selfPasswordFormErrors.confirmacao_senha && (
                            <span className="form-field-error">
                                {selfPasswordFormErrors.confirmacao_senha}
                            </span>
                        )}
                    </div>
                    <div className="modal-actions">
                        <Button onClick={closeSelfPasswordModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={isSavingSelfPassword}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>
        </Layout>
    );
}
