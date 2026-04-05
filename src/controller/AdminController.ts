import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { useAuth } from "../contexts/AuthContext";
import {
    AdminBook,
    AdminLibrary,
    AdminPublisher,
    AdminUser,
    CreateBookPayload,
    createBook,
    createLibrary,
    createPublisher,
    createUser,
    deleteBook,
    deleteLibrary,
    deletePublisher,
    deleteUser,
    fetchBookById,
    fetchBooksPage,
    fetchBooksPageByNext,
    fetchLibraries,
    fetchPublishers,
    fetchUserById,
    fetchUsers,
    getFileParts,
    readFileAsBase64,
    resolveBookIdByLibraryBookId,
    updateBook,
    updateLibrary,
    updatePublisher,
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
    libraries: string[];
    publishers: string[];
};

type LibraryFormState = {
    id?: number;
    cnpj: string;
    nome: string;
};

type PublisherFormState = {
    id: string;
    name: string;
};

type AppliedBookFilters = {
    search: string;
    publisher: string;
    library: string;
};

type AdminTabKey = "books" | "users" | "libraries" | "publishers";

type BookFieldErrorKey =
    | "title"
    | "author"
    | "publisher"
    | "subject"
    | "file_name"
    | "image_url"
    | "edition"
    | "external_url"
    | "library"
    | "file";

type UserFieldErrorKey = "email" | "senha" | "dica_senha";
type LibraryFieldErrorKey = "cnpj" | "nome";
type PublisherFieldErrorKey = "id" | "name";

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
    libraries: [],
    publishers: [],
};

const emptyLibraryForm: LibraryFormState = {
    cnpj: "",
    nome: "",
};

const emptyPublisherForm: PublisherFormState = {
    id: "",
    name: "",
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
 * @param fallbackLibraryId Biblioteca padrão quando o livro não tiver vínculo explícito.
 * @returns Estado preenchido para o formulário de livro.
 */
function mapBookToForm(book: AdminBook, fallbackLibraryId: string): BookFormState {
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
                ? fallbackLibraryId
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
    const externalType = isExternalType(form.type);

    if (!form.title.trim()) {
        fieldErrors.title = "Título obrigatório.";
    }

    if (!form.author.trim()) {
        fieldErrors.author = "Autor obrigatório.";
    }

    if (!form.publisher.trim()) {
        fieldErrors.publisher = "Editora obrigatória.";
    }

    if (!form.subject.trim()) {
        fieldErrors.subject = "Assunto obrigatório.";
    }

    if (!form.library.trim()) {
        fieldErrors.library = "Biblioteca obrigatória.";
    }

    if (!externalType && !form.file_name.trim() && !(mode === "create" && hasBookFile)) {
        fieldErrors.file_name = "Nome do arquivo obrigatório.";
    }

    if (!form.edition.trim()) {
        fieldErrors.edition = "Edição obrigatória.";
    }

    if (mode === "create" && !externalType && !hasBookFile) {
        fieldErrors.file = "Arquivo obrigatório para cadastro.";
    }

    if (mode === "create" && externalType && hasBookFile) {
        fieldErrors.file = "Arquivo não permitido para livros do tipo Externo.";
    }

    if (externalType && !form.external_url.trim()) {
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
 * Valida campos do formulário de biblioteca.
 *
 * @param form Estado atual do formulário.
 * @returns Estrutura de erro com mensagem/campos inválidos ou ``null``.
 */
function validateLibraryForm(
    form: LibraryFormState
): ValidationResult<LibraryFieldErrorKey> | null {
    const fieldErrors: Partial<Record<LibraryFieldErrorKey, string>> = {};

    if (!form.nome.trim()) {
        fieldErrors.nome = "Nome obrigatório.";
    }

    if (!form.cnpj.trim()) {
        fieldErrors.cnpj = "CNPJ obrigatório.";
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
 * Valida campos do formulário de editora.
 *
 * @param form Estado atual do formulário.
 * @param mode Modo do modal (criação ou edição).
 * @returns Estrutura de erro com mensagem/campos inválidos ou ``null``.
 */
function validatePublisherForm(
    form: PublisherFormState,
    mode: "create" | "edit"
): ValidationResult<PublisherFieldErrorKey> | null {
    const fieldErrors: Partial<Record<PublisherFieldErrorKey, string>> = {};

    if (mode === "create" && !form.id.trim()) {
        fieldErrors.id = "ID obrigatório.";
    }

    if (!form.name.trim()) {
        fieldErrors.name = "Nome obrigatório.";
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
 * Normaliza o tipo do livro para o formato esperado pela API.
 *
 * @param value Valor bruto do campo ``type``.
 * @returns Tipo normalizado ou ``null`` quando vazio.
 */
function normalizeBookType(value: string): string | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    if (normalized === "externo") {
        return "external";
    }
    return normalized;
}

/**
 * Indica se o tipo informado representa livro externo.
 *
 * @param value Valor do campo ``type``.
 * @returns ``true`` quando o tipo for externo.
 */
function isExternalType(value: string): boolean {
    return normalizeBookType(value) === "external";
}

/**
 * Converte valor textual de biblioteca para número válido.
 *
 * @param value Valor bruto do campo/filtro.
 * @returns ID numérico da biblioteca ou ``undefined`` quando inválido.
 */
function parseLibraryId(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return undefined;
    }
    return parsed;
}

/**
 * Converte lista textual para IDs numéricos únicos de biblioteca.
 *
 * @param values IDs em formato textual.
 * @returns IDs numéricos únicos.
 */
function parseUserLibraryIds(values: string[]): number[] {
    const unique = new Set<number>();

    for (const value of values) {
        const parsed = parseLibraryId(value);
        if (parsed) {
            unique.add(parsed);
        }
    }

    return Array.from(unique.values());
}

/**
 * Converte lista textual para IDs únicos de editora.
 *
 * @param values IDs de editora.
 * @returns IDs únicos e não vazios.
 */
function parseUserPublisherIds(values: string[]): string[] {
    const unique = new Set<string>();

    for (const value of values) {
        const parsed = value.trim();
        if (parsed) {
            unique.add(parsed);
        }
    }

    return Array.from(unique.values());
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
 * @returns Estado da tela e ações para livros/usuários/bibliotecas/editoras.
 */
export function useAdminController() {
    const { isAuthenticated, getAccessToken } = useAuth();

    const [isLoadingBooks, setIsLoadingBooks] = useState(false);
    const [isLoadingMoreBooks, setIsLoadingMoreBooks] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingLibraries, setIsLoadingLibraries] = useState(false);
    const [isLoadingPublishers, setIsLoadingPublishers] = useState(false);
    const [isSavingBook, setIsSavingBook] = useState(false);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const [isSavingLibrary, setIsSavingLibrary] = useState(false);
    const [isSavingPublisher, setIsSavingPublisher] = useState(false);

    const [books, setBooks] = useState<AdminBook[]>([]);
    const [booksNext, setBooksNext] = useState<string | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [libraries, setLibraries] = useState<AdminLibrary[]>([]);
    const [publishers, setPublishers] = useState<AdminPublisher[]>([]);
    const [libraryRows, setLibraryRows] = useState<AdminLibrary[]>([]);
    const [publisherRows, setPublisherRows] = useState<AdminPublisher[]>([]);

    const [bookSearch, setBookSearch] = useState("");
    const [publisherFilter, setPublisherFilter] = useState("");
    const [libraryFilter, setLibraryFilter] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [librarySearch, setLibrarySearch] = useState("");
    const [publisherSearch, setPublisherSearch] = useState("");

    const [activeTab, setActiveTabState] = useState<AdminTabKey>("books");
    const [appliedFilters, setAppliedFilters] = useState<AppliedBookFilters>(emptyFilters);
    const [appliedUserSearch, setAppliedUserSearch] = useState("");
    const [appliedLibrarySearch, setAppliedLibrarySearch] = useState("");
    const [appliedPublisherSearch, setAppliedPublisherSearch] = useState("");

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

    const [libraryModalOpen, setLibraryModalOpen] = useState(false);
    const [libraryModalMode, setLibraryModalMode] = useState<"create" | "edit">("create");
    const [libraryForm, setLibraryForm] = useState<LibraryFormState>(emptyLibraryForm);
    const [libraryModalError, setLibraryModalError] = useState("");
    const [libraryFormErrors, setLibraryFormErrors] =
        useState<Partial<Record<LibraryFieldErrorKey, string>>>({});

    const [publisherModalOpen, setPublisherModalOpen] = useState(false);
    const [publisherModalMode, setPublisherModalMode] = useState<"create" | "edit">("create");
    const [publisherForm, setPublisherForm] = useState<PublisherFormState>(emptyPublisherForm);
    const [publisherModalError, setPublisherModalError] = useState("");
    const [publisherFormErrors, setPublisherFormErrors] =
        useState<Partial<Record<PublisherFieldErrorKey, string>>>({});

    const hasMoreBooks = useMemo(() => Boolean(booksNext), [booksNext]);

    /**
     * Carrega opções de biblioteca/editora para combos do módulo.
     *
     * @returns Promise<void>.
     */
    const loadReferenceData = useCallback(async (): Promise<void> => {
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const [loadedLibraries, loadedPublishers] = await Promise.all([
                fetchLibraries(token),
                fetchPublishers(token),
            ]);

            setLibraries(loadedLibraries);
            setPublishers(loadedPublishers);
            setLibraryRows(loadedLibraries);
            setPublisherRows(loadedPublishers);

            const firstLibraryId = loadedLibraries[0]?.id
                ? String(loadedLibraries[0].id)
                : "";

            setLibraryFilter((previous) => {
                if (
                    previous &&
                    loadedLibraries.some((item) => String(item.id) === previous)
                ) {
                    return previous;
                }
                return firstLibraryId;
            });

            setAppliedFilters((previous) => {
                const currentLibrary =
                    previous.library &&
                    loadedLibraries.some((item) => String(item.id) === previous.library)
                        ? previous.library
                        : firstLibraryId;

                return {
                    ...previous,
                    library: currentLibrary,
                };
            });

            setPublisherFilter((previous) => {
                if (
                    previous &&
                    loadedPublishers.some((item) => item.id === previous)
                ) {
                    return previous;
                }
                return "";
            });
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar listas de apoio."));
        }
    }, [getAccessToken]);

    /**
     * Carrega a primeira página de livros com os filtros aplicados.
     *
     * @returns Promise<void>.
     */
    const loadBooks = useCallback(async (): Promise<void> => {
        if (!appliedFilters.library) {
            setBooks([]);
            setBooksNext(null);
            return;
        }

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
                library: appliedFilters.library,
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
     * Carrega a próxima página de livros usando o link ``next``.
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
            setBooks((previous) => {
                const knownIds = new Set(previous.map((book) => String(book.id)));
                const appendOnly = page.result.filter(
                    (book) => !knownIds.has(String(book.id))
                );
                return [...previous, ...appendOnly];
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

            const result = await fetchUsers(token, appliedUserSearch || undefined);
            setUsers(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar usuários."));
        } finally {
            setIsLoadingUsers(false);
        }
    }, [appliedUserSearch, getAccessToken]);

    /**
     * Carrega bibliotecas para aba de manutenção.
     *
     * @returns Promise<void>.
     */
    const loadLibraryRows = useCallback(async (): Promise<void> => {
        setIsLoadingLibraries(true);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await fetchLibraries(token, appliedLibrarySearch || undefined);
            setLibraryRows(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar bibliotecas."));
        } finally {
            setIsLoadingLibraries(false);
        }
    }, [appliedLibrarySearch, getAccessToken]);

    /**
     * Carrega editoras para aba de manutenção.
     *
     * @returns Promise<void>.
     */
    const loadPublisherRows = useCallback(async (): Promise<void> => {
        setIsLoadingPublishers(true);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await fetchPublishers(token, appliedPublisherSearch || undefined);
            setPublisherRows(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar editoras."));
        } finally {
            setIsLoadingPublishers(false);
        }
    }, [appliedPublisherSearch, getAccessToken]);

    /**
     * Atualiza a aba ativa de administração.
     *
     * @param tabKey Identificador da aba.
     * @returns void.
     */
    function setActiveTab(tabKey: string): void {
        if (tabKey === "users" || tabKey === "libraries" || tabKey === "publishers") {
            setActiveTabState(tabKey);
            return;
        }
        setActiveTabState("books");
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

        if (activeTab === "libraries") {
            await loadReferenceData();
            await loadLibraryRows();
            return;
        }

        if (activeTab === "publishers") {
            await loadReferenceData();
            await loadPublisherRows();
            return;
        }

        await loadReferenceData();
        await loadBooks();
    }, [activeTab, loadBooks, loadLibraryRows, loadPublisherRows, loadReferenceData, loadUsers]);

    /**
     * Remove erro de um campo do formulário de livro.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearBookFieldError(field: BookFieldErrorKey): void {
        setBookModalError("");
        setBookFormErrors((previous) => {
            if (!previous[field]) {
                return previous;
            }
            const next = { ...previous };
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
        setUserFormErrors((previous) => {
            if (!previous[field]) {
                return previous;
            }
            const next = { ...previous };
            delete next[field];
            return next;
        });
    }

    /**
     * Remove erro de um campo do formulário de biblioteca.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearLibraryFieldError(field: LibraryFieldErrorKey): void {
        setLibraryModalError("");
        setLibraryFormErrors((previous) => {
            if (!previous[field]) {
                return previous;
            }
            const next = { ...previous };
            delete next[field];
            return next;
        });
    }

    /**
     * Remove erro de um campo do formulário de editora.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearPublisherFieldError(field: PublisherFieldErrorKey): void {
        setPublisherModalError("");
        setPublisherFormErrors((previous) => {
            if (!previous[field]) {
                return previous;
            }
            const next = { ...previous };
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

    /**
     * Exibe erro no modal de bibliotecas e dispara toaster.
     *
     * @param text Mensagem a ser exibida.
     * @param fieldErrors Erros de campos opcionais.
     * @returns void.
     */
    function showLibraryModalError(
        text: string,
        fieldErrors: Partial<Record<LibraryFieldErrorKey, string>> = {}
    ): void {
        setLibraryModalError(text);
        setLibraryFormErrors(fieldErrors);
        message.error(text);
    }

    /**
     * Exibe erro no modal de editoras e dispara toaster.
     *
     * @param text Mensagem a ser exibida.
     * @param fieldErrors Erros de campos opcionais.
     * @returns void.
     */
    function showPublisherModalError(
        text: string,
        fieldErrors: Partial<Record<PublisherFieldErrorKey, string>> = {}
    ): void {
        setPublisherModalError(text);
        setPublisherFormErrors(fieldErrors);
        message.error(text);
    }

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        void loadReferenceData();
    }, [isAuthenticated, loadReferenceData]);

    useEffect(() => {
        if (!isAuthenticated || !appliedFilters.library) {
            return;
        }

        void loadBooks();
    }, [isAuthenticated, loadBooks, appliedFilters.library]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        void loadUsers();
    }, [isAuthenticated, loadUsers]);

    useEffect(() => {
        if (!isAuthenticated || activeTab !== "libraries") {
            return;
        }

        void loadLibraryRows();
    }, [activeTab, isAuthenticated, loadLibraryRows]);

    useEffect(() => {
        if (!isAuthenticated || activeTab !== "publishers") {
            return;
        }

        void loadPublisherRows();
    }, [activeTab, isAuthenticated, loadPublisherRows]);

    /**
     * Aplica filtros da listagem de livros.
     *
     * @returns void.
     */
    function applyBookFilters(): void {
        const normalizedLibrary = libraryFilter.trim();
        if (!normalizedLibrary) {
            message.error("Selecione uma biblioteca para filtrar os livros.");
            return;
        }

        setAppliedFilters({
            search: bookSearch.trim(),
            publisher: publisherFilter.trim(),
            library: normalizedLibrary,
        });
    }

    /**
     * Limpa filtros de livros e recarrega a listagem.
     *
     * @returns void.
     */
    function clearBookFilters(): void {
        const firstLibraryId = libraries[0]?.id ? String(libraries[0].id) : "";
        setBookSearch("");
        setPublisherFilter("");
        setLibraryFilter(firstLibraryId);
        setAppliedFilters({
            ...emptyFilters,
            library: firstLibraryId,
        });
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
     * Aplica busca textual da aba de bibliotecas.
     *
     * @returns void.
     */
    function applyLibrarySearch(): void {
        setAppliedLibrarySearch(librarySearch.trim());
    }

    /**
     * Limpa busca textual da aba de bibliotecas.
     *
     * @returns void.
     */
    function clearLibrarySearch(): void {
        setLibrarySearch("");
        setAppliedLibrarySearch("");
    }

    /**
     * Aplica busca textual da aba de editoras.
     *
     * @returns void.
     */
    function applyPublisherSearch(): void {
        setAppliedPublisherSearch(publisherSearch.trim());
    }

    /**
     * Limpa busca textual da aba de editoras.
     *
     * @returns void.
     */
    function clearPublisherSearch(): void {
        setPublisherSearch("");
        setAppliedPublisherSearch("");
    }

    /**
     * Abre modal para cadastro de novo livro.
     *
     * @returns void.
     */
    function openCreateBookModal(): void {
        const defaultLibrary = libraryFilter.trim() || (libraries[0] ? String(libraries[0].id) : "");
        if (!defaultLibrary) {
            message.error("Cadastre ao menos uma biblioteca antes de adicionar livros.");
            return;
        }

        setBookModalMode("create");
        setBookForm({
            ...emptyBookForm,
            library: defaultLibrary,
            publisher: publishers[0]?.id || "",
        });
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

        const fallbackLibrary =
            book.library !== undefined && book.library !== null
                ? String(book.library)
                : libraryFilter.trim() || (libraries[0] ? String(libraries[0].id) : "");
        const fallbackForm = mapBookToForm(book, fallbackLibrary);

        const token = await getAccessToken();
        if (!token || !book.id) {
            showBookModalError("Sessão expirada. Faça login novamente.");
            return;
        }

        try {
            const selected = await fetchBookById(token, book.book_id || book.id);
            setBookForm(mapBookToForm(selected, fallbackLibrary));
            setBookFile(null);
            setBookModalOpen(true);
        } catch (err) {
            const resolvedByLibraryBook = await resolveBookIdByLibraryBookId(token, book.id);
            if (resolvedByLibraryBook) {
                try {
                    const selected = await fetchBookById(token, resolvedByLibraryBook);
                    setBookForm(mapBookToForm(selected, fallbackLibrary));
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

            const libraryId = parseLibraryId(bookForm.library);
            if (!libraryId) {
                showBookModalError("Selecione uma biblioteca válida.", {
                    library: "Biblioteca obrigatória.",
                });
                return;
            }

            const payload = {
                title: toNullableField(bookForm.title),
                publisher: toNullableField(bookForm.publisher),
                author: toNullableField(bookForm.author),
                subject: toNullableField(bookForm.subject),
                library: libraryId,
                type: normalizeBookType(bookForm.type),
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
            } else {
                const createPayload: CreateBookPayload = {
                    ...payload,
                };

                if (bookFile) {
                    const base64Content = await readFileAsBase64(bookFile);
                    const { fileName, fileExtension } = getFileParts(bookFile);
                    createPayload.file_name = createPayload.file_name || fileName;
                    createPayload.base64_content = base64Content;
                    createPayload.file_extension = fileExtension;
                }

                await createBook(token, createPayload);
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
     * @returns Promise<void>.
     */
    async function openEditUserModal(user: AdminUser): Promise<void> {
        setUserModalMode("edit");
        setUserModalError("");
        setUserFormErrors({});

        try {
            const token = await getAccessToken();
            if (!token) {
                showUserModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const detailed = await fetchUserById(token, user.id);
            setUserForm({
                id: detailed.id,
                email: detailed.email,
                senha: "",
                dica_senha: detailed.pass_hint,
                admin: Boolean(detailed.admin),
                libraries: detailed.libraries.map((value) => String(value)),
                publishers: detailed.publishers,
            });
            setUserModalOpen(true);
        } catch (err) {
            setUserForm({
                id: user.id,
                email: user.email,
                senha: "",
                dica_senha: user.pass_hint,
                admin: Boolean(user.admin),
                libraries: user.libraries.map((value) => String(value)),
                publishers: user.publishers,
            });
            setUserModalOpen(true);
            showUserModalError(
                `${normalizeErrorMessage(
                    err,
                    "Erro ao carregar detalhes do usuário."
                )} Exibindo os dados da listagem.`
            );
        }
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
            const userLibraries = parseUserLibraryIds(userForm.libraries);
            const userPublishers = parseUserPublisherIds(userForm.publishers);

            if (userModalMode === "edit" && userForm.id) {
                await updateUser(token, userForm.id, {
                    email,
                    dica_senha: dicaSenha,
                    admin: userForm.admin,
                    libraries: userLibraries,
                    publishers: userPublishers,
                    ...(senha ? { senha } : {}),
                });
            } else {
                await createUser(token, {
                    email,
                    dica_senha: dicaSenha,
                    admin: userForm.admin,
                    senha,
                    libraries: userLibraries,
                    publishers: userPublishers,
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

    /**
     * Abre modal de criação de biblioteca.
     *
     * @returns void.
     */
    function openCreateLibraryModal(): void {
        setLibraryModalMode("create");
        setLibraryForm(emptyLibraryForm);
        setLibraryModalError("");
        setLibraryFormErrors({});
        setLibraryModalOpen(true);
    }

    /**
     * Abre modal de edição de biblioteca.
     *
     * @param item Biblioteca selecionada.
     * @returns void.
     */
    function openEditLibraryModal(item: AdminLibrary): void {
        setLibraryModalMode("edit");
        setLibraryForm({
            id: item.id,
            cnpj: item.cnpj || "",
            nome: item.nome || "",
        });
        setLibraryModalError("");
        setLibraryFormErrors({});
        setLibraryModalOpen(true);
    }

    /**
     * Fecha modal de biblioteca.
     *
     * @returns void.
     */
    function closeLibraryModal(): void {
        setLibraryModalOpen(false);
        setLibraryModalError("");
        setLibraryFormErrors({});
    }

    /**
     * Persiste formulário de biblioteca.
     *
     * @param event Evento de submit.
     * @returns Promise<void>.
     */
    async function saveLibrary(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setLibraryModalError("");
        setLibraryFormErrors({});

        const validationError = validateLibraryForm(libraryForm);
        if (validationError) {
            showLibraryModalError(validationError.message, validationError.fieldErrors);
            return;
        }

        setIsSavingLibrary(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                showLibraryModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const payload = {
                nome: libraryForm.nome.trim(),
                cnpj: libraryForm.cnpj.trim(),
            };

            if (libraryModalMode === "edit" && libraryForm.id) {
                await updateLibrary(token, libraryForm.id, payload);
            } else {
                await createLibrary(token, payload);
            }

            setLibraryModalOpen(false);
            setLibraryForm(emptyLibraryForm);
            setLibraryModalError("");
            setLibraryFormErrors({});

            await loadReferenceData();
            await loadLibraryRows();
        } catch (err) {
            showLibraryModalError(normalizeErrorMessage(err, "Erro ao salvar biblioteca."));
        } finally {
            setIsSavingLibrary(false);
        }
    }

    /**
     * Remove uma biblioteca da manutenção.
     *
     * @param libraryId ID da biblioteca.
     * @returns Promise<void>.
     */
    async function removeLibrary(libraryId: number): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deleteLibrary(token, libraryId);
            await loadReferenceData();
            await loadLibraryRows();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao remover biblioteca."));
        }
    }

    /**
     * Abre modal de criação de editora.
     *
     * @returns void.
     */
    function openCreatePublisherModal(): void {
        setPublisherModalMode("create");
        setPublisherForm(emptyPublisherForm);
        setPublisherModalError("");
        setPublisherFormErrors({});
        setPublisherModalOpen(true);
    }

    /**
     * Abre modal de edição de editora.
     *
     * @param item Editora selecionada.
     * @returns void.
     */
    function openEditPublisherModal(item: AdminPublisher): void {
        setPublisherModalMode("edit");
        setPublisherForm({
            id: item.id,
            name: item.name,
        });
        setPublisherModalError("");
        setPublisherFormErrors({});
        setPublisherModalOpen(true);
    }

    /**
     * Fecha modal de editora.
     *
     * @returns void.
     */
    function closePublisherModal(): void {
        setPublisherModalOpen(false);
        setPublisherModalError("");
        setPublisherFormErrors({});
    }

    /**
     * Persiste formulário de editora.
     *
     * @param event Evento de submit.
     * @returns Promise<void>.
     */
    async function savePublisher(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setPublisherModalError("");
        setPublisherFormErrors({});

        const validationError = validatePublisherForm(publisherForm, publisherModalMode);
        if (validationError) {
            showPublisherModalError(validationError.message, validationError.fieldErrors);
            return;
        }

        setIsSavingPublisher(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                showPublisherModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const payload = {
                id: publisherForm.id.trim(),
                name: publisherForm.name.trim(),
            };

            if (publisherModalMode === "edit") {
                await updatePublisher(token, publisherForm.id.trim(), payload);
            } else {
                await createPublisher(token, payload);
            }

            setPublisherModalOpen(false);
            setPublisherForm(emptyPublisherForm);
            setPublisherModalError("");
            setPublisherFormErrors({});

            await loadReferenceData();
            await loadPublisherRows();
        } catch (err) {
            showPublisherModalError(normalizeErrorMessage(err, "Erro ao salvar editora."));
        } finally {
            setIsSavingPublisher(false);
        }
    }

    /**
     * Remove uma editora da manutenção.
     *
     * @param publisherId ID da editora.
     * @returns Promise<void>.
     */
    async function removePublisher(publisherId: string): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deletePublisher(token, publisherId);
            await loadReferenceData();
            await loadPublisherRows();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao remover editora."));
        }
    }

    return {
        state: {
            books,
            users,
            libraries,
            publishers,
            libraryRows,
            publisherRows,
            hasMoreBooks,
            isLoadingBooks,
            isLoadingMoreBooks,
            isLoadingUsers,
            isLoadingLibraries,
            isLoadingPublishers,
            isSavingBook,
            isSavingUser,
            isSavingLibrary,
            isSavingPublisher,
            bookSearch,
            publisherFilter,
            libraryFilter,
            userSearch,
            librarySearch,
            publisherSearch,
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
            libraryModalOpen,
            libraryModalMode,
            libraryForm,
            libraryModalError,
            libraryFormErrors,
            publisherModalOpen,
            publisherModalMode,
            publisherForm,
            publisherModalError,
            publisherFormErrors,
        },
        actions: {
            setBookSearch,
            setPublisherFilter,
            setLibraryFilter,
            setUserSearch,
            setLibrarySearch,
            setPublisherSearch,
            clearBookFieldError,
            clearUserFieldError,
            clearLibraryFieldError,
            clearPublisherFieldError,
            setActiveTab,
            applyBookFilters,
            clearBookFilters,
            applyUserSearch,
            clearUserSearch,
            applyLibrarySearch,
            clearLibrarySearch,
            applyPublisherSearch,
            clearPublisherSearch,
            loadBooks,
            loadMoreBooks,
            loadUsers,
            loadLibraryRows,
            loadPublisherRows,
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
            openCreateLibraryModal,
            openEditLibraryModal,
            closeLibraryModal,
            setLibraryForm,
            saveLibrary,
            removeLibrary,
            openCreatePublisherModal,
            openEditPublisherModal,
            closePublisherModal,
            setPublisherForm,
            savePublisher,
            removePublisher,
        },
    };
}
