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
    PlusOutlined,
    ReloadOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import HeaderView from "./HeaderView";
import { useAdminController } from "../controller/AdminController";
import "../styles/AdminView.css";

/**
 * Renderiza a área administrativa global com gestão de livros e usuários.
 *
 * @returns Componente de tela administrativa.
 */
export default function AdminView() {
    const { Content } = Layout;
    const { state, actions } = useAdminController();
    const isRefreshingCurrentTab =
        state.activeTab === "users"
            ? state.isLoadingUsers
            : state.isLoadingBooks;

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
                                                        placeholder="Titulo, autor, assunto, editora, ISBN..."
                                                        value={state.bookSearch}
                                                        onChange={(event) =>
                                                            actions.setBookSearch(event.target.value)
                                                        }
                                                        onPressEnter={actions.applyBookFilters}
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">
                                                        Filtro por editora (nome)
                                                    </label>
                                                    <Input
                                                        placeholder="Ex.: Minha Editora"
                                                        value={state.publisherFilter}
                                                        onChange={(event) =>
                                                            actions.setPublisherFilter(event.target.value)
                                                        }
                                                        onPressEnter={actions.applyBookFilters}
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">
                                                        Filtro por biblioteca (ID)
                                                    </label>
                                                    <Input
                                                        placeholder="Ex.: 1"
                                                        value={state.libraryFilter}
                                                        onChange={(event) =>
                                                            actions.setLibraryFilter(event.target.value)
                                                        }
                                                        onPressEnter={actions.applyBookFilters}
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
                                                                            {book.author ||
                                                                                "Autor não informado"}
                                                                        </span>
                                                                        <span>
                                                                            {book.publisher_name ||
                                                                                book.publisher ||
                                                                                "Editora não informada"}
                                                                        </span>
                                                                        <span>
                                                                            {book.library_name ||
                                                                                (book.library !== null &&
                                                                                book.library !== undefined
                                                                                    ? `Biblioteca ${book.library}`
                                                                                    : "Sem biblioteca")}
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
                                                                onClick={() =>
                                                                    actions.openEditUserModal(user)
                                                                }
                                                            >
                                                                Editar
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
                                                                    <span>Dica: {user.pass_hint || "-"}</span>
                                                                    <span>
                                                                        Perfil:{" "}
                                                                        {user.admin
                                                                            ? "Administrador"
                                                                            : "Usuário comum"}
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
                        ]}
                    />
                </section>
            </Content>

            <Modal
                title={
                    state.bookModalMode === "create"
                        ? "Adicionar livro"
                        : "Editar livro"
                }
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
                            <label className="field-label">Título (*)</label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.title ? "error" : undefined}
                                value={state.bookForm.title}
                                onChange={(event) => {
                                    actions.setBookForm((prev) => ({ ...prev, title: event.target.value }));
                                    actions.clearBookFieldError("title");
                                }}
                            />
                            {state.bookFormErrors.title && (
                                <span className="form-field-error">{state.bookFormErrors.title}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">Autor (*)</label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.author ? "error" : undefined}
                                value={state.bookForm.author}
                                onChange={(event) => {
                                    actions.setBookForm((prev) => ({ ...prev, author: event.target.value }));
                                    actions.clearBookFieldError("author");
                                }}
                            />
                            {state.bookFormErrors.author && (
                                <span className="form-field-error">{state.bookFormErrors.author}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">Editora (*)</label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.publisher ? "error" : undefined}
                                value={state.bookForm.publisher}
                                onChange={(event) => {
                                    actions.setBookForm((prev) => ({ ...prev, publisher: event.target.value }));
                                    actions.clearBookFieldError("publisher");
                                }}
                            />
                            {state.bookFormErrors.publisher && (
                                <span className="form-field-error">{state.bookFormErrors.publisher}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">Assunto</label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.subject}
                                onChange={(event) =>
                                    actions.setBookForm((prev) => ({ ...prev, subject: event.target.value }))
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
                                    actions.setBookForm((prev) => ({ ...prev, type: value || "protected" }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">
                                URL externa
                                {state.bookForm.type === "external" ? " (*)" : ""}
                            </label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.external_url ? "error" : undefined}
                                value={state.bookForm.external_url}
                                onChange={(event) => {
                                    actions.setBookForm((prev) => ({
                                        ...prev,
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
                            <label className="field-label">Nome do arquivo (*)</label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.file_name ? "error" : undefined}
                                value={state.bookForm.file_name}
                                onChange={(event) => {
                                    actions.setBookForm((prev) => ({ ...prev, file_name: event.target.value }));
                                    actions.clearBookFieldError("file_name");
                                }}
                            />
                            {state.bookFormErrors.file_name && (
                                <span className="form-field-error">{state.bookFormErrors.file_name}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">URL da capa (*)</label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.image_url ? "error" : undefined}
                                value={state.bookForm.image_url}
                                onChange={(event) => {
                                    actions.setBookForm((prev) => ({ ...prev, image_url: event.target.value }));
                                    actions.clearBookFieldError("image_url");
                                }}
                            />
                            {state.bookFormErrors.image_url && (
                                <span className="form-field-error">{state.bookFormErrors.image_url}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">Edição (*)</label>
                            <Input
                                className="admin-input"
                                status={state.bookFormErrors.edition ? "error" : undefined}
                                value={state.bookForm.edition}
                                onChange={(event) => {
                                    actions.setBookForm((prev) => ({ ...prev, edition: event.target.value }));
                                    actions.clearBookFieldError("edition");
                                }}
                            />
                            {state.bookFormErrors.edition && (
                                <span className="form-field-error">{state.bookFormErrors.edition}</span>
                            )}
                        </div>
                        <div className="form-field">
                            <label className="field-label">Ano</label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.year}
                                onChange={(event) =>
                                    actions.setBookForm((prev) => ({ ...prev, year: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">ISBN</label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.isbn}
                                onChange={(event) =>
                                    actions.setBookForm((prev) => ({ ...prev, isbn: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Páginas</label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.pages}
                                onChange={(event) =>
                                    actions.setBookForm((prev) => ({ ...prev, pages: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Idioma</label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.language}
                                onChange={(event) =>
                                    actions.setBookForm((prev) => ({ ...prev, language: event.target.value }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Biblioteca (ID)</label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.library}
                                onChange={(event) =>
                                    actions.setBookForm((prev) => ({ ...prev, library: event.target.value }))
                                }
                                disabled={state.bookModalMode === "edit"}
                                placeholder={
                                    state.bookModalMode === "edit"
                                        ? "Vínculo não editável neste fluxo"
                                        : "Informe o ID da biblioteca"
                                }
                            />
                        </div>
                    </div>
                    <div className="form-field form-field-full">
                        <label className="field-label">Resenha</label>
                        <Input.TextArea
                            className="admin-input"
                            rows={4}
                            value={state.bookForm.review}
                            onChange={(event) =>
                                actions.setBookForm((prev) => ({ ...prev, review: event.target.value }))
                            }
                        />
                    </div>
                    {state.bookModalMode === "create" && (
                        <div className="form-field form-field-full">
                            <label className="field-label">Arquivo (EPUB) (*)</label>
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
                                <Typography.Text className="file-name">
                                    {state.bookFile.name}
                                </Typography.Text>
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
                title={
                    state.userModalMode === "create"
                        ? "Adicionar usuário"
                        : "Editar usuário"
                }
                open={state.userModalOpen}
                onCancel={actions.closeUserModal}
                footer={null}
                width={560}
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
                                actions.setUserForm((prev) => ({ ...prev, email: event.target.value }));
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
                                ? "Senha (*)"
                                : "Nova senha (opcional)"}
                        </label>
                        <Input.Password
                            className="admin-input"
                            status={state.userFormErrors.senha ? "error" : undefined}
                            value={state.userForm.senha}
                            onChange={(event) => {
                                actions.setUserForm((prev) => ({ ...prev, senha: event.target.value }));
                                actions.clearUserFieldError("senha");
                            }}
                        />
                        {state.userFormErrors.senha && (
                            <span className="form-field-error">{state.userFormErrors.senha}</span>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="field-label">Dica de senha (*)</label>
                        <Input
                            className="admin-input"
                            status={state.userFormErrors.dica_senha ? "error" : undefined}
                            value={state.userForm.dica_senha}
                            onChange={(event) => {
                                actions.setUserForm((prev) => ({ ...prev, dica_senha: event.target.value }));
                                actions.clearUserFieldError("dica_senha");
                            }}
                        />
                        {state.userFormErrors.dica_senha && (
                            <span className="form-field-error">{state.userFormErrors.dica_senha}</span>
                        )}
                    </div>
                    <div className="form-field switch-field">
                        <label className="field-label">Administrador global</label>
                        <Switch
                            checked={state.userForm.admin}
                            onChange={(checked) =>
                                actions.setUserForm((prev) => ({ ...prev, admin: checked }))
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
        </Layout>
    );
}
