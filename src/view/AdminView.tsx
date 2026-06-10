import { useMemo } from "react";
import {
    Alert,
    Button,
    Card,
    Empty,
    Input,
    Layout,
    List,
    Modal,
    Popconfirm,
    Select,
    Switch,
    Tabs,
    Typography,
    Upload,
} from "antd";
import {
    DeleteOutlined,
    EditOutlined,
    LockOutlined,
    PlusOutlined,
    ReloadOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import HeaderView from "./HeaderView";
import BookLibraryPolicyGrid from "../components/BookLibraryPolicyGrid";
import LibraryLimitGrid from "../components/LibraryLimitGrid";
import { useAdminController } from "../controller/AdminController";
import { getBookAuthorsText } from "../model/Book";
import "../styles/AdminView.css";

/**
 * Renderiza a área administrativa global com gestão de livros, usuários,
 * bibliotecas e editoras.
 *
 * @returns Componente de tela administrativa.
 */
export default function AdminView() {
    const { Content } = Layout;
    const { state, actions } = useAdminController();

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
                                onClick={() => void actions.refreshCurrentTab()}
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
                                                    <label className="field-label">Acervo (*)</label>
                                                    <Select
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
                        ]}
                    />
                </section>
            </Content>

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
                            <label className="field-label">Acervo (*)</label>
                            <Select
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
                            helperText="Licenças disponíveis e máximo de usos são editáveis. Progresso da licença atual é apenas leitura."
                            error={state.bookFormErrors.library_policy}
                            value={state.bookForm.libraries}
                            showPurchasePrice
                            options={libraryOptions}
                            emptyDescription="Selecione ao menos um acervo para editar a política."
                            onChange={(libraries) => {
                                actions.setBookLibraries(libraries);
                                actions.clearBookFieldError("library_policy");
                            }}
                        />
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
                    <div className="form-field">
                        <label className="field-label">Editoras</label>
                        <Select
                            mode="multiple"
                            className="admin-select"
                            placeholder="Selecione uma ou mais editoras"
                            value={state.userForm.publishers}
                            options={publisherOptions}
                            onChange={(values: string[]) =>
                                actions.setUserForm((previous) => ({ ...previous, publishers: values }))
                            }
                            optionFilterProp="label"
                        />
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
        </Layout>
    );
}
