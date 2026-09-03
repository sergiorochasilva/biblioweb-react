import { useMemo, useState } from "react";
import {
    Alert,
    App as AntdApp,
    Button,
    Card,
    Checkbox,
    Drawer,
    Dropdown,
    Empty,
    Input,
    Layout,
    List,
    Modal,
    Pagination,
    Popconfirm,
    Select,
    Switch,
    Table,
    Tabs,
    Tag,
    Typography,
    Upload,
} from "antd";
import {
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    ExportOutlined,
    KeyOutlined,
    LockOutlined,
    MoreOutlined,
    SearchOutlined,
    PlusOutlined,
    ReloadOutlined,
    RightOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import HeaderView from "./HeaderView";
import BookLibraryPolicyGrid from "../components/BookLibraryPolicyGrid";
import LibraryLimitGrid from "../components/LibraryLimitGrid";
import { useAdminController } from "../controller/AdminController";
import { getBookAuthorsText } from "../model/Book";
import { ALLOWED_OAUTH_GRANT_TYPES, ALLOWED_OAUTH_SCOPES } from "../model/OAuthScopes";
import {
    getOAuthScopeGroup,
    matchesOAuthPartnerSearch,
    translateOAuthGrantType,
    translateOAuthScope,
} from "../model/OAuthPartnerPresentation";
import {
    formatOAuthAuditDateTime,
    getOAuthAuditEventCategory,
    getOAuthAuditEventDetails,
    getOAuthAuditResultColor,
    OAUTH_AUDIT_EVENT_TYPES,
    translateOAuthAuditEventType,
    translateOAuthAuditResult,
} from "../model/OAuthAudit";
import type { OAuthAuditEvent, OAuthAuditFilters } from "../model/OAuthAudit";
import "../styles/AdminView.css";

/**
 * Formata o uso diário de tokens para a área administrativa.
 *
 * @param used Tokens usados no dia.
 * @param limit Limite diário de tokens.
 * @returns Texto legível com usado e limite.
 */
function formatTokenUsage(used: number, limit: number): string {
    return `${used.toLocaleString("pt-BR")} / ${limit.toLocaleString("pt-BR")}`;
}

/**
 * Renderiza a área administrativa global com gestão de livros, usuários,
 * bibliotecas e editoras.
 *
 * @returns Componente de tela administrativa.
 */
export default function AdminView() {
    const { Content } = Layout;
    const { modal } = AntdApp.useApp();
    const { state, actions } = useAdminController();
    const [partnerSearch, setPartnerSearch] = useState("");
    const [partnerStatus, setPartnerStatus] = useState<"active" | "inactive" | "all">("active");
    const [partnerSection, setPartnerSection] = useState<"partners" | "audit">("partners");
    const [selectedAuditEvent, setSelectedAuditEvent] = useState<OAuthAuditEvent | null>(null);

    const visibleOAuthClients = useMemo(
        () =>
            state.oauthClients.filter((client) => {
                const matchesStatus =
                    partnerStatus === "all" ||
                    (partnerStatus === "active" ? client.active : !client.active);
                return matchesStatus && matchesOAuthPartnerSearch(client, partnerSearch);
            }),
        [partnerSearch, partnerStatus, state.oauthClients]
    );

    const oauthClientById = useMemo(
        () => new Map(state.oauthClients.map((client) => [client.id, client])),
        [state.oauthClients]
    );

    const auditPartnerOptions = useMemo(() => {
        const byName = (a: (typeof state.oauthClients)[number], b: (typeof state.oauthClients)[number]) =>
            a.name.localeCompare(b.name, "pt-BR");
        const active = state.oauthClients.filter((client) => client.active).sort(byName);
        const inactive = state.oauthClients.filter((client) => !client.active).sort(byName);

        return [
            { label: "Ativos", options: active.map((client) => ({ value: client.id, label: client.name })) },
            {
                label: "Inativos",
                options: inactive.map((client) => ({ value: client.id, label: `${client.name} (inativo)` })),
            },
        ].filter((group) => group.options.length > 0);
    }, [state.oauthClients]);

    const auditEventOptions = useMemo(
        () =>
            (["Parceiros", "Autorização e segurança", "Operações"] as const).map((category) => ({
                label: category,
                options: OAUTH_AUDIT_EVENT_TYPES
                    .filter((eventType) => getOAuthAuditEventCategory(eventType) === category)
                    .map((eventType) => ({
                        value: eventType,
                        label: translateOAuthAuditEventType(eventType),
                    })),
            })),
        []
    );

    const selectedAuditDetails = useMemo(
        () => (selectedAuditEvent ? getOAuthAuditEventDetails(selectedAuditEvent) : []),
        [selectedAuditEvent]
    );

    /**
     * Abre a auditoria já filtrada para um parceiro específico, reutilizando
     * a mesma tela de auditoria em vez de manter um histórico paralelo.
     *
     * @param clientId Identificador do parceiro OAuth.
     * @returns void.
     */
    function openPartnerAudit(clientId: string): void {
        const nextFilters: OAuthAuditFilters = {
            ...state.auditFilters,
            client_id: clientId,
            page: 1,
        };
        setPartnerSection("audit");
        actions.setAuditFilters(nextFilters);
        void actions.loadAuditEvents(nextFilters);
    }

    const isRefreshingCurrentTab =
        state.activeTab === "users"
            ? state.isLoadingUsers
            : state.activeTab === "libraries"
                ? state.isLoadingLibraries
                : state.activeTab === "publishers"
                    ? state.isLoadingPublishers
                    : state.activeTab === "subjects"
                        ? state.isLoadingSubjects
                        : state.activeTab === "authors"
                            ? state.isLoadingAuthors
                            : state.activeTab === "oauth-clients"
                                ? partnerSection === "audit"
                                    ? state.isLoadingAudit
                                    : state.isLoadingOAuthClients
                                : state.activeTab === "oauth-audit"
                                    ? state.isLoadingAudit
                                    : state.isLoadingBooks;

    const publisherOptions = useMemo(
        () =>
            state.publishers.map((publisher) => ({
                value: publisher.id,
                label: publisher.name,
            })),
        [state.publishers]
    );

    const libraryOptions = useMemo(
        () =>
            state.libraries.map((library) => ({
                value: String(library.id),
                label: `${library.nome} (#${library.id})`,
            })),
        [state.libraries]
    );

    const subjectOptions = useMemo(
        () =>
            state.subjects.map((subject) => ({
                value: String(subject.id),
                label: subject.name,
            })),
        [state.subjects]
    );

    const authorOptions = useMemo(
        () =>
            state.authors.map((author) => ({
                value: String(author.id),
                label: author.name,
            })),
        [state.authors]
    );

    const bookPublisherOptions = useMemo(() => {
        const options = [...publisherOptions];
        const currentPublisher = state.bookForm.publisher.trim();

        if (currentPublisher && !options.some((option) => option.value === currentPublisher)) {
            options.push({
                value: currentPublisher,
                label: `${currentPublisher} (não catalogada)`,
            });
        }

        return options;
    }, [publisherOptions, state.bookForm.publisher]);

    /**
     * Resolve o texto de acervo exibido na listagem de livros.
     *
     * @param book Item de livro da listagem administrativa.
     * @returns Texto amigável para o acervo associado.
     */
    function getBookLibraryLabel(book: (typeof state.books)[number]): string {
        const relatedLibraries = Array.isArray(book.libraries) ? book.libraries : [];
        if (relatedLibraries.length > 0) {
            return `${relatedLibraries.length} ${
                relatedLibraries.length === 1 ? "acervo" : "acervos"
            }`;
        }

        return "0 acervos";
    }

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <Typography.Title level={3} className="section-title">
                        Administração do sistema
                    </Typography.Title>

                    {state.error && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.error}
                            className="glass-alert"
                        />
                    )}

                    <Tabs
                        className="admin-tabs"
                        activeKey={state.activeTab}
                        onChange={actions.setActiveTab}
                        tabBarExtraContent={
                            <Button
                                icon={<ReloadOutlined />}
                                loading={isRefreshingCurrentTab}
                                onClick={() => {
                                    if (state.activeTab === "oauth-clients" && partnerSection === "audit") {
                                        void actions.loadAuditEvents();
                                        return;
                                    }
                                    void actions.refreshCurrentTab();
                                }}
                            >
                                Atualizar
                            </Button>
                        }
                        items={[
                            {
                                key: "books",
                                label: "Livros",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card"
                                        title="Livros cadastrados"
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreateBookModal}
                                            >
                                                Adicionar livro
                                            </Button>
                                        }
                                    >
                                        <div className="admin-card-toolbar">
                                            <div className="admin-toolbar-grid">
                                                <div className="form-field">
                                                    <label className="field-label">Busca</label>
                                                    <Input
                                                        placeholder="Título, autor, assunto, editora, ISBN..."
                                                        value={state.bookSearch}
                                                        onChange={(event) =>
                                                            actions.setBookSearch(event.target.value)
                                                        }
                                                        onPressEnter={actions.applyBookFilters}
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">Editora</label>
                                                    <Select
                                                        allowClear
                                                        placeholder="Todas"
                                                        value={state.publisherFilter || undefined}
                                                        options={publisherOptions}
                                                        onChange={(value: string | undefined) =>
                                                            actions.setPublisherFilter(value || "")
                                                        }
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">Acervo (opcional)</label>
                                                    <Select
                                                        allowClear
                                                        placeholder="Selecione o acervo"
                                                        value={state.libraryFilter || undefined}
                                                        options={libraryOptions}
                                                        onChange={(value: string) =>
                                                            actions.setLibraryFilter(value || "")
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="toolbar-actions">
                                                <Button onClick={actions.clearBookFilters}>Limpar</Button>
                                                <Button type="primary" onClick={actions.applyBookFilters}>
                                                    Buscar
                                                </Button>
                                            </div>
                                        </div>

                                        {state.books.length === 0 && !state.isLoadingBooks ? (
                                            <Empty description="Nenhum livro encontrado." />
                                        ) : (
                                            <>
                                                <List
                                                    className="admin-list"
                                                    loading={state.isLoadingBooks}
                                                    dataSource={state.books}
                                                    renderItem={(book) => (
                                                        <List.Item
                                                            className="admin-list-item"
                                                            actions={[
                                                                <Button
                                                                    key="edit"
                                                                    icon={<EditOutlined />}
                                                                    onClick={() => {
                                                                        void actions.openEditBookModal(book);
                                                                    }}
                                                                >
                                                                    Editar
                                                                </Button>,
                                                                <Popconfirm
                                                                    key="delete"
                                                                    title="Excluir livro"
                                                                    description="Essa ação não pode ser desfeita."
                                                                    okText="Excluir"
                                                                    cancelText="Cancelar"
                                                                    onConfirm={() => {
                                                                        const resolvedBookId = book.book_id || book.id;
                                                                        if (resolvedBookId) {
                                                                            void actions.removeBook(resolvedBookId);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Button danger icon={<DeleteOutlined />}>
                                                                        Excluir
                                                                    </Button>
                                                                </Popconfirm>,
                                                            ]}
                                                        >
                                                            <List.Item.Meta
                                                                title={book.title}
                                                                description={
                                                                    <div className="admin-item-meta">
                                                                        <span>
                                                                            {getBookAuthorsText(book) ||
                                                                                "Autor não informado"}
                                                                        </span>
                                                                        <span>
                                                                            {book.publisher_name ||
                                                                                book.publisher ||
                                                                                "Editora não informada"}
                                                                        </span>
                                                                        <span>
                                                                            Status: {book.active === false ? "Inativo" : "Ativo"}
                                                                        </span>
                                                                        <span>
                                                                            {getBookLibraryLabel(book)}
                                                                        </span>
                                                                    </div>
                                                                }
                                                            />
                                                        </List.Item>
                                                    )}
                                                />
                                                {state.hasMoreBooks && (
                                                    <div className="load-more-wrap">
                                                        <Button
                                                            onClick={() => void actions.loadMoreBooks()}
                                                            loading={state.isLoadingMoreBooks}
                                                        >
                                                            Carregar mais
                                                        </Button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </Card>
                                ),
                            },
                            {
                                key: "users",
                                label: "Usuários",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card"
                                        title="Usuários"
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreateUserModal}
                                            >
                                                Adicionar usuário
                                            </Button>
                                        }
                                    >
                                        <div className="users-toolbar">
                                            <Input
                                                placeholder="Buscar por e-mail, dica ou ID..."
                                                value={state.userSearch}
                                                onChange={(event) => actions.setUserSearch(event.target.value)}
                                                onPressEnter={actions.applyUserSearch}
                                            />
                                            <Button type="primary" onClick={actions.applyUserSearch}>
                                                Buscar
                                            </Button>
                                            <Button onClick={actions.clearUserSearch}>Limpar</Button>
                                        </div>

                                        {state.users.length === 0 && !state.isLoadingUsers ? (
                                            <Empty description="Nenhum usuário encontrado." />
                                        ) : (
                                            <List
                                                className="admin-list"
                                                loading={state.isLoadingUsers}
                                                dataSource={state.users}
                                                renderItem={(user) => (
                                                    <List.Item
                                                        className="admin-list-item"
                                                        actions={[
                                                            <Button
                                                                key="edit"
                                                                icon={<EditOutlined />}
                                                                onClick={() => {
                                                                    void actions.openEditUserModal(user);
                                                                }}
                                                            >
                                                                Editar
                                                            </Button>,
                                                            <Button
                                                                key="password"
                                                                icon={<LockOutlined />}
                                                                onClick={() => {
                                                                    actions.openChangePasswordModal(user);
                                                                }}
                                                            >
                                                                Mudar senha
                                                            </Button>,
                                                            <Popconfirm
                                                                key="delete"
                                                                title="Excluir usuário"
                                                                description="Essa ação não pode ser desfeita."
                                                                okText="Excluir"
                                                                cancelText="Cancelar"
                                                                onConfirm={() => {
                                                                    void actions.removeUser(user.id);
                                                                }}
                                                            >
                                                                <Button danger icon={<DeleteOutlined />}>
                                                                    Excluir
                                                                </Button>
                                                            </Popconfirm>,
                                                        ]}
                                                    >
                                                        <List.Item.Meta
                                                            title={user.email}
                                                            description={
                                                                <div className="admin-item-meta">
                                                                    <span>Dica: {user.reading_pass_hint || "-"}</span>
                                                                    <span>
                                                                        Perfil: {user.admin ? "Administrador" : "Usuário comum"}
                                                                    </span>
                                                                    <span>
                                                                        Acervos: {user.library_limits?.length ?? user.libraries.length} | Editoras: {user.publishers.length}
                                                                    </span>
                                                                </div>
                                                            }
                                                        />
                                                    </List.Item>
                                                )}
                                            />
                                        )}
                                    </Card>
                                ),
                            },
                            {
                                key: "libraries",
                                label: "Acervos",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card"
                                        title="Manitenção de acervos"
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreateLibraryModal}
                                            >
                                                Nova library
                                            </Button>
                                        }
                                    >
                                        <div className="users-toolbar">
                                            <Input
                                                placeholder="Buscar por nome, CNPJ ou ID..."
                                                value={state.librarySearch}
                                                onChange={(event) => actions.setLibrarySearch(event.target.value)}
                                                onPressEnter={actions.applyLibrarySearch}
                                            />
                                            <Button type="primary" onClick={actions.applyLibrarySearch}>
                                                Buscar
                                            </Button>
                                            <Button onClick={actions.clearLibrarySearch}>Limpar</Button>
                                        </div>

                                        {state.libraryRows.length === 0 && !state.isLoadingLibraries ? (
                                            <Empty description="Nenhuma library encontrada." />
                                        ) : (
                                            <List
                                                className="admin-list"
                                                loading={state.isLoadingLibraries}
                                                dataSource={state.libraryRows}
                                                renderItem={(library) => (
                                                    <List.Item
                                                        className="admin-list-item"
                                                        actions={[
                                                            <Button
                                                                key="edit"
                                                                icon={<EditOutlined />}
                                                                onClick={() => actions.openEditLibraryModal(library)}
                                                            >
                                                                Editar
                                                            </Button>,
                                                            <Popconfirm
                                                                key="delete"
                                                                title="Excluir library"
                                                                description="Essa ação não pode ser desfeita."
                                                                okText="Excluir"
                                                                cancelText="Cancelar"
                                                                onConfirm={() => {
                                                                    void actions.removeLibrary(library.id);
                                                                }}
                                                            >
                                                                <Button danger icon={<DeleteOutlined />}>
                                                                    Excluir
                                                                </Button>
                                                            </Popconfirm>,
                                                        ]}
                                                    >
                                                        <List.Item.Meta
                                                            title={`${library.nome} (#${library.id})`}
                                                            description={<span>CNPJ: {library.cnpj}</span>}
                                                        />
                                                    </List.Item>
                                                )}
                                            />
                                        )}
                                    </Card>
                                ),
                            },
                            {
                                key: "publishers",
                                label: "Editoras",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card"
                                        title="Manutenção de editoras"
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreatePublisherModal}
                                            >
                                                Nova editora
                                            </Button>
                                        }
                                    >
                                        <div className="users-toolbar">
                                            <Input
                                                placeholder="Buscar por nome ou ID..."
                                                value={state.publisherSearch}
                                                onChange={(event) => actions.setPublisherSearch(event.target.value)}
                                                onPressEnter={actions.applyPublisherSearch}
                                            />
                                            <Button type="primary" onClick={actions.applyPublisherSearch}>
                                                Buscar
                                            </Button>
                                            <Button onClick={actions.clearPublisherSearch}>Limpar</Button>
                                        </div>

                                        {state.publisherRows.length === 0 && !state.isLoadingPublishers ? (
                                            <Empty description="Nenhuma editora encontrada." />
                                        ) : (
                                            <List
                                                className="admin-list"
                                                loading={state.isLoadingPublishers}
                                                dataSource={state.publisherRows}
                                                renderItem={(publisher) => (
                                                    <List.Item
                                                        className="admin-list-item"
                                                        actions={[
                                                            <Button
                                                                key="edit"
                                                                icon={<EditOutlined />}
                                                                onClick={() => actions.openEditPublisherModal(publisher)}
                                                            >
                                                                Editar
                                                            </Button>,
                                                            <Popconfirm
                                                                key="delete"
                                                                title="Excluir editora"
                                                                description="Essa ação não pode ser desfeita."
                                                                okText="Excluir"
                                                                cancelText="Cancelar"
                                                                onConfirm={() => {
                                                                    void actions.removePublisher(publisher.id);
                                                                }}
                                                            >
                                                                <Button danger icon={<DeleteOutlined />}>
                                                                    Excluir
                                                                </Button>
                                                            </Popconfirm>,
                                                        ]}
                                                    >
                                                        <List.Item.Meta
                                                            title={publisher.name}
                                                            description={<span>ID: {publisher.id}</span>}
                                                        />
                                                    </List.Item>
                                                )}
                                            />
                                        )}
                                    </Card>
                                ),
                            },
                            {
                                key: "subjects",
                                label: "Assuntos",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card"
                                        title="Manutenção de assuntos"
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreateSubjectModal}
                                            >
                                                Novo assunto
                                            </Button>
                                        }
                                    >
                                        <div className="users-toolbar">
                                            <Input
                                                placeholder="Buscar por nome ou ID..."
                                                value={state.subjectSearch}
                                                onChange={(event) => actions.setSubjectSearch(event.target.value)}
                                                onPressEnter={actions.applySubjectSearch}
                                            />
                                            <Button type="primary" onClick={actions.applySubjectSearch}>
                                                Buscar
                                            </Button>
                                            <Button onClick={actions.clearSubjectSearch}>Limpar</Button>
                                        </div>

                                        {state.subjectRows.length === 0 && !state.isLoadingSubjects ? (
                                            <Empty description="Nenhum assunto encontrado." />
                                        ) : (
                                            <List
                                                className="admin-list"
                                                loading={state.isLoadingSubjects}
                                                dataSource={state.subjectRows}
                                                renderItem={(subject) => (
                                                    <List.Item
                                                        className="admin-list-item"
                                                        actions={[
                                                            <Button
                                                                key="edit"
                                                                icon={<EditOutlined />}
                                                                onClick={() => actions.openEditSubjectModal(subject)}
                                                            >
                                                                Editar
                                                            </Button>,
                                                            <Popconfirm
                                                                key="delete"
                                                                title="Excluir assunto"
                                                                description="Essa ação não pode ser desfeita."
                                                                okText="Excluir"
                                                                cancelText="Cancelar"
                                                                onConfirm={() => {
                                                                    void actions.removeSubject(subject.id);
                                                                }}
                                                            >
                                                                <Button danger icon={<DeleteOutlined />}>
                                                                    Excluir
                                                                </Button>
                                                            </Popconfirm>,
                                                        ]}
                                                    >
                                                        <List.Item.Meta
                                                            title={subject.name}
                                                            description={<span>ID: {subject.id}</span>}
                                                        />
                                                    </List.Item>
                                                )}
                                            />
                                        )}
                                    </Card>
                                ),
                            },
                            {
                                key: "authors",
                                label: "Autores",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card"
                                        title="Manutenção de autores"
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreateAuthorModal}
                                            >
                                                Novo autor
                                            </Button>
                                        }
                                    >
                                        <div className="users-toolbar">
                                            <Input
                                                placeholder="Buscar por nome ou ID..."
                                                value={state.authorSearch}
                                                onChange={(event) => actions.setAuthorSearch(event.target.value)}
                                                onPressEnter={actions.applyAuthorSearch}
                                            />
                                            <Button type="primary" onClick={actions.applyAuthorSearch}>
                                                Buscar
                                            </Button>
                                            <Button onClick={actions.clearAuthorSearch}>Limpar</Button>
                                        </div>

                                        {state.authorRows.length === 0 && !state.isLoadingAuthors ? (
                                            <Empty description="Nenhum autor encontrado." />
                                        ) : (
                                            <List
                                                className="admin-list"
                                                loading={state.isLoadingAuthors}
                                                dataSource={state.authorRows}
                                                renderItem={(author) => (
                                                    <List.Item
                                                        className="admin-list-item"
                                                        actions={[
                                                            <Button
                                                                key="edit"
                                                                icon={<EditOutlined />}
                                                                onClick={() => actions.openEditAuthorModal(author)}
                                                            >
                                                                Editar
                                                            </Button>,
                                                            <Popconfirm
                                                                key="delete"
                                                                title="Excluir autor"
                                                                description="Essa ação não pode ser desfeita."
                                                                okText="Excluir"
                                                                cancelText="Cancelar"
                                                                onConfirm={() => {
                                                                    void actions.removeAuthor(author.id);
                                                                }}
                                                            >
                                                                <Button danger icon={<DeleteOutlined />}>
                                                                    Excluir
                                                                </Button>
                                                            </Popconfirm>,
                                                        ]}
                                                    >
                                                        <List.Item.Meta
                                                            title={author.name}
                                                            description={<span>ID: {author.id}</span>}
                                                        />
                                                    </List.Item>
                                                )}
                                            />
                                        )}
                                    </Card>
                                ),
                            },
                            {
                                key: "oauth-clients",
                                label: "Parceiros",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card oauth-partners-card"
                                        title={
                                            <div className="oauth-partners-heading">
                                                <span>Parceiros e integrações</span>
                                                <Typography.Text type="secondary">
                                                    Gerencie sistemas externos que acessam o BiblioWeb.
                                                </Typography.Text>
                                            </div>
                                        }
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreateOAuthClientModal}
                                            >
                                                Cadastrar parceiro
                                            </Button>
                                        }
                                    >
                                        <Tabs
                                            className="oauth-partner-tabs"
                                            activeKey={partnerSection}
                                            onChange={(key) => {
                                                const nextSection = key === "audit" ? "audit" : "partners";
                                                setPartnerSection(nextSection);
                                                if (nextSection === "audit") {
                                                    void actions.loadAuditEvents();
                                                }
                                            }}
                                            items={[
                                                {
                                                    key: "partners",
                                                    label: "Parceiros",
                                                    children: (
                                                        <>
                                                            <div className="oauth-partner-toolbar">
                                                                <Input
                                                                    allowClear
                                                                    prefix={<SearchOutlined />}
                                                                    placeholder="Buscar por nome, organização, contato ou ID..."
                                                                    value={partnerSearch}
                                                                    onChange={(event) => setPartnerSearch(event.target.value)}
                                                                />
                                                                <Select
                                                                    aria-label="Filtrar parceiros por status"
                                                                    value={partnerStatus}
                                                                    onChange={(value) => setPartnerStatus(value)}
                                                                    options={[
                                                                        { value: "active", label: "Ativos" },
                                                                        { value: "inactive", label: "Inativos" },
                                                                        { value: "all", label: "Todos" },
                                                                    ]}
                                                                />
                                                            </div>

                                                            {visibleOAuthClients.length === 0 && !state.isLoadingOAuthClients ? (
                                                                <Empty
                                                                    description={
                                                                        partnerSearch
                                                                            ? "Nenhum parceiro corresponde à busca."
                                                                            : "Nenhum parceiro encontrado."
                                                                    }
                                                                />
                                                            ) : (
                                                                <List
                                                                    className="admin-list oauth-partner-list"
                                                                    loading={state.isLoadingOAuthClients}
                                                                    dataSource={visibleOAuthClients}
                                                                    renderItem={(client) => {
                                                                        const revealedUrl =
                                                                            state.revealedSecretUrlByClientId[client.id];
                                                                        const isExpired = Boolean(
                                                                            client.expires_at &&
                                                                                new Date(client.expires_at) < new Date()
                                                                        );
                                                                        const scopeGroups = Array.from(
                                                                            new Set(client.scopes.map(getOAuthScopeGroup))
                                                                        );

                                                                        return (
                                                                            <List.Item className="admin-list-item oauth-partner-row">
                                                                                <div className="oauth-partner-main">
                                                                                    <div className="oauth-partner-identity">
                                                                                        <div className="oauth-partner-title-row">
                                                                                            <Typography.Text strong>
                                                                                                {client.name}
                                                                                            </Typography.Text>
                                                                                            {!client.active && <Tag>Inativo</Tag>}
                                                                                            {isExpired && <Tag color="error">Expirado</Tag>}
                                                                                            {client.library_ids.length === 0 && (
                                                                                                <Tag color="warning">Sem bibliotecas</Tag>
                                                                                            )}
                                                                                        </div>
                                                                                        {client.organization && (
                                                                                            <span className="oauth-partner-secondary">
                                                                                                {client.organization}
                                                                                            </span>
                                                                                        )}
                                                                                        <span
                                                                                            className="oauth-partner-id"
                                                                                            title={client.id}
                                                                                        >
                                                                                            ID: {client.id}
                                                                                        </span>
                                                                                    </div>

                                                                                    <div className="oauth-partner-access">
                                                                                        <span className="oauth-partner-access-summary">
                                                                                            {client.library_ids.length}{" "}
                                                                                            {client.library_ids.length === 1
                                                                                                ? "biblioteca"
                                                                                                : "bibliotecas"}
                                                                                            {" · "}
                                                                                            {client.scopes.length}{" "}
                                                                                            {client.scopes.length === 1
                                                                                                ? "permissão"
                                                                                                : "permissões"}
                                                                                        </span>
                                                                                        <div className="oauth-partner-scope-groups">
                                                                                            {scopeGroups.map((group) => (
                                                                                                <Tag key={group}>{group}</Tag>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="oauth-partner-actions">
                                                                                        {client.active ? (
                                                                                            <>
                                                                                                <Button
                                                                                                    icon={<EditOutlined />}
                                                                                                    onClick={() =>
                                                                                                        actions.openEditOAuthClientModal(
                                                                                                            client
                                                                                                        )
                                                                                                    }
                                                                                                >
                                                                                                    Editar
                                                                                                </Button>
                                                                                                <Dropdown
                                                                                                    trigger={["click"]}
                                                                                                    menu={{
                                                                                                        items: [
                                                                                                            {
                                                                                                                key: "history",
                                                                                                                label: "Ver histórico",
                                                                                                            },
                                                                                                            {
                                                                                                                key: "rotate",
                                                                                                                icon: <KeyOutlined />,
                                                                                                                label: "Gerar novo segredo",
                                                                                                            },
                                                                                                            { type: "divider" },
                                                                                                            {
                                                                                                                key: "deactivate",
                                                                                                                icon: <DeleteOutlined />,
                                                                                                                label: "Desativar parceiro",
                                                                                                                danger: true,
                                                                                                            },
                                                                                                        ],
                                                                                                        onClick: ({ key }) => {
                                                                                                            if (key === "history") {
                                                                                                                openPartnerAudit(client.id);
                                                                                                                return;
                                                                                                            }
                                                                                                            if (key === "rotate") {
                                                                                                                modal.confirm({
                                                                                                                    title: "Gerar novo segredo?",
                                                                                                                    content:
                                                                                                                        "O segredo atual deixará de funcionar imediatamente. Atualize a integração do parceiro após gerar a nova credencial.",
                                                                                                                    okText: "Gerar novo segredo",
                                                                                                                    cancelText: "Cancelar",
                                                                                                                    onOk: () =>
                                                                                                                        actions.rotateOAuthClientSecretById(
                                                                                                                            client.id
                                                                                                                        ),
                                                                                                                });
                                                                                                                return;
                                                                                                            }
                                                                                                            if (key === "deactivate") {
                                                                                                                modal.confirm({
                                                                                                                    title: "Desativar parceiro?",
                                                                                                                    content:
                                                                                                                        "A integração deixará de autenticar até ser reativada.",
                                                                                                                    okText: "Desativar",
                                                                                                                    okButtonProps: { danger: true },
                                                                                                                    cancelText: "Cancelar",
                                                                                                                    onOk: () =>
                                                                                                                        actions.removeOAuthClient(
                                                                                                                            client.id
                                                                                                                        ),
                                                                                                                });
                                                                                                            }
                                                                                                        },
                                                                                                    }}
                                                                                                >
                                                                                                    <Button
                                                                                                        aria-label={`Mais ações para ${client.name}`}
                                                                                                        icon={<MoreOutlined />}
                                                                                                    />
                                                                                                </Dropdown>
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <Popconfirm
                                                                                                    title="Reativar parceiro?"
                                                                                                    description="A integração voltará a poder autenticar. A data de expiração, se existir, continuará valendo."
                                                                                                    okText="Reativar"
                                                                                                    cancelText="Cancelar"
                                                                                                    onConfirm={() =>
                                                                                                        actions.reactivateOAuthClientById(
                                                                                                            client.id
                                                                                                        )
                                                                                                    }
                                                                                                >
                                                                                                    <Button icon={<ReloadOutlined />}>
                                                                                                        Reativar
                                                                                                    </Button>
                                                                                                </Popconfirm>
                                                                                                <Dropdown
                                                                                                    trigger={["click"]}
                                                                                                    menu={{
                                                                                                        items: [
                                                                                                            {
                                                                                                                key: "history",
                                                                                                                label: "Ver histórico",
                                                                                                            },
                                                                                                        ],
                                                                                                        onClick: () => openPartnerAudit(client.id),
                                                                                                    }}
                                                                                                >
                                                                                                    <Button
                                                                                                        aria-label={`Mais ações para ${client.name}`}
                                                                                                        icon={<MoreOutlined />}
                                                                                                    />
                                                                                                </Dropdown>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {revealedUrl && (
                                                                                    <div className="oauth-secret-reveal-banner">
                                                                                        <div className="oauth-secret-reveal-summary">
                                                                                            <KeyOutlined />
                                                                                            <div>
                                                                                                <strong>Novo segredo gerado</strong>
                                                                                                <span>
                                                                                                    Um link seguro está disponível por até 72 horas e pode ser usado uma única vez para revelar a credencial.
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="oauth-secret-reveal-actions">
                                                                                            <Button
                                                                                                size="small"
                                                                                                icon={<CopyOutlined />}
                                                                                                onClick={() =>
                                                                                                    void navigator.clipboard.writeText(revealedUrl)
                                                                                                }
                                                                                            >
                                                                                                Copiar link
                                                                                            </Button>
                                                                                            <Button
                                                                                                size="small"
                                                                                                type="link"
                                                                                                icon={<ExportOutlined />}
                                                                                                href={revealedUrl}
                                                                                                target="_blank"
                                                                                                rel="noreferrer"
                                                                                            >
                                                                                                Abrir página de revelação
                                                                                            </Button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </List.Item>
                                                                        );
                                                                    }}
                                                                />
                                                            )}
                                                        </>
                                                    ),
                                                },
                                                {
                                                    key: "audit",
                                                    label: "Auditoria",
                                                    children: (
                                                        <div className="oauth-audit-panel">
                                                            <div className="oauth-audit-heading">
                                                                <div>
                                                                    <Typography.Title level={4}>
                                                                        Auditoria de integrações
                                                                    </Typography.Title>
                                                                    <Typography.Text type="secondary">
                                                                        Consulte autenticações, alterações e operações realizadas pelos parceiros.
                                                                    </Typography.Text>
                                                                </div>
                                                                {state.auditFilters.client_id && (
                                                                    <Tag closable onClose={() => {
                                                                        const nextFilters: OAuthAuditFilters = {
                                                                            ...state.auditFilters,
                                                                            client_id: undefined,
                                                                            page: 1,
                                                                        };
                                                                        actions.setAuditFilters(nextFilters);
                                                                        void actions.loadAuditEvents(nextFilters);
                                                                    }}>
                                                                        Histórico de {oauthClientById.get(state.auditFilters.client_id)?.name || "parceiro"}
                                                                    </Tag>
                                                                )}
                                                            </div>

                                                            <div className="oauth-audit-toolbar">
                                                                <div className="oauth-audit-filter-field">
                                                                    <label>Parceiro</label>
                                                                    <Select
                                                                        allowClear
                                                                        showSearch
                                                                        optionFilterProp="label"
                                                                        placeholder="Todos os parceiros"
                                                                        value={state.auditFilters.client_id}
                                                                        onChange={(value) =>
                                                                            actions.setAuditFilters((previous) => ({
                                                                                ...previous,
                                                                                client_id: value,
                                                                                page: 1,
                                                                            }))
                                                                        }
                                                                        options={auditPartnerOptions}
                                                                    />
                                                                </div>
                                                                <div className="oauth-audit-filter-field">
                                                                    <label>Evento</label>
                                                                    <Select
                                                                        allowClear
                                                                        placeholder="Todos os eventos"
                                                                        value={state.auditFilters.event_type}
                                                                        onChange={(value) =>
                                                                            actions.setAuditFilters((previous) => ({
                                                                                ...previous,
                                                                                event_type: value,
                                                                                page: 1,
                                                                            }))
                                                                        }
                                                                        options={auditEventOptions}
                                                                    />
                                                                </div>
                                                                <div className="oauth-audit-filter-field oauth-audit-date-field">
                                                                    <label>De</label>
                                                                    <Input
                                                                        type="datetime-local"
                                                                        value={state.auditFilters.date_from || ""}
                                                                        onChange={(event) =>
                                                                            actions.setAuditFilters((previous) => ({
                                                                                ...previous,
                                                                                date_from: event.target.value || undefined,
                                                                                page: 1,
                                                                            }))
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="oauth-audit-filter-field oauth-audit-date-field">
                                                                    <label>Até</label>
                                                                    <Input
                                                                        type="datetime-local"
                                                                        value={state.auditFilters.date_to || ""}
                                                                        onChange={(event) =>
                                                                            actions.setAuditFilters((previous) => ({
                                                                                ...previous,
                                                                                date_to: event.target.value || undefined,
                                                                                page: 1,
                                                                            }))
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="oauth-audit-filter-actions">
                                                                    <Button
                                                                        type="primary"
                                                                        onClick={() => {
                                                                            const nextFilters = {
                                                                                ...state.auditFilters,
                                                                                page: 1,
                                                                            };
                                                                            actions.setAuditFilters(nextFilters);
                                                                            void actions.loadAuditEvents(nextFilters);
                                                                        }}
                                                                    >
                                                                        Filtrar
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => {
                                                                            const nextFilters: OAuthAuditFilters = {
                                                                                page: 1,
                                                                                page_size: state.auditFilters.page_size ?? 20,
                                                                            };
                                                                            actions.setAuditFilters(nextFilters);
                                                                            void actions.loadAuditEvents(nextFilters);
                                                                        }}
                                                                    >
                                                                        Limpar
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <Table<OAuthAuditEvent>
                                                                className="oauth-audit-table"
                                                                loading={state.isLoadingAudit}
                                                                dataSource={state.auditEvents}
                                                                pagination={false}
                                                                scroll={{ x: 760, y: 520 }}
                                                                locale={{ emptyText: "Nenhum evento encontrado." }}
                                                                rowKey={(event) =>
                                                                    [
                                                                        event.created_at || "sem-data",
                                                                        event.event_type,
                                                                        event.client_id || "sem-parceiro",
                                                                        event.correlation_id || "sem-correlacao",
                                                                    ].join("|")
                                                                }
                                                                onRow={(event) => ({
                                                                    onClick: () => setSelectedAuditEvent(event),
                                                                })}
                                                                columns={[
                                                                    {
                                                                        title: "Data/hora",
                                                                        dataIndex: "created_at",
                                                                        key: "created_at",
                                                                        width: 180,
                                                                        render: (value: string | null) => (
                                                                            <span className="oauth-audit-date">
                                                                                {formatOAuthAuditDateTime(value)}
                                                                            </span>
                                                                        ),
                                                                    },
                                                                    {
                                                                        title: "Evento",
                                                                        dataIndex: "event_type",
                                                                        key: "event_type",
                                                                        render: (eventType: string) => (
                                                                            <div className="oauth-audit-event-cell">
                                                                                <strong>{translateOAuthAuditEventType(eventType)}</strong>
                                                                                <span>{getOAuthAuditEventCategory(eventType)}</span>
                                                                            </div>
                                                                        ),
                                                                    },
                                                                    {
                                                                        title: "Parceiro",
                                                                        dataIndex: "client_id",
                                                                        key: "client_id",
                                                                        render: (clientId: string | null) => {
                                                                            if (!clientId) {
                                                                                return <span className="oauth-audit-muted">—</span>;
                                                                            }
                                                                            const partner = oauthClientById.get(clientId);
                                                                            return (
                                                                                <div className="oauth-audit-partner-cell">
                                                                                    <strong>{partner?.name || "Parceiro não identificado"}</strong>
                                                                                    <span title={clientId}>{clientId}</span>
                                                                                </div>
                                                                            );
                                                                        },
                                                                    },
                                                                    {
                                                                        title: "Resultado",
                                                                        dataIndex: "result",
                                                                        key: "result",
                                                                        width: 120,
                                                                        render: (result: string, event: OAuthAuditEvent) => (
                                                                            <Tag color={getOAuthAuditResultColor(result, event.event_type)}>
                                                                                {translateOAuthAuditResult(result)}
                                                                            </Tag>
                                                                        ),
                                                                    },
                                                                    {
                                                                        title: "",
                                                                        key: "details",
                                                                        width: 52,
                                                                        render: (_value: unknown, event: OAuthAuditEvent) => (
                                                                            <Button
                                                                                type="text"
                                                                                aria-label={`Ver detalhes de ${translateOAuthAuditEventType(event.event_type)}`}
                                                                                icon={<RightOutlined />}
                                                                                onClick={(clickEvent) => {
                                                                                    clickEvent.stopPropagation();
                                                                                    setSelectedAuditEvent(event);
                                                                                }}
                                                                            />
                                                                        ),
                                                                    },
                                                                ]}
                                                            />

                                                            <List
                                                                className="oauth-audit-mobile-list"
                                                                loading={state.isLoadingAudit}
                                                                dataSource={state.auditEvents}
                                                                locale={{ emptyText: "Nenhum evento encontrado." }}
                                                                renderItem={(event) => {
                                                                    const partner = event.client_id
                                                                        ? oauthClientById.get(event.client_id)
                                                                        : undefined;
                                                                    return (
                                                                        <List.Item
                                                                            className="oauth-audit-mobile-item"
                                                                            onClick={() => setSelectedAuditEvent(event)}
                                                                        >
                                                                            <div className="oauth-audit-mobile-main">
                                                                                <div className="oauth-audit-mobile-title">
                                                                                    <strong>
                                                                                        {translateOAuthAuditEventType(event.event_type)}
                                                                                    </strong>
                                                                                    <Tag
                                                                                        color={getOAuthAuditResultColor(
                                                                                            event.result,
                                                                                            event.event_type
                                                                                        )}
                                                                                    >
                                                                                        {translateOAuthAuditResult(event.result)}
                                                                                    </Tag>
                                                                                </div>
                                                                                <span>{formatOAuthAuditDateTime(event.created_at)}</span>
                                                                                <span>
                                                                                    {partner?.name ||
                                                                                        (event.client_id
                                                                                            ? "Parceiro não identificado"
                                                                                            : "Sem parceiro associado")}
                                                                                </span>
                                                                            </div>
                                                                            <RightOutlined />
                                                                        </List.Item>
                                                                    );
                                                                }}
                                                            />

                                                            <div className="oauth-audit-footer">
                                                                <span>
                                                                    {state.auditPagination
                                                                        ? `${state.auditPagination.total.toLocaleString("pt-BR")} eventos`
                                                                        : `${state.auditEvents.length.toLocaleString("pt-BR")} eventos`}
                                                                </span>
                                                                {state.auditPagination && (
                                                                    <Pagination
                                                                        current={state.auditPagination.page}
                                                                        pageSize={state.auditPagination.page_size}
                                                                        total={state.auditPagination.total}
                                                                        showSizeChanger
                                                                        pageSizeOptions={[10, 20, 50]}
                                                                        onChange={(page, pageSize) => {
                                                                            const nextFilters: OAuthAuditFilters = {
                                                                                ...state.auditFilters,
                                                                                page,
                                                                                page_size: pageSize,
                                                                            };
                                                                            actions.setAuditFilters(nextFilters);
                                                                            void actions.loadAuditEvents(nextFilters);
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ),
                                                },
                                            ]}
                                        />
                                    </Card>
                                ),
                            },
                        ]}
                    />
                </section>
            </Content>

            <Drawer
                title={
                    selectedAuditEvent
                        ? translateOAuthAuditEventType(selectedAuditEvent.event_type)
                        : "Detalhes do evento"
                }
                open={Boolean(selectedAuditEvent)}
                onClose={() => setSelectedAuditEvent(null)}
                width="min(520px, 100vw)"
                extra={
                    selectedAuditEvent ? (
                        <Tag color={getOAuthAuditResultColor(selectedAuditEvent.result, selectedAuditEvent.event_type)}>
                            {translateOAuthAuditResult(selectedAuditEvent.result)}
                        </Tag>
                    ) : null
                }
            >
                {selectedAuditEvent && (
                    <div className="oauth-audit-drawer">
                        <div className="oauth-audit-drawer-summary">
                            <span>{formatOAuthAuditDateTime(selectedAuditEvent.created_at, "pt-BR", true)}</span>
                            {selectedAuditEvent.client_id && (
                                <div>
                                    <strong>Parceiro</strong>
                                    <span>
                                        {oauthClientById.get(selectedAuditEvent.client_id)?.name ||
                                            "Parceiro não identificado"}
                                    </span>
                                    <Typography.Text copyable={{ text: selectedAuditEvent.client_id }}>
                                        {selectedAuditEvent.client_id}
                                    </Typography.Text>
                                </div>
                            )}
                        </div>

                        {selectedAuditDetails.length > 0 && (
                            <div className="oauth-audit-detail-list">
                                {selectedAuditDetails.map((detail) => (
                                    <div key={detail.key} className="oauth-audit-detail-row">
                                        <span>{detail.label}</span>
                                        {detail.copyable ? (
                                            <Typography.Text copyable={{ text: detail.value }}>
                                                {detail.value}
                                            </Typography.Text>
                                        ) : (
                                            <strong>{detail.value}</strong>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <details className="oauth-audit-technical-details">
                            <summary>Detalhes técnicos</summary>
                            <dl>
                                <div>
                                    <dt>event_type</dt>
                                    <dd>{selectedAuditEvent.event_type}</dd>
                                </div>
                                <div>
                                    <dt>client_id</dt>
                                    <dd>{selectedAuditEvent.client_id || "—"}</dd>
                                </div>
                                <div>
                                    <dt>user_id</dt>
                                    <dd>{selectedAuditEvent.user_id || "—"}</dd>
                                </div>
                                <div>
                                    <dt>library_id</dt>
                                    <dd>{selectedAuditEvent.library_id ?? "—"}</dd>
                                </div>
                                <div>
                                    <dt>correlation_id</dt>
                                    <dd>{selectedAuditEvent.correlation_id || "—"}</dd>
                                </div>
                            </dl>
                            <div className="oauth-audit-metadata">
                                <span>metadata</span>
                                <pre>{JSON.stringify(selectedAuditEvent.metadata || {}, null, 2)}</pre>
                            </div>
                        </details>
                    </div>
                )}
            </Drawer>

            <Modal
                title={state.bookModalMode === "create" ? "Adicionar livro" : "Editar livro"}
                open={state.bookModalOpen}
                onCancel={actions.closeBookModal}
                footer={null}
                width={900}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void actions.saveBook(event)}>
                    {state.bookModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.bookModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    <div className="form-grid">
                        <div className="form-field">
                            <label className="field-label">Título (*) <span className="marc-tag">[245$a]</span></label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.title ? "error" : undefined}
                                value={state.bookForm.title}
                                onChange={(event) => {
                                    actions.setBookForm((previous) => ({ ...previous, title: event.target.value }));
                                    actions.clearBookFieldError("title");
                                }}
                            />
                            {state.bookFormErrors.title && (
                                <span className="form-field-error">{state.bookFormErrors.title}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">Subtítulo <span className="marc-tag">[246$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.subtitle}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, subtitle: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Título original <span className="marc-tag">[240$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.original_title}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, original_title: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Autor Pessoa Jurídica <span className="marc-tag">[110$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.corporate_author}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        corporate_author: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Autores (*) <span className="marc-tag">[100$a]</span></label>
                            <Select
                                mode="multiple"
                                className="admin-select"
                                status={state.bookFormErrors.authors ? "error" : undefined}
                                placeholder="Selecione um ou mais autores"
                                value={state.bookForm.authors}
                                options={authorOptions}
                                onChange={(values: string[]) => {
                                    actions.setBookForm((previous) => ({ ...previous, authors: values }));
                                    actions.clearBookFieldError("authors");
                                }}
                                optionFilterProp="label"
                                showSearch
                            />
                            {state.bookFormErrors.authors && (
                                <span className="form-field-error">{state.bookFormErrors.authors}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">Editora (*) <span className="marc-tag">[260$b]</span></label>
                            <Select
                                className="admin-select"
                                status={state.bookFormErrors.publisher ? "error" : undefined}
                                placeholder="Selecione a editora"
                                value={state.bookForm.publisher || undefined}
                                options={bookPublisherOptions}
                                onChange={(value: string) => {
                                    actions.setBookForm((previous) => ({ ...previous, publisher: value || "" }));
                                    actions.clearBookFieldError("publisher");
                                }}
                                showSearch
                                optionFilterProp="label"
                            />
                            {state.bookFormErrors.publisher && (
                                <span className="form-field-error">{state.bookFormErrors.publisher}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">Local de publicação <span className="marc-tag">[260$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.publication_place}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, publication_place: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Ano <span className="marc-tag">[260$c]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.year}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, year: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Assuntos (*) <span className="marc-tag">[650$a]</span></label>
                            <Select
                                mode="multiple"
                                className="admin-select"
                                status={state.bookFormErrors.subjects ? "error" : undefined}
                                placeholder="Selecione um ou mais assuntos"
                                value={state.bookForm.subjects}
                                options={subjectOptions}
                                onChange={(values: string[]) => {
                                    actions.setBookForm((previous) => ({ ...previous, subjects: values }));
                                    actions.clearBookFieldError("subjects");
                                }}
                                optionFilterProp="label"
                                showSearch
                            />
                            {state.bookFormErrors.subjects && (
                                <span className="form-field-error">{state.bookFormErrors.subjects}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">CDD <span className="marc-tag">[082$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.dewey_decimal}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, dewey_decimal: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Tipo</label>
                            <Select
                                className="admin-select"
                                value={state.bookForm.type || undefined}
                                options={[
                                    { value: "protected", label: "Protegido" },
                                    { value: "free", label: "Domínio Público" },
                                    { value: "external", label: "Externo" },
                                ]}
                                onChange={(value: string) =>
                                    actions.setBookForm((previous) => ({ ...previous, type: value || "protected" }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">
                                URL externa <span className="marc-tag">[856$u]</span>
                                {state.bookForm.type === "external" ? " (*)" : ""}
                            </label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.external_url ? "error" : undefined}
                                value={state.bookForm.external_url}
                                onChange={(event) => {
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        external_url: event.target.value,
                                    }));
                                    actions.clearBookFieldError("external_url");
                                }}
                            />
                            {state.bookFormErrors.external_url && (
                                <span className="form-field-error">{state.bookFormErrors.external_url}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">
                                Fonte Externa <span className="marc-tag">[500$a]</span>
                                {state.bookForm.type === "external" ? " (*)" : ""}
                            </label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.external_source ? "error" : undefined}
                                value={state.bookForm.external_source}
                                onChange={(event) => {
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        external_source: event.target.value,
                                    }));
                                    actions.clearBookFieldError("external_source");
                                }}
                            />
                            {state.bookFormErrors.external_source && (
                                <span className="form-field-error">{state.bookFormErrors.external_source}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">
                                Nome do arquivo
                                {state.bookForm.type !== "external" ? " (*)" : ""}
                            </label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.file_name ? "error" : undefined}
                                value={state.bookForm.file_name}
                                onChange={(event) => {
                                    actions.setBookForm((previous) => ({ ...previous, file_name: event.target.value }));
                                    actions.clearBookFieldError("file_name");
                                }}
                            />
                            {state.bookFormErrors.file_name && (
                                <span className="form-field-error">{state.bookFormErrors.file_name}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">URL da capa</label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.image_url ? "error" : undefined}
                                value={state.bookForm.image_url}
                                onChange={(event) => {
                                    actions.setBookForm((previous) => ({ ...previous, image_url: event.target.value }));
                                    actions.clearBookFieldError("image_url");
                                }}
                            />
                            {state.bookFormErrors.image_url && (
                                <span className="form-field-error">{state.bookFormErrors.image_url}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">URL Versão HTML</label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.html_version_url}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        html_version_url: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Edição (*) <span className="marc-tag">[250$a]</span></label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.edition ? "error" : undefined}
                                value={state.bookForm.edition}
                                onChange={(event) => {
                                    actions.setBookForm((previous) => ({ ...previous, edition: event.target.value }));
                                    actions.clearBookFieldError("edition");
                                }}
                            />
                            {state.bookFormErrors.edition && (
                                <span className="form-field-error">{state.bookFormErrors.edition}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">ISBN <span className="marc-tag">[020$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.isbn}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, isbn: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Páginas</label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.pages}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, pages: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Idioma <span className="marc-tag">[041$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.language}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, language: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Tipo de conteúdo <span className="marc-tag">[336$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.content_type}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, content_type: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Tipo de mídia <span className="marc-tag">[337$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.media_type}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, media_type: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Tipo de suporte <span className="marc-tag">[338$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.carrier_type}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({ ...previous, carrier_type: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field form-field-full">
                            <label className="field-label">Acervo (opcional)</label>
                            <Select
                                allowClear
                                mode="multiple"
                                className="admin-select"
                                status={state.bookFormErrors.libraries ? "error" : undefined}
                                placeholder="Selecione um ou mais acervos"
                                value={state.bookForm.libraries.map((item) => item.library)}
                                options={libraryOptions}
                                onChange={(values: string[]) => {
                                    actions.setBookLibrarySelection(values);
                                    actions.clearBookFieldError("libraries");
                                }}
                                optionFilterProp="label"
                                showSearch
                            />
                            <span className="form-field-helper">
                                A política é editada abaixo, por acervo selecionado.
                            </span>
                            {state.bookFormErrors.libraries && (
                                <span className="form-field-error">{state.bookFormErrors.libraries}</span>
                            )}
                        </div>
                        <BookLibraryPolicyGrid
                            label="Política por acervo"
                            helperText="Licenças disponíveis e máximo de usos são editáveis quando houver acervo vinculado. O livro também pode ser salvo sem acervo."
                            error={state.bookFormErrors.library_policy}
                            value={state.bookForm.libraries}
                            showPurchasePrice
                            options={libraryOptions}
                            emptyDescription="Nenhum acervo vinculado. O livro pode ser salvo assim."
                            onChange={(libraries) => {
                                actions.setBookLibraries(libraries);
                                actions.clearBookFieldError("library_policy");
                            }}
                        />
                        <div className="form-field switch-field">
                            <label className="field-label">Livro ativo</label>
                            <Switch
                                checked={state.bookForm.active}
                                onChange={(checked) =>
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        active: checked,
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <div className="form-field form-field-full">
                        <label className="field-label">Resumo <span className="marc-tag">[520$a]</span></label>
                        <Input.TextArea
                            className="admin-input"
                            rows={3}
                            value={state.bookForm.summary}
                            onChange={(event) =>
                                actions.setBookForm((previous) => ({ ...previous, summary: event.target.value }))
                            }
                        />
                    </div>
                    <div className="form-field form-field-full">
                        <label className="field-label">Nota geral <span className="marc-tag">[500$a]</span></label>
                        <Input.TextArea
                            className="admin-input"
                            rows={3}
                            value={state.bookForm.general_note}
                            onChange={(event) =>
                                actions.setBookForm((previous) => ({ ...previous, general_note: event.target.value }))
                            }
                        />
                    </div>
                    <div className="form-field form-field-full">
                        <label className="field-label">Nota de bibliografia <span className="marc-tag">[504$a]</span></label>
                        <Input.TextArea
                            className="admin-input"
                            rows={3}
                            value={state.bookForm.bibliography_note}
                            onChange={(event) =>
                                actions.setBookForm((previous) => ({ ...previous, bibliography_note: event.target.value }))
                            }
                        />
                    </div>
                    {state.bookModalMode === "create" && (
                        <div className="form-field form-field-full">
                            <label className="field-label">
                                Arquivo (EPUB)
                                {state.bookForm.type !== "external" ? " (*)" : ""}
                            </label>
                            <Upload
                                beforeUpload={(file) => {
                                    actions.setBookFile(file);
                                    actions.clearBookFieldError("file");
                                    return false;
                                }}
                                showUploadList={false}
                            >
                                <Button icon={<UploadOutlined />}>Selecionar arquivo</Button>
                            </Upload>
                            {state.bookFormErrors.file && (
                                <span className="form-field-error">{state.bookFormErrors.file}</span>
                            )}
                            {state.bookFile && (
                                <Typography.Text className="file-name">{state.bookFile.name}</Typography.Text>
                            )}
                        </div>
                    )}
                    <div className="modal-actions">
                        <Button onClick={actions.closeBookModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingBook}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                title={state.userModalMode === "create" ? "Adicionar usuário" : "Editar usuário"}
                open={state.userModalOpen}
                onCancel={actions.closeUserModal}
                footer={null}
                width={640}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void actions.saveUser(event)}>
                    {state.userModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.userModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    {state.userModalMode === "edit" && state.userForm.id && (
                        <section className="admin-ai-usage-card">
                            <div className="admin-ai-usage-header">
                                <div>
                                    <h3>Uso de IA (Blibliotecário)</h3>
                                    <span>
                                        {state.isLoadingUserDailyTokenUsage
                                            ? "Carregando uso diário..."
                                            : state.userDailyTokenUsage
                                                ? `Hoje: ${formatTokenUsage(
                                                    state.userDailyTokenUsage.used,
                                                    state.userDailyTokenUsage.limit
                                                )} usados | ${state.userDailyTokenUsage.available.toLocaleString("pt-BR")} disponíveis`
                                                : "Uso diário indisponível"}
                                    </span>
                                </div>
                                <Popconfirm
                                    title="Resetar tokens diários"
                                    description="Isso libera o usuário para usar novamente o bibliotecário hoje."
                                    okText="Resetar"
                                    cancelText="Cancelar"
                                    onConfirm={() => {
                                        if (state.userForm.id) {
                                            void actions.resetUserDailyTokens(state.userForm.id);
                                        }
                                    }}
                                >
                                    <Button
                                        icon={<ReloadOutlined />}
                                        loading={state.isResettingUserDailyTokens}
                                        disabled={state.isLoadingUserDailyTokenUsage}
                                    >
                                        Zerar uso
                                    </Button>
                                </Popconfirm>
                            </div>
                        </section>
                    )}
                    <div className="form-field">
                        <label className="field-label">E-mail (*)</label>
                        <Input
                            className="admin-input"
                            status={state.userFormErrors.email ? "error" : undefined}
                            value={state.userForm.email}
                            onChange={(event) => {
                                actions.setUserForm((previous) => ({ ...previous, email: event.target.value }));
                                actions.clearUserFieldError("email");
                            }}
                        />
                        {state.userFormErrors.email && (
                            <span className="form-field-error">{state.userFormErrors.email}</span>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="field-label">
                            {state.userModalMode === "create"
                                ? "Senha de leitura (*)"
                                : "Nova senha de leitura (opcional)"}
                        </label>
                        <Input.Password
                            className="admin-input"
                            status={state.userFormErrors.senha ? "error" : undefined}
                            value={state.userForm.senha}
                            onChange={(event) => {
                                actions.setUserForm((previous) => ({ ...previous, senha: event.target.value }));
                                actions.clearUserFieldError("senha");
                            }}
                        />
                        {state.userFormErrors.senha && (
                            <span className="form-field-error">{state.userFormErrors.senha}</span>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="field-label">Dica de senha de leitura (*)</label>
                        <Input
                            className="admin-input"
                            status={state.userFormErrors.dica_senha ? "error" : undefined}
                            value={state.userForm.dica_senha}
                            onChange={(event) => {
                                actions.setUserForm((previous) => ({ ...previous, dica_senha: event.target.value }));
                                actions.clearUserFieldError("dica_senha");
                            }}
                        />
                        {state.userFormErrors.dica_senha && (
                            <span className="form-field-error">{state.userFormErrors.dica_senha}</span>
                        )}
                    </div>
                    <LibraryLimitGrid
                        label="Acervos"
                        helperText="Ative os acervos desejados e ajuste o limite de cada um separadamente."
                        error={state.userFormErrors.library_limits}
                        value={state.userForm.library_limits}
                        options={libraryOptions}
                        emptyDescription="Cadastre um acervo antes de vincular usuários."
                        defaultLimit="3"
                        onChange={(values) =>
                            actions.setUserForm((previous) => ({
                                ...previous,
                                library_limits: values,
                            }))
                        }
                    />
                    <div className="form-field form-field-full">
                        <label className="field-label">Editoras</label>
                        {publisherOptions.length === 0 ? (
                            <Empty description="Cadastre editoras antes de vincular usuários." />
                        ) : (
                            <div className="admin-publisher-permission-grid">
                                {publisherOptions.map((option) => {
                                    const selectedPublisher = state.userForm.publishers.find(
                                        (item) => item.publisher === option.value
                                    );
                                    const isLinked = Boolean(selectedPublisher);

                                    return (
                                        <div
                                            key={option.value}
                                            className={`admin-publisher-permission-card${isLinked ? " is-selected" : ""}`}
                                        >
                                            <div className="admin-publisher-permission-main">
                                                <span className="admin-publisher-permission-title">
                                                    {option.label}
                                                </span>
                                                <span className="admin-publisher-permission-status">
                                                    {isLinked ? "Vinculada ao usuário" : "Não vinculada"}
                                                </span>
                                            </div>
                                            <div className="admin-publisher-permission-actions">
                                                <Button
                                                    size="small"
                                                    onClick={() => actions.toggleUserPublisher(option.value)}
                                                >
                                                    {isLinked ? "Remover" : "Vincular"}
                                                </Button>
                                                <div className="switch-field">
                                                    <label className="field-label">Admin</label>
                                                    <Switch
                                                        checked={selectedPublisher?.admin ?? false}
                                                        disabled={!isLinked}
                                                        onChange={(checked) =>
                                                            actions.setUserPublisherAdminFlag(
                                                                option.value,
                                                                checked
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="form-field switch-field">
                        <label className="field-label">Administrador global</label>
                        <Switch
                            checked={state.userForm.admin}
                            onChange={(checked) =>
                                actions.setUserForm((previous) => ({ ...previous, admin: checked }))
                            }
                        />
                    </div>
                    <div className="modal-actions">
                        <Button onClick={actions.closeUserModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingUser}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                title={
                    state.userPasswordForm.email
                        ? `Mudar senha de acesso - ${state.userPasswordForm.email}`
                        : "Mudar senha de acesso"
                }
                open={state.userPasswordModalOpen}
                onCancel={actions.closeUserPasswordModal}
                footer={null}
                width={560}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void actions.saveUserPassword(event)}>
                    {state.userPasswordModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.userPasswordModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    <Alert
                        type="info"
                        showIcon
                        message="A senha de acesso precisa ter no mínimo 12 caracteres e conter letras maiúsculas, minúsculas, números e símbolos. A confirmação deve ser igual à nova senha."
                        className="admin-modal-alert"
                    />
                    <div className="form-field">
                        <label className="field-label">Nova senha de acesso (*)</label>
                        <Input.Password
                            className="admin-input"
                            status={state.userPasswordFormErrors.senha_acesso ? "error" : undefined}
                            value={state.userPasswordForm.senha_acesso}
                            onChange={(event) => {
                                actions.setUserPasswordForm((previous) => ({
                                    ...previous,
                                    senha_acesso: event.target.value,
                                }));
                                actions.clearUserPasswordFieldError("senha_acesso");
                            }}
                        />
                        {state.userPasswordFormErrors.senha_acesso && (
                            <span className="form-field-error">
                                {state.userPasswordFormErrors.senha_acesso}
                            </span>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="field-label">Confirmação de senha (*)</label>
                        <Input.Password
                            className="admin-input"
                            status={
                                state.userPasswordFormErrors.confirmacao_senha ? "error" : undefined
                            }
                            value={state.userPasswordForm.confirmacao_senha}
                            onChange={(event) => {
                                actions.setUserPasswordForm((previous) => ({
                                    ...previous,
                                    confirmacao_senha: event.target.value,
                                }));
                                actions.clearUserPasswordFieldError("confirmacao_senha");
                            }}
                        />
                        {state.userPasswordFormErrors.confirmacao_senha && (
                            <span className="form-field-error">
                                {state.userPasswordFormErrors.confirmacao_senha}
                            </span>
                        )}
                    </div>
                    <div className="modal-actions">
                        <Button onClick={actions.closeUserPasswordModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingUserPassword}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                title={state.libraryModalMode === "create" ? "Nova library" : "Editar library"}
                open={state.libraryModalOpen}
                onCancel={actions.closeLibraryModal}
                footer={null}
                width={520}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void actions.saveLibrary(event)}>
                    {state.libraryModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.libraryModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    <div className="form-field">
                        <label className="field-label">Nome (*)</label>
                        <Input
                            className="admin-input"
                            status={state.libraryFormErrors.nome ? "error" : undefined}
                            value={state.libraryForm.nome}
                            onChange={(event) => {
                                actions.setLibraryForm((previous) => ({ ...previous, nome: event.target.value }));
                                actions.clearLibraryFieldError("nome");
                            }}
                        />
                        {state.libraryFormErrors.nome && (
                            <span className="form-field-error">{state.libraryFormErrors.nome}</span>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="field-label">CNPJ (*)</label>
                        <Input
                            className="admin-input"
                            status={state.libraryFormErrors.cnpj ? "error" : undefined}
                            value={state.libraryForm.cnpj}
                            onChange={(event) => {
                                actions.setLibraryForm((previous) => ({ ...previous, cnpj: event.target.value }));
                                actions.clearLibraryFieldError("cnpj");
                            }}
                        />
                        {state.libraryFormErrors.cnpj && (
                            <span className="form-field-error">{state.libraryFormErrors.cnpj}</span>
                        )}
                    </div>
                    <div className="modal-actions">
                        <Button onClick={actions.closeLibraryModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingLibrary}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                title={state.publisherModalMode === "create" ? "Nova editora" : "Editar editora"}
                open={state.publisherModalOpen}
                onCancel={actions.closePublisherModal}
                footer={null}
                width={520}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void actions.savePublisher(event)}>
                    {state.publisherModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.publisherModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    <div className="form-field">
                        <label className="field-label">ID (*)</label>
                        <Input
                            className="admin-input"
                            status={state.publisherFormErrors.id ? "error" : undefined}
                            value={state.publisherForm.id}
                            disabled={state.publisherModalMode === "edit"}
                            onChange={(event) => {
                                actions.setPublisherForm((previous) => ({ ...previous, id: event.target.value }));
                                actions.clearPublisherFieldError("id");
                            }}
                        />
                        {state.publisherFormErrors.id && (
                            <span className="form-field-error">{state.publisherFormErrors.id}</span>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="field-label">Nome (*)</label>
                        <Input
                            className="admin-input"
                            status={state.publisherFormErrors.name ? "error" : undefined}
                            value={state.publisherForm.name}
                            onChange={(event) => {
                                actions.setPublisherForm((previous) => ({ ...previous, name: event.target.value }));
                                actions.clearPublisherFieldError("name");
                            }}
                        />
                        {state.publisherFormErrors.name && (
                            <span className="form-field-error">{state.publisherFormErrors.name}</span>
                        )}
                    </div>
                    <div className="modal-actions">
                        <Button onClick={actions.closePublisherModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingPublisher}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                title={state.subjectModalMode === "create" ? "Novo assunto" : "Editar assunto"}
                open={state.subjectModalOpen}
                onCancel={actions.closeSubjectModal}
                footer={null}
                width={520}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void actions.saveSubject(event)}>
                    {state.subjectModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.subjectModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    <div className="form-field">
                        <label className="field-label">Nome (*) <span className="marc-tag">[650$a]</span></label>
                        <Input
                            className="admin-input"
                            status={state.subjectFormErrors.name ? "error" : undefined}
                            value={state.subjectForm.name}
                            onChange={(event) => {
                                actions.setSubjectForm((previous) => ({ ...previous, name: event.target.value }));
                                actions.clearSubjectFieldError("name");
                            }}
                        />
                        {state.subjectFormErrors.name && (
                            <span className="form-field-error">{state.subjectFormErrors.name}</span>
                        )}
                    </div>
                    <div className="modal-actions">
                        <Button onClick={actions.closeSubjectModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingSubject}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                title={state.authorModalMode === "create" ? "Novo autor" : "Editar autor"}
                open={state.authorModalOpen}
                onCancel={actions.closeAuthorModal}
                footer={null}
                width={520}
                destroyOnClose
            >
                <form className="admin-form" onSubmit={(event) => void actions.saveAuthor(event)}>
                    {state.authorModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.authorModalError}
                            className="admin-modal-alert"
                        />
                    )}
                    <div className="form-field">
                        <label className="field-label">Nome (*) <span className="marc-tag">[100$a/700$a]</span></label>
                        <Input
                            className="admin-input"
                            status={state.authorFormErrors.name ? "error" : undefined}
                            value={state.authorForm.name}
                            onChange={(event) => {
                                actions.setAuthorForm((previous) => ({ ...previous, name: event.target.value }));
                                actions.clearAuthorFieldError("name");
                            }}
                        />
                        {state.authorFormErrors.name && (
                            <span className="form-field-error">{state.authorFormErrors.name}</span>
                        )}
                    </div>
                    <div className="modal-actions">
                        <Button onClick={actions.closeAuthorModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingAuthor}>
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                title={
                    state.oauthClientModalMode === "create"
                        ? "Cadastrar parceiro"
                        : "Editar parceiro"
                }
                open={state.oauthClientModalOpen}
                onCancel={actions.closeOAuthClientModal}
                footer={null}
                width={760}
                destroyOnClose
            >
                <form
                    className="admin-form oauth-partner-form"
                    onSubmit={(event) => void actions.saveOAuthClient(event)}
                >
                    <Typography.Text type="secondary" className="oauth-partner-modal-intro">
                        Configure a integração e defina quais recursos do BiblioWeb este parceiro poderá acessar.
                    </Typography.Text>

                    {state.oauthClientModalError && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.oauthClientModalError}
                            className="admin-modal-alert"
                        />
                    )}

                    <section className="oauth-form-section">
                        <div className="oauth-form-section-heading">
                            <h3>Dados do parceiro</h3>
                            <span>Identificação e responsáveis pela integração.</span>
                        </div>

                        <div className="form-field">
                            <label className="field-label">Nome da integração (*)</label>
                            <Input
                                className="admin-input"
                                placeholder="Ex.: OPALS Demo Partner"
                                status={state.oauthClientFormErrors.name ? "error" : undefined}
                                value={state.oauthClientForm.name}
                                onChange={(event) => {
                                    actions.setOAuthClientForm((previous) => ({
                                        ...previous,
                                        name: event.target.value,
                                    }));
                                    actions.clearOAuthClientFieldError("name");
                                }}
                            />
                            {state.oauthClientFormErrors.name && (
                                <span className="form-field-error">{state.oauthClientFormErrors.name}</span>
                            )}
                        </div>

                        <div className="oauth-form-grid">
                            <div className="form-field">
                                <label className="field-label">Organização responsável</label>
                                <Input
                                    className="admin-input"
                                    placeholder="Nome da empresa ou instituição"
                                    value={state.oauthClientForm.organization}
                                    onChange={(event) =>
                                        actions.setOAuthClientForm((previous) => ({
                                            ...previous,
                                            organization: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="form-field">
                                <label className="field-label">Validade</label>
                                <Input
                                    className="admin-input"
                                    type="datetime-local"
                                    value={state.oauthClientForm.expires_at}
                                    onChange={(event) =>
                                        actions.setOAuthClientForm((previous) => ({
                                            ...previous,
                                            expires_at: event.target.value,
                                        }))
                                    }
                                />
                                <span className="form-field-helper">Deixe vazio para não definir expiração.</span>
                            </div>
                        </div>

                        <div className="form-field">
                            <label className="field-label">Descrição</label>
                            <Input.TextArea
                                className="admin-input"
                                rows={2}
                                placeholder="Explique brevemente para que esta integração será usada."
                                value={state.oauthClientForm.description}
                                onChange={(event) =>
                                    actions.setOAuthClientForm((previous) => ({
                                        ...previous,
                                        description: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div className="form-field">
                            <label className="field-label">Contatos técnicos</label>
                            {state.oauthClientForm.technical_contacts.map((contact, index) => (
                                <div key={`technical-contact-${index}`} className="oauth-contact-row">
                                    <Input
                                        className="admin-input"
                                        placeholder="Nome"
                                        value={contact.name}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            actions.setOAuthClientForm((previous) => {
                                                const next = [...previous.technical_contacts];
                                                next[index] = { ...next[index], name: value };
                                                return { ...previous, technical_contacts: next };
                                            });
                                        }}
                                    />
                                    <Input
                                        className="admin-input"
                                        placeholder="E-mail"
                                        value={contact.email}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            actions.setOAuthClientForm((previous) => {
                                                const next = [...previous.technical_contacts];
                                                next[index] = { ...next[index], email: value };
                                                return { ...previous, technical_contacts: next };
                                            });
                                        }}
                                    />
                                    <Button
                                        danger
                                        onClick={() =>
                                            actions.setOAuthClientForm((previous) => ({
                                                ...previous,
                                                technical_contacts: previous.technical_contacts.filter(
                                                    (_, itemIndex) => itemIndex !== index
                                                ),
                                            }))
                                        }
                                    >
                                        Remover
                                    </Button>
                                </div>
                            ))}
                            <Button
                                className="oauth-add-secondary"
                                onClick={() =>
                                    actions.setOAuthClientForm((previous) => ({
                                        ...previous,
                                        technical_contacts: [
                                            ...previous.technical_contacts,
                                            { name: "", email: "" },
                                        ],
                                    }))
                                }
                            >
                                + Adicionar contato
                            </Button>
                            {state.oauthClientFormErrors.technical_contacts && (
                                <span className="form-field-error">
                                    {state.oauthClientFormErrors.technical_contacts}
                                </span>
                            )}
                        </div>
                    </section>

                    <section className="oauth-form-section">
                        <div className="oauth-form-section-heading">
                            <h3>Tipo de integração</h3>
                            <span>Defina como o parceiro poderá autenticar no BiblioWeb.</span>
                        </div>

                        <div className="oauth-grant-options">
                            {ALLOWED_OAUTH_GRANT_TYPES.map((grantType) => (
                                <Checkbox
                                    key={grantType}
                                    checked={state.oauthClientForm.grant_types.includes(grantType)}
                                    onChange={(event) => {
                                        const checked = event.target.checked;
                                        actions.setOAuthClientForm((previous) => ({
                                            ...previous,
                                            grant_types: checked
                                                ? [...previous.grant_types, grantType]
                                                : previous.grant_types.filter((item) => item !== grantType),
                                        }));
                                        actions.clearOAuthClientFieldError("grant_types");
                                    }}
                                >
                                    <span className="oauth-option-copy">
                                        <strong>{translateOAuthGrantType(grantType)}</strong>
                                        <small>{grantType}</small>
                                    </span>
                                </Checkbox>
                            ))}
                        </div>
                        {state.oauthClientFormErrors.grant_types && (
                            <span className="form-field-error">{state.oauthClientFormErrors.grant_types}</span>
                        )}

                        <div className="form-field">
                            <label className="field-label">URLs de retorno (*)</label>
                            <span className="form-field-helper oauth-helper-before-control">
                                Endereços para os quais o BiblioWeb poderá redirecionar o usuário após a autorização.
                            </span>
                            {state.oauthClientForm.redirect_uris.map((uri, index) => (
                                <div key={`redirect-uri-${index}`} className="oauth-redirect-uri-row">
                                    <Input
                                        className="admin-input"
                                        value={uri}
                                        placeholder="https://parceiro.example/callback"
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            actions.setOAuthClientForm((previous) => {
                                                const next = [...previous.redirect_uris];
                                                next[index] = value;
                                                return { ...previous, redirect_uris: next };
                                            });
                                            actions.clearOAuthClientFieldError("redirect_uris");
                                        }}
                                    />
                                    <Button
                                        danger
                                        disabled={state.oauthClientForm.redirect_uris.length <= 1}
                                        onClick={() =>
                                            actions.setOAuthClientForm((previous) => ({
                                                ...previous,
                                                redirect_uris: previous.redirect_uris.filter(
                                                    (_, itemIndex) => itemIndex !== index
                                                ),
                                            }))
                                        }
                                    >
                                        Remover
                                    </Button>
                                </div>
                            ))}
                            <Button
                                className="oauth-add-secondary"
                                onClick={() =>
                                    actions.setOAuthClientForm((previous) => ({
                                        ...previous,
                                        redirect_uris: [...previous.redirect_uris, ""],
                                    }))
                                }
                            >
                                + Adicionar URL
                            </Button>
                            {state.oauthClientFormErrors.redirect_uris && (
                                <span className="form-field-error">
                                    {state.oauthClientFormErrors.redirect_uris}
                                </span>
                            )}
                        </div>
                    </section>

                    <section className="oauth-form-section">
                        <div className="oauth-form-section-heading">
                            <h3>Permissões</h3>
                            <span>Escolha somente os dados e ações necessários para esta integração.</span>
                        </div>

                        <div className="oauth-permission-groups">
                            {(["Identidade", "Catálogo", "Empréstimos", "Integração"] as const).map(
                                (group) => {
                                    const scopes = ALLOWED_OAUTH_SCOPES.filter(
                                        (scope) => getOAuthScopeGroup(scope) === group
                                    );
                                    if (scopes.length === 0) {
                                        return null;
                                    }
                                    return (
                                        <div key={group} className="oauth-permission-group">
                                            <h4>{group}</h4>
                                            <div className="oauth-scope-checkbox-list">
                                                {scopes.map((scope) => (
                                                    <Checkbox
                                                        key={scope}
                                                        checked={state.oauthClientForm.scopes.includes(scope)}
                                                        onChange={(event) => {
                                                            const checked = event.target.checked;
                                                            actions.setOAuthClientForm((previous) => ({
                                                                ...previous,
                                                                scopes: checked
                                                                    ? [...previous.scopes, scope]
                                                                    : previous.scopes.filter(
                                                                          (item) => item !== scope
                                                                      ),
                                                            }));
                                                            actions.clearOAuthClientFieldError("scopes");
                                                        }}
                                                    >
                                                        <span className="oauth-option-copy">
                                                            <strong>{translateOAuthScope(scope)}</strong>
                                                            <small>{scope}</small>
                                                        </span>
                                                    </Checkbox>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                        {state.oauthClientFormErrors.scopes && (
                            <span className="form-field-error">{state.oauthClientFormErrors.scopes}</span>
                        )}
                    </section>

                    <section className="oauth-form-section">
                        <div className="oauth-form-section-heading">
                            <h3>Acesso às bibliotecas</h3>
                            <span>Limite a integração aos acervos que o parceiro realmente utiliza.</span>
                        </div>
                        <div className="form-field">
                            <label className="field-label">Bibliotecas autorizadas</label>
                            <Select
                                allowClear
                                mode="multiple"
                                className="admin-select"
                                placeholder="Selecione uma ou mais bibliotecas"
                                value={state.oauthClientForm.library_ids}
                                options={libraryOptions}
                                onChange={(values: string[]) =>
                                    actions.setOAuthClientForm((previous) => ({
                                        ...previous,
                                        library_ids: values,
                                    }))
                                }
                                optionFilterProp="label"
                                showSearch
                            />
                            <span className="form-field-helper">
                                Sem bibliotecas selecionadas, permissões de catálogo e empréstimos ficarão bloqueadas.
                            </span>
                        </div>
                    </section>

                    <details className="oauth-advanced-settings">
                        <summary>Configurações avançadas</summary>
                        <div className="oauth-advanced-settings-content">
                            <div className="switch-field oauth-confidential-field">
                                <div>
                                    <span className="field-label">Integração com segredo protegido</span>
                                    <span className="form-field-helper">
                                        Ative quando o parceiro roda em um servidor capaz de armazenar a credencial com segurança.
                                    </span>
                                </div>
                                <Switch
                                    checked={state.oauthClientForm.is_confidential}
                                    onChange={(checked) =>
                                        actions.setOAuthClientForm((previous) => ({
                                            ...previous,
                                            is_confidential: checked,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </details>

                    <div className="modal-actions oauth-modal-actions">
                        <Button onClick={actions.closeOAuthClientModal}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={state.isSavingOAuthClient}>
                            {state.oauthClientModalMode === "create" ? "Criar parceiro" : "Salvar alterações"}
                        </Button>
                    </div>
                </form>
            </Modal>

        </Layout>
    );
}
