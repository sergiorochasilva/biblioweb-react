import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { useAuth } from "../contexts/AuthContext";
import {
    AdminBook,
    AdminUser,
    createBook,
    createUser,
    deleteBook,
    deleteUser,
    fetchBookById,
    fetchBooksPage,
    fetchBooksPageByNext,
    fetchUsers,
    getFileParts,
    readFileAsBase64,
    resolveBookIdByLibraryBookId,
    updateBook,
    updateUser,
} from "../service/AdminService";

type BookFormState = {
    id?: string;
    title: string;
    publisher: string;
    author: string;
    subject: string;
    type: string;
    external_url: string;
    file_name: string;
    edition: string;
    year: string;
    isbn: string;
    pages: string;
    language: string;
    review: string;
    image_url: string;
    library: string;
};

type UserFormState = {
    id?: string;
    email: string;
    senha: string;
    dica_senha: string;
    admin: boolean;
};

type AppliedBookFilters = {
    search: string;
    publisher: string;
    library: string;
};

type AdminTabKey = "books" | "users";
type BookFieldErrorKey =
    | "title"
    | "author"
    | "publisher"
    | "file_name"
    | "image_url"
    | "edition"
    | "external_url"
    | "file";
type UserFieldErrorKey = "email" | "senha" | "dica_senha";

type ValidationResult<TField extends string> = {
    message: string;
    fieldErrors: Partial<Record<TField, string>>;
};

const ADMIN_BOOKS_PAGE_SIZE = 20;

const emptyBookForm: BookFormState = {
    title: "",
    publisher: "",
    author: "",
    subject: "",
    type: "protected",
    external_url: "",
    file_name: "",
    edition: "",
    year: "",
    isbn: "",
    pages: "",
    language: "",
    review: "",
    image_url: "",
    library: "",
};

const emptyUserForm: UserFormState = {
    email: "",
    senha: "",
    dica_senha: "",
    admin: false,
};

const emptyFilters: AppliedBookFilters = {
    search: "",
    publisher: "",
    library: "",
};

/**
 * Converte dados de livro para o estado de formulário utilizado no modal.
 *
 * @param book Livro bruto vindo da listagem ou do endpoint de detalhe.
 * @returns Estado preenchido para o formulário de livro.
 */
function mapBookToForm(book: AdminBook): BookFormState {
    return {
        id: book.book_id || book.id,
        title: book.title || "",
        publisher: book.publisher_name || book.publisher || "",
        author: book.author || "",
        subject: book.subject || "",
        type: book.type || "protected",
        external_url: book.external_url || "",
        file_name: book.file_name || "",
        edition: book.edition || "",
        year: book.year || "",
        isbn: book.isbn || "",
        pages: book.pages || "",
        language: book.language || "",
        review: book.review || "",
        image_url: book.image_url || "",
        library:
            book.library === undefined || book.library === null
                ? ""
                : String(book.library),
    };
}

/**
 * Valida campos obrigatórios do formulário de livro antes de enviar para API.
 *
 * @param form Estado atual do formulário.
 * @param mode Modo do modal (criação ou edição).
 * @param hasBookFile Define se o arquivo obrigatório no cadastro foi selecionado.
 * @returns Mensagem de erro quando houver validação inválida, senão ``null``.
 */
function validateBookForm(
    form: BookFormState,
    mode: "create" | "edit",
    hasBookFile: boolean
): ValidationResult<BookFieldErrorKey> | null {
    if (mode === "edit" && !form.id) {
        return {
            message: "Livro inválido para edição.",
            fieldErrors: {},
        };
    }

    const fieldErrors: Partial<Record<BookFieldErrorKey, string>> = {};

    if (!form.title.trim()) {
        fieldErrors.title = "Título obrigatório.";
    }

    if (!form.author.trim()) {
        fieldErrors.author = "Autor obrigatório.";
    }

    if (!form.publisher.trim()) {
        fieldErrors.publisher = "Editora obrigatória.";
    }

    if (!form.file_name.trim() && !(mode === "create" && hasBookFile)) {
        fieldErrors.file_name = "Nome do arquivo obrigatório.";
    }

    if (!form.image_url.trim()) {
        fieldErrors.image_url = "URL da capa obrigatória.";
    }

    if (!form.edition.trim()) {
        fieldErrors.edition = "Edição obrigatória.";
    }

    if (mode === "create" && !hasBookFile) {
        fieldErrors.file = "Arquivo obrigatório para cadastro.";
    }

    if (form.type === "external" && !form.external_url.trim()) {
        fieldErrors.external_url = "URL externa obrigatória.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            message: "Preencha os campos obrigatórios destacados.",
            fieldErrors,
        };
    }

    return null;
}

/**
 * Valida campos obrigatórios do formulário de usuário antes de enviar para API.
 *
 * @param form Estado atual do formulário.
 * @param mode Modo do modal (criação ou edição).
 * @returns Estrutura de erro com mensagem/campos inválidos ou ``null``.
 */
function validateUserForm(
    form: UserFormState,
    mode: "create" | "edit"
): ValidationResult<UserFieldErrorKey> | null {
    const fieldErrors: Partial<Record<UserFieldErrorKey, string>> = {};

    if (!form.email.trim()) {
        fieldErrors.email = "E-mail obrigatório.";
    }

    if (!form.dica_senha.trim()) {
        fieldErrors.dica_senha = "Dica de senha obrigatória.";
    }

    if (mode === "create" && !form.senha.trim()) {
        fieldErrors.senha = "Senha obrigatória no cadastro.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            message: "Preencha os campos obrigatórios destacados.",
            fieldErrors,
        };
    }

    return null;
}

/**
 * Converte texto de formulário para formato compatível com DTO opcional.
 *
 * @param value Texto bruto informado no formulário.
 * @returns Valor normalizado com ``trim`` ou ``null`` quando vazio.
 */
function toNullableField(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

/**
 * Converte erro desconhecido para mensagem legível de UI.
 *
 * @param error Erro capturado.
 * @param fallback Texto padrão.
 * @returns Mensagem final para exibição.
 */
function normalizeErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

/**
 * Hook/controller da tela de administração global.
 *
 * @returns Estado da tela e ações para livros/usuários.
 */
export function useAdminController() {
    const { isAuthenticated, getAccessToken } = useAuth();

    const [isLoadingBooks, setIsLoadingBooks] = useState(false);
    const [isLoadingMoreBooks, setIsLoadingMoreBooks] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSavingBook, setIsSavingBook] = useState(false);
    const [isSavingUser, setIsSavingUser] = useState(false);

    const [books, setBooks] = useState<AdminBook[]>([]);
    const [booksNext, setBooksNext] = useState<string | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);

    const [bookSearch, setBookSearch] = useState("");
    const [publisherFilter, setPublisherFilter] = useState("");
    const [libraryFilter, setLibraryFilter] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [activeTab, setActiveTabState] = useState<AdminTabKey>("books");
    const [appliedFilters, setAppliedFilters] =
        useState<AppliedBookFilters>(emptyFilters);
    const [appliedUserSearch, setAppliedUserSearch] = useState("");

    const [error, setError] = useState("");

    const [bookModalOpen, setBookModalOpen] = useState(false);
    const [bookModalMode, setBookModalMode] = useState<"create" | "edit">("create");
    const [bookForm, setBookForm] = useState<BookFormState>(emptyBookForm);
    const [bookFile, setBookFile] = useState<File | null>(null);
    const [bookModalError, setBookModalError] = useState("");
    const [bookFormErrors, setBookFormErrors] =
        useState<Partial<Record<BookFieldErrorKey, string>>>({});

    const [userModalOpen, setUserModalOpen] = useState(false);
    const [userModalMode, setUserModalMode] = useState<"create" | "edit">("create");
    const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
    const [userModalError, setUserModalError] = useState("");
    const [userFormErrors, setUserFormErrors] =
        useState<Partial<Record<UserFieldErrorKey, string>>>({});

    const hasMoreBooks = useMemo(() => Boolean(booksNext), [booksNext]);

    /**
     * Carrega a primeira página de livros com os filtros aplicados.
     *
     * @returns Promise<void>.
     */
    const loadBooks = useCallback(async (): Promise<void> => {
        setIsLoadingBooks(true);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const page = await fetchBooksPage(token, {
                search: appliedFilters.search || undefined,
                publisher: appliedFilters.publisher || undefined,
                library: appliedFilters.library || undefined,
                limit: ADMIN_BOOKS_PAGE_SIZE,
            });
            setBooks(page.result);
            setBooksNext(page.next);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar livros."));
        } finally {
            setIsLoadingBooks(false);
        }
    }, [appliedFilters, getAccessToken]);

    /**
     * Carrega a próxima página de livros usando o link `next`.
     *
     * @returns Promise<void>.
     */
    const loadMoreBooks = useCallback(async (): Promise<void> => {
        if (!booksNext) {
            return;
        }

        setIsLoadingMoreBooks(true);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const page = await fetchBooksPageByNext(token, booksNext);
            setBooks((prev) => {
                const knownIds = new Set(prev.map((book) => String(book.id)));
                const appendOnly = page.result.filter(
                    (book) => !knownIds.has(String(book.id))
                );
                return [...prev, ...appendOnly];
            });
            setBooksNext(page.next);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar mais livros."));
        } finally {
            setIsLoadingMoreBooks(false);
        }
    }, [booksNext, getAccessToken]);

    /**
     * Carrega usuários administrativos.
     *
     * @returns Promise<void>.
     */
    const loadUsers = useCallback(async (): Promise<void> => {
        setIsLoadingUsers(true);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await fetchUsers(
                token,
                appliedUserSearch || undefined
            );
            setUsers(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar usuários."));
        } finally {
            setIsLoadingUsers(false);
        }
    }, [appliedUserSearch, getAccessToken]);

    /**
     * Atualiza a aba ativa de administração.
     *
     * @param tabKey Identificador da aba.
     * @returns void.
     */
    function setActiveTab(tabKey: string): void {
        setActiveTabState(tabKey === "users" ? "users" : "books");
    }

    /**
     * Atualiza a listagem da aba atualmente selecionada.
     *
     * @returns Promise<void>.
     */
    const refreshCurrentTab = useCallback(async (): Promise<void> => {
        if (activeTab === "users") {
            await loadUsers();
            return;
        }

        await loadBooks();
    }, [activeTab, loadBooks, loadUsers]);

    /**
     * Remove erro de um campo do formulário de livro.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearBookFieldError(field: BookFieldErrorKey): void {
        setBookModalError("");
        setBookFormErrors((prev) => {
            if (!prev[field]) {
                return prev;
            }
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }

    /**
     * Remove erro de um campo do formulário de usuário.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearUserFieldError(field: UserFieldErrorKey): void {
        setUserModalError("");
        setUserFormErrors((prev) => {
            if (!prev[field]) {
                return prev;
            }
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }

    /**
     * Exibe erro no modal de livros e dispara toaster.
     *
     * @param text Mensagem a ser exibida.
     * @param fieldErrors Erros de campos opcionais.
     * @returns void.
     */
    function showBookModalError(
        text: string,
        fieldErrors: Partial<Record<BookFieldErrorKey, string>> = {}
    ): void {
        setBookModalError(text);
        setBookFormErrors(fieldErrors);
        message.error(text);
    }

    /**
     * Exibe erro no modal de usuários e dispara toaster.
     *
     * @param text Mensagem a ser exibida.
     * @param fieldErrors Erros de campos opcionais.
     * @returns void.
     */
    function showUserModalError(
        text: string,
        fieldErrors: Partial<Record<UserFieldErrorKey, string>> = {}
    ): void {
        setUserModalError(text);
        setUserFormErrors(fieldErrors);
        message.error(text);
    }

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        void loadBooks();
    }, [isAuthenticated, loadBooks]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        void loadUsers();
    }, [isAuthenticated, loadUsers]);

    /**
     * Aplica filtros da listagem de livros.
     *
     * @returns void.
     */
    function applyBookFilters(): void {
        setAppliedFilters({
            search: bookSearch.trim(),
            publisher: publisherFilter.trim(),
            library: libraryFilter.trim(),
        });
    }

    /**
     * Limpa filtros de livros e recarrega a listagem.
     *
     * @returns void.
     */
    function clearBookFilters(): void {
        setBookSearch("");
        setPublisherFilter("");
        setLibraryFilter("");
        setAppliedFilters(emptyFilters);
    }

    /**
     * Aplica busca textual da listagem de usuários.
     *
     * @returns void.
     */
    function applyUserSearch(): void {
        setAppliedUserSearch(userSearch.trim());
    }

    /**
     * Limpa busca textual de usuários e recarrega a listagem completa.
     *
     * @returns void.
     */
    function clearUserSearch(): void {
        setUserSearch("");
        setAppliedUserSearch("");
    }

    /**
     * Abre modal para cadastro de novo livro.
     *
     * @returns void.
     */
    function openCreateBookModal(): void {
        setBookModalMode("create");
        setBookForm(emptyBookForm);
        setBookFile(null);
        setBookModalError("");
        setBookFormErrors({});
        setBookModalOpen(true);
    }

    /**
     * Abre modal para edição de livro existente.
     *
     * @param book Livro selecionado para edição.
     * @returns Promise<void>.
     */
    async function openEditBookModal(book: AdminBook): Promise<void> {
        setError("");
        setBookModalMode("edit");
        setBookModalError("");
        setBookFormErrors({});
        const fallbackForm = mapBookToForm(book);
        const token = await getAccessToken();
        if (!token || !book.id) {
            showBookModalError("Sessão expirada. Faça login novamente.");
            return;
        }

        try {
            const selected = await fetchBookById(token, book.book_id || book.id);
            setBookForm(mapBookToForm(selected));
            setBookFile(null);
            setBookModalOpen(true);
        } catch (err) {
            const resolvedByLibraryBook = await resolveBookIdByLibraryBookId(token, book.id);
            if (resolvedByLibraryBook) {
                try {
                    const selected = await fetchBookById(token, resolvedByLibraryBook);
                    setBookForm(mapBookToForm(selected));
                    setBookFile(null);
                    setBookModalOpen(true);
                    return;
                } catch {
                    // Segue para fallback final com dados da listagem.
                }
            }

            setBookForm(fallbackForm);
            setBookFile(null);
            setBookModalOpen(true);
            showBookModalError(
                `${normalizeErrorMessage(
                    err,
                    "Erro ao carregar livro para edição."
                )} Exibindo dados já carregados na listagem.`
            );
        }
    }

    /**
     * Fecha modal de livro e limpa estado transitório.
     *
     * @returns void.
     */
    function closeBookModal(): void {
        setBookModalOpen(false);
        setBookFile(null);
        setBookModalError("");
        setBookFormErrors({});
    }

    /**
     * Salva dados do modal de livro (criação ou edição).
     *
     * @param event Evento de submit.
     * @returns Promise<void>.
     */
    async function saveBook(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError("");
        setBookModalError("");
        setBookFormErrors({});

        const validationError = validateBookForm(bookForm, bookModalMode, Boolean(bookFile));
        if (validationError) {
            showBookModalError(validationError.message, validationError.fieldErrors);
            return;
        }

        setIsSavingBook(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                showBookModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const payload = {
                title: toNullableField(bookForm.title),
                publisher: toNullableField(bookForm.publisher),
                author: toNullableField(bookForm.author),
                subject: toNullableField(bookForm.subject),
                type: toNullableField(bookForm.type),
                external_url: toNullableField(bookForm.external_url),
                file_name: toNullableField(bookForm.file_name),
                image_url: toNullableField(bookForm.image_url),
                edition: toNullableField(bookForm.edition),
                year: toNullableField(bookForm.year),
                isbn: toNullableField(bookForm.isbn),
                pages: toNullableField(bookForm.pages),
                language: toNullableField(bookForm.language),
                review: toNullableField(bookForm.review),
            };

            if (bookModalMode === "edit" && bookForm.id) {
                await updateBook(token, bookForm.id, payload);
            } else if (bookFile) {
                const base64Content = await readFileAsBase64(bookFile);
                const { fileName, fileExtension } = getFileParts(bookFile);
                const resolvedLibrary = bookForm.library
                    ? Number(bookForm.library)
                    : undefined;

                await createBook(token, {
                    ...payload,
                    file_name: payload.file_name || fileName,
                    library: resolvedLibrary,
                    base64_content: base64Content,
                    file_extension: fileExtension,
                });
            }

            setBookModalOpen(false);
            setBookForm(emptyBookForm);
            setBookFile(null);
            setBookModalError("");
            setBookFormErrors({});
            await loadBooks();
        } catch (err) {
            showBookModalError(normalizeErrorMessage(err, "Erro ao salvar livro."));
        } finally {
            setIsSavingBook(false);
        }
    }

    /**
     * Remove um livro cadastrado.
     *
     * @param bookId Identificador do livro.
     * @returns Promise<void>.
     */
    async function removeBook(bookId: string): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deleteBook(token, bookId);
            await loadBooks();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao remover livro."));
        }
    }

    /**
     * Abre modal para cadastro de novo usuário.
     *
     * @returns void.
     */
    function openCreateUserModal(): void {
        setUserModalMode("create");
        setUserForm(emptyUserForm);
        setUserModalError("");
        setUserFormErrors({});
        setUserModalOpen(true);
    }

    /**
     * Abre modal para edição de usuário existente.
     *
     * @param user Usuário selecionado.
     * @returns void.
     */
    function openEditUserModal(user: AdminUser): void {
        setUserModalMode("edit");
        setUserForm({
            id: user.id,
            email: user.email,
            senha: "",
            dica_senha: user.pass_hint,
            admin: Boolean(user.admin),
        });
        setUserModalError("");
        setUserFormErrors({});
        setUserModalOpen(true);
    }

    /**
     * Fecha modal de usuário.
     *
     * @returns void.
     */
    function closeUserModal(): void {
        setUserModalOpen(false);
        setUserModalError("");
        setUserFormErrors({});
    }

    /**
     * Salva dados do modal de usuário (criação ou edição).
     *
     * @param event Evento de submit.
     * @returns Promise<void>.
     */
    async function saveUser(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError("");
        setUserModalError("");
        setUserFormErrors({});

        const validationError = validateUserForm(userForm, userModalMode);
        if (validationError) {
            showUserModalError(validationError.message, validationError.fieldErrors);
            return;
        }

        setIsSavingUser(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                showUserModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const email = userForm.email.trim();
            const dicaSenha = userForm.dica_senha.trim();
            const senha = userForm.senha.trim();

            if (userModalMode === "edit" && userForm.id) {
                await updateUser(token, userForm.id, {
                    email,
                    dica_senha: dicaSenha,
                    admin: userForm.admin,
                    ...(senha ? { senha } : {}),
                });
            } else {
                await createUser(token, {
                    email,
                    dica_senha: dicaSenha,
                    admin: userForm.admin,
                    senha,
                });
            }

            setUserModalOpen(false);
            setUserForm(emptyUserForm);
            setUserModalError("");
            setUserFormErrors({});
            await loadUsers();
        } catch (err) {
            showUserModalError(normalizeErrorMessage(err, "Erro ao salvar usuário."));
        } finally {
            setIsSavingUser(false);
        }
    }

    /**
     * Remove usuário administrativo.
     *
     * @param userId Identificador do usuário.
     * @returns Promise<void>.
     */
    async function removeUser(userId: string): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deleteUser(token, userId);
            await loadUsers();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao remover usuário."));
        }
    }

    return {
        state: {
            books,
            users,
            hasMoreBooks,
            isLoadingBooks,
            isLoadingMoreBooks,
            isLoadingUsers,
            isSavingBook,
            isSavingUser,
            bookSearch,
            publisherFilter,
            libraryFilter,
            userSearch,
            activeTab,
            error,
            bookModalOpen,
            bookModalMode,
            bookForm,
            bookFile,
            bookModalError,
            bookFormErrors,
            userModalOpen,
            userModalMode,
            userForm,
            userModalError,
            userFormErrors,
        },
        actions: {
            setBookSearch,
            setPublisherFilter,
            setLibraryFilter,
            setUserSearch,
            clearBookFieldError,
            clearUserFieldError,
            setActiveTab,
            applyBookFilters,
            clearBookFilters,
            applyUserSearch,
            clearUserSearch,
            loadBooks,
            loadMoreBooks,
            loadUsers,
            refreshCurrentTab,
            openCreateBookModal,
            openEditBookModal,
            closeBookModal,
            setBookForm,
            setBookFile,
            saveBook,
            removeBook,
            openCreateUserModal,
            openEditUserModal,
            closeUserModal,
            setUserForm,
            saveUser,
            removeUser,
        },
    };
}
