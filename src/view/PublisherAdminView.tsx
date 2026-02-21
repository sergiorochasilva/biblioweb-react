import { useMemo } from "react";
import {
    Alert,
    Button,
    Card,
    Divider,
    Empty,
    Image,
    Input,
    Layout,
    List,
    Select,
    Typography,
    Upload,
} from "antd";
import { CopyOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import HeaderView from "./HeaderView";
import book_icon from "../assets/book_icon.png";
import "../styles/PublisherAdminView.css";
import { usePublisherAdminController } from "../controller/PublisherAdminController";

export default function PublisherAdminView() {
    const { state, actions } = usePublisherAdminController();
    const { Content } = Layout;

    const bookSelectOptions = useMemo(
        () =>
            state.bookOptions.map((book) => ({
                value: book.id || "",
                label: book.title,
            })),
        [state.bookOptions]
    );

    return (
        <Layout className="page-shell">
            <HeaderView />
            <Content className="page-content">
                <section className="page-section">
                    <Typography.Title level={3} className="section-title">
                        Painel da editora
                    </Typography.Title>

                    {state.error && (
                        <Alert
                            type="error"
                            showIcon
                            message={state.error}
                            className="glass-alert"
                        />
                    )}

                    <Card className="glass-card admin-section">
                        <Typography.Title level={4} className="section-title">
                            Configuração da API
                        </Typography.Title>
                        <div className="form-grid">
                            <div className="form-field">
                                <label className="field-label">API Base URL</label>
                                <Input
                                    value={state.apiBaseUrl}
                                    onChange={(event) => actions.setApiBaseUrl(event.target.value)}
                                    placeholder="https://biblioweb.online:8080"
                                />
                            </div>
                            <div className="form-field">
                                <label className="field-label">Access Token (opcional)</label>
                                <Input.TextArea
                                    value={state.accessToken}
                                    onChange={(event) => actions.setAccessToken(event.target.value)}
                                    placeholder="Bearer token"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="section-actions">
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={actions.loadBooks}
                                loading={state.isLoading}
                            >
                                Atualizar lista
                            </Button>
                        </div>
                    </Card>

                    <div className="admin-books-grid">
                        <Card className="glass-card books-panel">
                            <Typography.Title level={4} className="section-title">
                                Livros da editora
                            </Typography.Title>
                            {state.books.length === 0 && !state.isLoading ? (
                                <Empty description="Nenhum livro encontrado." />
                            ) : (
                                <List
                                    className="books-list"
                                    dataSource={state.books}
                                    loading={state.isLoading}
                                    renderItem={(book) => {
                                        const isActive = state.selectedBook?.id === book.id;
                                        return (
                                            <List.Item className="book-row">
                                                <button
                                                    type="button"
                                                    className={`book-row-button ${isActive ? "active" : ""}`}
                                                    onClick={() => actions.setSelectedBook(book)}
                                                >
                                                    <Image
                                                        src={book.image_url ? book.image_url : book_icon}
                                                        alt="Capa do livro"
                                                        preview={false}
                                                        width={52}
                                                        height={72}
                                                    />
                                                    <div className="book-row-info">
                                                        <Typography.Text className="book-row-title">
                                                            {book.title}
                                                        </Typography.Text>
                                                        <Typography.Text className="book-row-meta">
                                                            {book.author}
                                                        </Typography.Text>
                                                        <Typography.Text className="book-row-meta">
                                                            {book.publisher}
                                                        </Typography.Text>
                                                    </div>
                                                </button>
                                            </List.Item>
                                        );
                                    }}
                                />
                            )}
                        </Card>

                        <Card className="glass-card editor-panel">
                            <Typography.Title level={4} className="section-title">
                                Editar livro
                            </Typography.Title>
                            <form className="admin-form" onSubmit={actions.handleUpdateBook}>
                                <div className="form-grid">
                                    <div className="form-field">
                                        <label className="field-label">Título</label>
                                        <Input
                                            value={state.editForm.title}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, title: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">Autor</label>
                                        <Input
                                            value={state.editForm.author}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, author: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">Editora</label>
                                        <Input
                                            value={state.editForm.publisher}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, publisher: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">Assunto</label>
                                        <Input
                                            value={state.editForm.subject}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, subject: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">Nome do arquivo</label>
                                        <Input
                                            value={state.editForm.file_name}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, file_name: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">URL da capa</label>
                                        <Input
                                            value={state.editForm.image_url}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, image_url: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">Edição</label>
                                        <Input
                                            value={state.editForm.edition}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, edition: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">Ano</label>
                                        <Input
                                            value={state.editForm.year}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, year: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">ISBN</label>
                                        <Input
                                            value={state.editForm.isbn}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, isbn: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">Páginas</label>
                                        <Input
                                            value={state.editForm.pages}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, pages: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="field-label">Idioma</label>
                                        <Input
                                            value={state.editForm.language}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, language: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="form-field form-field-full">
                                        <label className="field-label">Resenha</label>
                                        <Input.TextArea
                                            value={state.editForm.review}
                                            onChange={(event) =>
                                                actions.setEditForm((prev) => ({ ...prev, review: event.target.value }))
                                            }
                                            rows={4}
                                        />
                                    </div>
                                </div>
                                <Button type="primary" htmlType="submit">
                                    Salvar alterações
                                </Button>
                            </form>
                        </Card>
                    </div>

                    <Card className="glass-card admin-section">
                        <Typography.Title level={4} className="section-title">
                            Cadastrar novo livro
                        </Typography.Title>
                        <form className="admin-form" onSubmit={actions.handleCreateBook}>
                            <div className="form-grid">
                                <div className="form-field">
                                    <label className="field-label">Título</label>
                                    <Input
                                        value={state.createForm.title}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Autor</label>
                                    <Input
                                        value={state.createForm.author}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, author: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Editora</label>
                                    <Input
                                        value={state.createForm.publisher}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, publisher: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Assunto</label>
                                    <Input
                                        value={state.createForm.subject}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, subject: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Nome do arquivo</label>
                                    <Input
                                        value={state.createForm.file_name}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, file_name: event.target.value }))
                                        }
                                        placeholder="Opcional se o arquivo já informar"
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">URL da capa</label>
                                    <Input
                                        value={state.createForm.image_url}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, image_url: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Edição</label>
                                    <Input
                                        value={state.createForm.edition}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, edition: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Ano</label>
                                    <Input
                                        value={state.createForm.year}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, year: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">ISBN</label>
                                    <Input
                                        value={state.createForm.isbn}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, isbn: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Páginas</label>
                                    <Input
                                        value={state.createForm.pages}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, pages: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Idioma</label>
                                    <Input
                                        value={state.createForm.language}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, language: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Biblioteca (opcional)</label>
                                    <Input
                                        type="number"
                                        value={state.createForm.library}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, library: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-field form-field-full">
                                    <label className="field-label">Resenha</label>
                                    <Input.TextArea
                                        value={state.createForm.review}
                                        onChange={(event) =>
                                            actions.setCreateForm((prev) => ({ ...prev, review: event.target.value }))
                                        }
                                        rows={4}
                                    />
                                </div>
                                <div className="form-field form-field-full">
                                    <label className="field-label">Arquivo do livro (EPUB/PDF)</label>
                                    <Upload
                                        beforeUpload={() => false}
                                        maxCount={1}
                                        showUploadList={false}
                                        accept=".epub,.pdf"
                                        onChange={(info) =>
                                            actions.setBookFile(info.file.originFileObj || null)
                                        }
                                    >
                                        <Button icon={<UploadOutlined />}>Selecionar arquivo</Button>
                                    </Upload>
                                    {state.bookFile && (
                                        <Typography.Text className="file-hint">
                                            {state.bookFile.name}
                                        </Typography.Text>
                                    )}
                                </div>
                            </div>
                            <Button type="primary" htmlType="submit">
                                Cadastrar livro
                            </Button>
                        </form>
                    </Card>

                    <Card className="glass-card admin-section">
                        <Typography.Title level={4} className="section-title">
                            Gerar links de compra
                        </Typography.Title>
                        <form className="admin-form" onSubmit={actions.handleGeneratePurchaseLink}>
                            <div className="form-grid">
                                <div className="form-field">
                                    <label className="field-label">Editora (ID ou CNPJ)</label>
                                    <Input
                                        value={state.publisherId}
                                        onChange={(event) => actions.setPublisherId(event.target.value)}
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Livro</label>
                                    <Select
                                        value={state.purchaseBookId || undefined}
                                        onChange={(value) => actions.setPurchaseBookId(value)}
                                        placeholder="Selecione"
                                        options={bookSelectOptions}
                                        showSearch
                                        optionFilterProp="label"
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Email do usuário</label>
                                    <Input
                                        type="email"
                                        value={state.purchaseEmail}
                                        onChange={(event) => actions.setPurchaseEmail(event.target.value)}
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Senha de leitura</label>
                                    <Input.Password
                                        value={state.purchasePassword}
                                        onChange={(event) => actions.setPurchasePassword(event.target.value)}
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="field-label">Dica da senha</label>
                                    <Input
                                        value={state.purchaseHint}
                                        onChange={(event) => actions.setPurchaseHint(event.target.value)}
                                    />
                                </div>
                            </div>
                            <Button type="primary" htmlType="submit">
                                Gerar link
                            </Button>
                        </form>

                        <Divider />

                        {state.purchaseLinks.length === 0 ? (
                            <Empty description="Os links gerados aparecerão aqui." />
                        ) : (
                            <List
                                className="links-list"
                                dataSource={state.purchaseLinks}
                                renderItem={(link) => (
                                    <List.Item className="link-row">
                                        <div className="link-row-info">
                                            <Typography.Text className="link-row-title">
                                                {link.userEmail}
                                            </Typography.Text>
                                            <Typography.Text className="link-row-meta">
                                                Livro: {link.bookId}
                                            </Typography.Text>
                                            <Typography.Text className="link-row-meta">
                                                {link.createdAt}
                                            </Typography.Text>
                                            <Typography.Text className="link-row-url">
                                                {link.url}
                                            </Typography.Text>
                                        </div>
                                        <Button
                                            className="secondary-button"
                                            icon={<CopyOutlined />}
                                            onClick={() => actions.handleCopyLink(link.url)}
                                        >
                                            Copiar
                                        </Button>
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>
                </section>
            </Content>
        </Layout>
    );
}
