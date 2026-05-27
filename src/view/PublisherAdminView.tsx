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
    Select,
    Tabs,
    Typography,
    Upload,
} from "antd";
import {
    CopyOutlined,
    EditOutlined,
    PlusOutlined,
    ReloadOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import HeaderView from "./HeaderView";
import BookLibraryPolicyGrid from "../components/BookLibraryPolicyGrid";
import { usePublisherAdminController } from "../controller/PublisherAdminController";
import { getBookAuthorsText } from "../model/Book";
import "../styles/AdminView.css";
import "../styles/PublisherAdminView.css";

/**
 * Renderiza a área administrativa de editora com gestão de livros protegidos
 * e geração de links de venda.
 *
 * @returns Componente de tela do Publisher Admin.
 */
export default function PublisherAdminView() {
    const { Content } = Layout;
    const { state, actions } = usePublisherAdminController();

    const publisherOptions = useMemo(
        () =>
            state.publisherAdminPublishers.map((publisher) => ({
                value: publisher.id,
                label: publisher.name,
            })),
        [state.publisherAdminPublishers]
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

    const isRefreshingCurrentTab =
        state.activeTab === "books"
            ? state.isLoadingBooks || state.isLoadingSubjects || state.isLoadingAuthors
            : state.isLoadingBooks || state.isGeneratingPurchaseLink;

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <Typography.Title level={3} className="section-title">
                        Administração da editora
                    </Typography.Title>

                    {state.error && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.error}
                            className="glass-alert"
                        />
                    )}

                    {!state.hasPublisherScope && (
                        <Alert
                            type="warning"
                            showIcon
                            message="Seu perfil não possui editoras com permissão administrativa."
                            className="glass-alert"
                        />
                    )}

                    <Tabs
                        className="admin-tabs"
                        activeKey={state.activeTab}
                        onChange={(value) =>
                            actions.setActiveTab(value as "books" | "sale-links")
                        }
                        tabBarExtraContent={
                            <Button
                                icon={<ReloadOutlined />}
                                loading={isRefreshingCurrentTab}
                                onClick={() => void actions.refreshCurrentTab()}
                                disabled={!state.hasPublisherScope}
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
                                        title="Livros protegidos"
                                        extra={
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={actions.openCreateBookModal}
                                                disabled={!state.hasPublisherScope}
                                            >
                                                Adicionar livro
                                            </Button>
                                        }
                                    >
                                        <div className="admin-card-toolbar">
                                            <div className="publisher-admin-toolbar-grid">
                                                <div className="form-field">
                                                    <label className="field-label">Busca</label>
                                                    <Input
                                                        className="admin-input"
                                                        placeholder="Título, autor, ISBN, edição..."
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
                                                        className="admin-select"
                                                        placeholder="Selecione"
                                                        value={state.publisherFilter || undefined}
                                                        options={publisherOptions}
                                                        onChange={(value: string) =>
                                                            actions.setPublisherFilter(value || "")
                                                        }
                                                        showSearch
                                                        optionFilterProp="label"
                                                        disabled={!state.hasPublisherScope}
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
                                            <Empty description="Nenhum livro protegido encontrado." />
                                        ) : (
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
                                                        ]}
                                                    >
                                                        <List.Item.Meta
                                                            title={book.title}
                                                            description={
                                                                <div className="publisher-admin-list-meta">
                                                                    <span>{getBookAuthorsText(book) || "Autor não informado"}</span>
                                                                    <span>
                                                                        {book.publisher || "Editora não informada"}
                                                                    </span>
                                                                    <span>
                                                                        ISBN: {book.isbn || "-"} | Edição: {book.edition || "-"}
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
                                key: "sale-links",
                                label: "Link de venda",
                                children: (
                                    <Card
                                        className="glass-card admin-panel admin-tab-card"
                                        title="Gerar link para venda"
                                    >
                                        <form
                                            className="admin-form"
                                            onSubmit={(event) => {
                                                void actions.handleGeneratePurchaseLink(event);
                                            }}
                                        >
                                            <div className="form-grid">
                                                <div className="form-field">
                                                    <label className="field-label">Editora</label>
                                                    <Select
                                                        className="admin-select"
                                                        placeholder="Selecione"
                                                        value={state.purchasePublisherId || undefined}
                                                        options={publisherOptions}
                                                        onChange={actions.setPurchasePublisherId}
                                                        showSearch
                                                        optionFilterProp="label"
                                                        disabled={!state.hasPublisherScope}
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">Livro protegido</label>
                                                    <Select
                                                        className="admin-select"
                                                        placeholder="Selecione"
                                                        value={state.purchaseBookId || undefined}
                                                        options={state.bookOptions}
                                                        onChange={actions.setPurchaseBookId}
                                                        showSearch
                                                        optionFilterProp="label"
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">E-mail do comprador</label>
                                                    <Input
                                                        className="admin-input"
                                                        value={state.purchaseEmail}
                                                        onChange={(event) =>
                                                            actions.setPurchaseEmail(event.target.value)
                                                        }
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label className="field-label">Senha provisória</label>
                                                    <Input.Password
                                                        className="admin-input"
                                                        value={state.purchasePassword}
                                                        onChange={(event) =>
                                                            actions.setPurchasePassword(event.target.value)
                                                        }
                                                    />
                                                </div>
                                                <div className="form-field form-field-full">
                                                    <label className="field-label">Dica de senha</label>
                                                    <Input
                                                        className="admin-input"
                                                        value={state.purchaseHint}
                                                        onChange={(event) =>
                                                            actions.setPurchaseHint(event.target.value)
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="section-actions">
                                                <Button
                                                    type="primary"
                                                    htmlType="submit"
                                                    loading={state.isGeneratingPurchaseLink}
                                                    disabled={!state.hasPublisherScope}
                                                >
                                                    Gerar link
                                                </Button>
                                            </div>
                                        </form>

                                        {state.purchaseLinks.length > 0 && (
                                            <div className="publisher-links-wrap">
                                                <Typography.Title level={5} className="section-title">
                                                    Links gerados
                                                </Typography.Title>
                                                <List
                                                    className="admin-list"
                                                    dataSource={state.purchaseLinks}
                                                    renderItem={(link) => (
                                                        <List.Item
                                                            className="admin-list-item"
                                                            actions={[
                                                                <Button
                                                                    key="copy"
                                                                    icon={<CopyOutlined />}
                                                                    onClick={() => {
                                                                        void actions.handleCopyLink(link.url);
                                                                    }}
                                                                >
                                                                    Copiar
                                                                </Button>,
                                                            ]}
                                                        >
                                                            <List.Item.Meta
                                                                title={link.userEmail}
                                                                description={
                                                                    <div className="publisher-admin-list-meta">
                                                                        <span>
                                                                            Livro: {link.bookId} | {link.createdAt}
                                                                        </span>
                                                                        <span className="publisher-link-url">{link.url}</span>
                                                                    </div>
                                                                }
                                                            />
                                                        </List.Item>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </Card>
                                ),
                            },
                        ]}
                    />
                </section>
            </Content>

            <Modal
                title={state.bookModalMode === "create" ? "Adicionar livro protegido" : "Editar livro protegido"}
                open={state.bookModalOpen}
                onCancel={actions.closeBookModal}
                footer={null}
                width={900}
                destroyOnClose
            >
                <form
                    className="admin-form"
                    onSubmit={(event) => {
                        void actions.saveBook(event);
                    }}
                >
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
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        original_title: event.target.value,
                                    }))
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
                                options={publisherOptions}
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
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        publication_place: event.target.value,
                                    }))
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
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        dewey_decimal: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <BookLibraryPolicyGrid
                            label="Política por acervo"
                            helperText="Licenças disponíveis e máximo de usos são editáveis. Progresso da licença atual é apenas leitura."
                            error={state.bookFormErrors.library_policy}
                            value={state.bookForm.libraries}
                            emptyDescription="A política será criada junto com o acervo vinculado."
                            onChange={(libraries) => {
                                actions.setBookLibraries(libraries);
                                actions.clearBookFieldError("library_policy");
                            }}
                        />
                        <div className="form-field">
                            <label className="field-label">Nome do arquivo (*)</label>
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
                                value={state.bookForm.image_url}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        image_url: event.target.value,
                                    }))
                                }
                            />
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
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        content_type: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Tipo de mídia <span className="marc-tag">[337$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.media_type}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        media_type: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="form-field">
                            <label className="field-label">Tipo de suporte <span className="marc-tag">[338$a]</span></label>
                            <Input
                                className="admin-input"
                                value={state.bookForm.carrier_type}
                                onChange={(event) =>
                                    actions.setBookForm((previous) => ({
                                        ...previous,
                                        carrier_type: event.target.value,
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
                                actions.setBookForm((previous) => ({
                                    ...previous,
                                    bibliography_note: event.target.value,
                                }))
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
        </Layout>
    );
}
