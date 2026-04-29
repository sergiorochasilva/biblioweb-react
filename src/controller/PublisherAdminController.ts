import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Publisher } from "../types";
import { useAuth } from "../contexts/AuthContext";
import {
    CreateBookPayload,
    fetchAuthors,
    fetchBookById,
    fetchBookLibraryIds,
    fetchBooks,
    fetchSubjects,
    generatePurchaseLink,
    getFileParts,
    PublisherAdminBook,
    PublisherAuthor,
    PublisherSubject,
    readFileAsBase64,
    sha256Hex,
    UpdateBookPayload,
    updateBook,
    createBook,
} from "../service/PublisherAdminService";
import { getPublisherAdminPublishers } from "../service/permissions";

type PurchaseLinkItem = {
    url: string;
    bookId: string;
    userEmail: string;
    createdAt: string;
};

type PublisherAdminTabKey = "books" | "sale-links";
type BookModalMode = "create" | "edit";

type BookFieldErrorKey =
    | "title"
    | "authors"
    | "publisher"
    | "subjects"
    | "file_name"
    | "edition"
    | "file";

type ValidationResult<TField extends string> = {
    message: string;
    fieldErrors: Partial<Record<TField, string>>;
};

type BookFormState = {
    id?: string;
    title: string;
    subtitle: string;
    original_title: string;
    corporate_author: string;
    publisher: string;
    publication_place: string;
    authors: string[];
    dewey_decimal: string;
    subjects: string[];
    file_name: string;
    edition: string;
    year: string;
    isbn: string;
    pages: string;
    language: string;
    summary: string;
    general_note: string;
    bibliography_note: string;
    content_type: string;
    media_type: string;
    carrier_type: string;
    image_url: string;
    libraries: string[];
};

const emptyBookForm: BookFormState = {
    title: "",
    subtitle: "",
    original_title: "",
    corporate_author: "",
    publisher: "",
    publication_place: "",
    authors: [],
    dewey_decimal: "",
    subjects: [],
    file_name: "",
    edition: "",
    year: "",
    isbn: "",
    pages: "",
    language: "",
    summary: "",
    general_note: "",
    bibliography_note: "",
    content_type: "",
    media_type: "",
    carrier_type: "",
    image_url: "",
    libraries: [],
};

/**
 * Extrai mensagem legível de erro desconhecido.
 *
 * @param error Erro capturado.
 * @param fallback Mensagem usada quando erro não possui texto.
 * @returns Mensagem final para exibição na UI.
 */
function normalizeErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

/**
 * Converte texto de formulário para valor opcional compatível com o DTO.
 *
 * @param value Texto bruto do campo.
 * @returns Texto com ``trim`` ou ``null`` quando vazio.
 */
function toNullableField(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

/**
 * Converte lista textual para IDs numéricos únicos de assunto.
 *
 * @param values IDs em formato textual.
 * @returns IDs numéricos únicos.
 */
function parseBookSubjectIds(values: string[]): number[] {
    const unique = new Set<number>();

    for (const value of values) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            continue;
        }
        unique.add(parsed);
    }

    return Array.from(unique.values());
}

/**
 * Converte lista textual para IDs numéricos únicos de autor.
 *
 * @param values IDs em formato textual.
 * @returns IDs numéricos únicos.
 */
function parseBookAuthorIds(values: string[]): number[] {
    const unique = new Set<number>();

    for (const value of values) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            continue;
        }
        unique.add(parsed);
    }

    return Array.from(unique.values());
}

/**
 * Converte lista textual para IDs numéricos únicos de acervo.
 *
 * @param values IDs em formato textual.
 * @returns IDs numéricos únicos.
 */
function parseBookLibraryIds(values: string[]): number[] {
    const unique = new Set<number>();

    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            unique.add(parsed);
        }
    }

    return Array.from(unique.values());
}

/**
 * Indica se um livro é do tipo protegido.
 *
 * @param value Tipo bruto retornado pela API.
 * @returns ``true`` quando o tipo for ``protected``.
 */
function isProtectedType(value: string | null | undefined): boolean {
    return (value || "").trim().toLowerCase() === "protected";
}

/**
 * Resolve o valor de editora permitido para o formulário.
 *
 * @param rawPublisher Editora bruta vinda da API.
 * @param allowedPublishers Editoras administráveis pelo usuário.
 * @param fallback Valor padrão quando editora não for permitida.
 * @returns Editora válida para o formulário.
 */
function resolveAllowedPublisher(
    rawPublisher: string,
    allowedPublishers: Publisher[],
    fallback: string
): string {
    const trimmed = rawPublisher.trim();
    if (trimmed && allowedPublishers.some((publisher) => publisher.id === trimmed)) {
        return trimmed;
    }
    return fallback;
}

/**
 * Converte dados de livro para estado de formulário de modal.
 *
 * @param book Livro retornado pela API.
 * @param allowedPublishers Editoras administráveis pelo usuário.
 * @param defaultPublisherId Editora padrão.
 * @returns Estado preenchido para edição.
 */
function mapBookToForm(
    book: PublisherAdminBook,
    allowedPublishers: Publisher[],
    defaultPublisherId: string
): BookFormState {
    const rawSubjects = Array.isArray(book.subjects) ? book.subjects : [];
    const rawAuthors = Array.isArray(book.authors) ? book.authors : [];
    const rawBook = book as unknown as Record<string, unknown>;

    const rawLibraries = Array.isArray(rawBook.libraries)
        ? rawBook.libraries
              .map((item) => (item === null || item === undefined ? "" : String(item).trim()))
              .filter((item) => Boolean(item))
        : [];
    const rawLibrary = rawBook.library;
    const fallbackLibrary =
        typeof rawLibrary === "number"
            ? String(rawLibrary)
            : typeof rawLibrary === "string"
                ? rawLibrary.trim()
                : "";
    const resolvedLibraries = rawLibraries.length > 0
        ? rawLibraries
        : fallbackLibrary
            ? [fallbackLibrary]
            : [];

    return {
        id: book.id,
        title: book.title || "",
        subtitle: book.subtitle || "",
        original_title: book.original_title || "",
        corporate_author: book.corporate_author || "",
        publisher: resolveAllowedPublisher(
            book.publisher || "",
            allowedPublishers,
            defaultPublisherId
        ),
        publication_place: book.publication_place || "",
        authors: rawAuthors
            .map((item) => (item && typeof item.author === "number" ? String(item.author) : ""))
            .filter((item) => Boolean(item)),
        dewey_decimal: book.dewey_decimal || "",
        subjects: rawSubjects
            .map((item) => (item && typeof item.subject === "number" ? String(item.subject) : ""))
            .filter((item) => Boolean(item)),
        file_name: book.file_name || "",
        edition: book.edition || "",
        year: book.year || "",
        isbn: book.isbn || "",
        pages: book.pages || "",
        language: book.language || "",
        summary: book.summary || "",
        general_note: book.general_note || "",
        bibliography_note: book.bibliography_note || "",
        content_type: book.content_type || "",
        media_type: book.media_type || "",
        carrier_type: book.carrier_type || "",
        image_url: book.image_url || "",
        libraries: resolvedLibraries,
    };
}

/**
 * Valida campos obrigatórios do formulário de livro da editora.
 *
 * @param form Estado atual do formulário.
 * @param mode Modo de operação (criação ou edição).
 * @param hasBookFile Indica se arquivo foi selecionado para upload.
 * @returns Mensagem/campos inválidos ou ``null`` quando válido.
 */
function validateBookForm(
    form: BookFormState,
    mode: BookModalMode,
    hasBookFile: boolean
): ValidationResult<BookFieldErrorKey> | null {
    const fieldErrors: Partial<Record<BookFieldErrorKey, string>> = {};

    if (!form.title.trim()) {
        fieldErrors.title = "Título obrigatório.";
    }

    if (!form.authors || form.authors.length <= 0) {
        fieldErrors.authors = "Selecione ao menos um autor.";
    }

    if (!form.publisher.trim()) {
        fieldErrors.publisher = "Editora obrigatória.";
    }

    if (!form.subjects || form.subjects.length <= 0) {
        fieldErrors.subjects = "Selecione ao menos um assunto.";
    }

    if (!form.file_name.trim() && !(mode === "create" && hasBookFile)) {
        fieldErrors.file_name = "Nome do arquivo obrigatório.";
    }

    if (!form.edition.trim()) {
        fieldErrors.edition = "Edição obrigatória.";
    }

    if (mode === "create" && !hasBookFile) {
        fieldErrors.file = "Arquivo obrigatório para cadastro.";
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
 * Hook/controller da tela administrativa da editora.
 *
 * @returns Estado e ações para CRUD de livros protegidos e geração de links.
 */
export function usePublisherAdminController() {
    const { getAccessToken, isAuthenticated, publisher, profile } = useAuth();

    const publisherAdminPublishers = useMemo(
        () => getPublisherAdminPublishers(profile),
        [profile]
    );
    const defaultPublisherId = useMemo(() => {
        if (publisherAdminPublishers.length <= 0) {
            return "";
        }

        if (
            publisher?.id &&
            publisherAdminPublishers.some((item) => item.id === publisher.id)
        ) {
            return publisher.id;
        }

        return publisherAdminPublishers[0].id;
    }, [publisher?.id, publisherAdminPublishers]);

    const [activeTab, setActiveTab] = useState<PublisherAdminTabKey>("books");
    const [books, setBooks] = useState<PublisherAdminBook[]>([]);
    const [subjects, setSubjects] = useState<PublisherSubject[]>([]);
    const [authors, setAuthors] = useState<PublisherAuthor[]>([]);

    const [isLoadingBooks, setIsLoadingBooks] = useState(false);
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
    const [isLoadingAuthors, setIsLoadingAuthors] = useState(false);
    const [isSavingBook, setIsSavingBook] = useState(false);
    const [isGeneratingPurchaseLink, setIsGeneratingPurchaseLink] = useState(false);

    const [error, setError] = useState("");

    const [bookSearch, setBookSearch] = useState("");
    const [appliedBookSearch, setAppliedBookSearch] = useState("");
    const [publisherFilter, setPublisherFilter] = useState("");

    const [bookModalOpen, setBookModalOpen] = useState(false);
    const [bookModalMode, setBookModalMode] = useState<BookModalMode>("create");
    const [bookModalError, setBookModalError] = useState("");
    const [bookForm, setBookForm] = useState<BookFormState>(emptyBookForm);
    const [bookFormErrors, setBookFormErrors] =
        useState<Partial<Record<BookFieldErrorKey, string>>>({});
    const [bookFile, setBookFile] = useState<File | null>(null);

    const [purchasePublisherId, setPurchasePublisherId] = useState("");
    const [purchaseEmail, setPurchaseEmail] = useState("");
    const [purchasePassword, setPurchasePassword] = useState("");
    const [purchaseHint, setPurchaseHint] = useState("");
    const [purchaseBookId, setPurchaseBookId] = useState("");
    const [purchaseLinks, setPurchaseLinks] = useState<PurchaseLinkItem[]>([]);

    const bookOptions = useMemo(
        () =>
            books
                .filter((book) => Boolean(book.id))
                .map((book) => ({
                    value: book.id,
                    label: book.title,
                })),
        [books]
    );

    /**
     * Carrega lista de assuntos para seleção no cadastro/edição de livros.
     *
     * @returns Promise<void>
     */
    const loadSubjects = useCallback(async (): Promise<void> => {
        setIsLoadingSubjects(true);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await fetchSubjects(accessToken);
            setSubjects(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao buscar assuntos."));
        } finally {
            setIsLoadingSubjects(false);
        }
    }, [getAccessToken]);

    /**
     * Carrega lista de autores para seleção no cadastro/edição de livros.
     *
     * @returns Promise<void>
     */
    const loadAuthors = useCallback(async (): Promise<void> => {
        setIsLoadingAuthors(true);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await fetchAuthors(accessToken);
            setAuthors(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao buscar autores."));
        } finally {
            setIsLoadingAuthors(false);
        }
    }, [getAccessToken]);

    /**
     * Carrega livros protegidos, aplicando filtros de busca e contexto.
     *
     * @returns Promise<void>
     */
    const loadBooks = useCallback(async (): Promise<void> => {
        if (!publisherFilter) {
            setBooks([]);
            return;
        }

        setIsLoadingBooks(true);
        setError("");

        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await fetchBooks(accessToken, {
                publisher: publisherFilter,
                search: appliedBookSearch.trim() || undefined,
                limit: 200,
            });

            const protectedBooks = result.filter((book) => isProtectedType(book.type));
            setBooks(protectedBooks);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao buscar livros."));
        } finally {
            setIsLoadingBooks(false);
        }
    }, [appliedBookSearch, getAccessToken, publisherFilter]);

    /**
     * Recarrega dados de acordo com a aba ativa.
     *
     * @returns Promise<void>
     */
    const refreshCurrentTab = useCallback(async (): Promise<void> => {
        if (activeTab === "books") {
            await Promise.all([loadBooks(), loadSubjects(), loadAuthors()]);
            return;
        }

        await loadBooks();
    }, [activeTab, loadAuthors, loadBooks, loadSubjects]);

    useEffect(() => {
        if (publisherAdminPublishers.length <= 0) {
            setPublisherFilter("");
            setPurchasePublisherId("");
            return;
        }

        setPublisherFilter((previous) => {
            if (
                previous &&
                publisherAdminPublishers.some((item) => item.id === previous)
            ) {
                return previous;
            }
            return defaultPublisherId;
        });

        setPurchasePublisherId((previous) => {
            if (
                previous &&
                publisherAdminPublishers.some((item) => item.id === previous)
            ) {
                return previous;
            }
            return defaultPublisherId;
        });
    }, [defaultPublisherId, publisherAdminPublishers]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        if (publisherAdminPublishers.length <= 0 || !publisherFilter) {
            return;
        }

        void loadBooks();
    }, [isAuthenticated, loadBooks, publisherAdminPublishers.length, publisherFilter]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        void loadSubjects();
        void loadAuthors();
    }, [isAuthenticated, loadAuthors, loadSubjects]);

    useEffect(() => {
        if (books.length <= 0) {
            setPurchaseBookId("");
            return;
        }

        setPurchaseBookId((previous) => {
            if (previous && books.some((book) => book.id === previous)) {
                return previous;
            }
            return books[0].id;
        });
    }, [books]);

    /**
     * Limpa mensagem de erro de um campo específico do formulário.
     *
     * @param key Campo que deve ter o erro removido.
     * @returns void
     */
    function clearBookFieldError(key: BookFieldErrorKey): void {
        setBookFormErrors((previous) => {
            if (!previous[key]) {
                return previous;
            }
            const clone = { ...previous };
            delete clone[key];
            return clone;
        });
    }

    /**
     * Abre modal para cadastro de novo livro protegido.
     *
     * @returns void
     */
    function openCreateBookModal(): void {
        setBookModalMode("create");
        setBookModalError("");
        setBookFormErrors({});
        setBookFile(null);
        setBookForm({
            ...emptyBookForm,
            publisher: publisherFilter || defaultPublisherId,
        });
        setBookModalOpen(true);
    }

    /**
     * Abre modal para edição carregando dados completos do livro.
     *
     * @param book Livro selecionado na listagem.
     * @returns Promise<void>
     */
    async function openEditBookModal(book: PublisherAdminBook): Promise<void> {
        setBookModalError("");
        setBookFormErrors({});
        setBookFile(null);
        setError("");

        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const detailedBook = await fetchBookById(accessToken, book.id);
            const relatedLibraries = await fetchBookLibraryIds(accessToken, detailedBook.id);
            const detailedBookWithLibraries: PublisherAdminBook = {
                ...detailedBook,
                libraries: relatedLibraries,
            };
            const mappedForm = mapBookToForm(
                detailedBookWithLibraries,
                publisherAdminPublishers,
                publisherFilter || defaultPublisherId
            );

            setBookModalMode("edit");
            setBookForm(mappedForm);
            setBookModalOpen(true);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar dados do livro."));
        }
    }

    /**
     * Fecha modal de livro e limpa erros locais.
     *
     * @returns void
     */
    function closeBookModal(): void {
        setBookModalOpen(false);
        setBookModalError("");
        setBookFormErrors({});
        setBookFile(null);
    }

    /**
     * Persiste livro (cadastro ou edição) conforme o modo atual do modal.
     *
     * @param event Evento de submit do formulário.
     * @returns Promise<void>
     */
    async function saveBook(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const validationError = validateBookForm(
            bookForm,
            bookModalMode,
            Boolean(bookFile)
        );
        if (validationError) {
            setBookModalError(validationError.message);
            setBookFormErrors(validationError.fieldErrors);
            return;
        }

        if (bookModalMode === "edit" && !bookForm.id) {
            setBookModalError("Livro inválido para edição.");
            return;
        }

        setBookModalError("");
        setBookFormErrors({});
        setError("");
        setIsSavingBook(true);

        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setBookModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const subjectIds = parseBookSubjectIds(bookForm.subjects);
            const authorIds = parseBookAuthorIds(bookForm.authors);
            const parsedLibraryIds = parseBookLibraryIds(bookForm.libraries);
            const payload: UpdateBookPayload = {
                title: toNullableField(bookForm.title),
                subtitle: toNullableField(bookForm.subtitle),
                original_title: toNullableField(bookForm.original_title),
                corporate_author: toNullableField(bookForm.corporate_author),
                publisher: toNullableField(bookForm.publisher),
                publication_place: toNullableField(bookForm.publication_place),
                dewey_decimal: toNullableField(bookForm.dewey_decimal),
                type: "protected",
                external_url: null,
                external_source: null,
                file_name: toNullableField(bookForm.file_name),
                image_url: toNullableField(bookForm.image_url),
                edition: toNullableField(bookForm.edition),
                year: toNullableField(bookForm.year),
                isbn: toNullableField(bookForm.isbn),
                pages: toNullableField(bookForm.pages),
                language: toNullableField(bookForm.language),
                summary: toNullableField(bookForm.summary),
                general_note: toNullableField(bookForm.general_note),
                bibliography_note: toNullableField(bookForm.bibliography_note),
                content_type: toNullableField(bookForm.content_type),
                media_type: toNullableField(bookForm.media_type),
                carrier_type: toNullableField(bookForm.carrier_type),
                authors: authorIds.map((authorId) => ({ author: authorId })),
                subjects: subjectIds.map((subjectId) => ({ subject: subjectId })),
            };

            if (bookModalMode === "edit" && parsedLibraryIds.length > 0) {
                payload.libraries = parsedLibraryIds;
            }

            if (bookModalMode === "create") {
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

                await createBook(accessToken, createPayload);
            } else {
                await updateBook(accessToken, bookForm.id!, payload);
            }

            closeBookModal();
            await loadBooks();
        } catch (err) {
            setBookModalError(normalizeErrorMessage(err, "Erro ao salvar livro."));
        } finally {
            setIsSavingBook(false);
        }
    }

    /**
     * Aplica filtros de busca da aba de livros.
     *
     * @returns void
     */
    function applyBookFilters(): void {
        setAppliedBookSearch(bookSearch.trim());
    }

    /**
     * Limpa filtros de busca da aba de livros.
     *
     * @returns void
     */
    function clearBookFilters(): void {
        setBookSearch("");
        setAppliedBookSearch("");
    }

    /**
     * Gera um link assinado de venda/licenciamento.
     *
     * @param event Evento de submit do formulário.
     * @returns Promise<void>
     */
    async function handleGeneratePurchaseLink(
        event: FormEvent<HTMLFormElement>
    ): Promise<void> {
        event.preventDefault();

        if (
            !purchasePublisherId ||
            !purchaseBookId ||
            !purchaseEmail ||
            !purchasePassword ||
            !purchaseHint
        ) {
            setError("Preencha todos os campos do link de venda.");
            return;
        }

        setError("");
        setIsGeneratingPurchaseLink(true);

        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const passHash = await sha256Hex(purchasePassword);
            const payload = {
                publisher: purchasePublisherId,
                book_id: purchaseBookId,
                user_email: purchaseEmail,
                reading_pass_hint: purchaseHint,
                reading_pass_hash: passHash,
            };

            const data = await generatePurchaseLink(accessToken, payload);
            if (!data.purchase_link) {
                throw new Error("Resposta inválida ao gerar link.");
            }

            setPurchaseLinks((previous) => [
                {
                    url: data.purchase_link,
                    bookId: purchaseBookId,
                    userEmail: purchaseEmail,
                    createdAt: new Date().toLocaleString("pt-BR"),
                },
                ...previous,
            ]);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao gerar link."));
        } finally {
            setIsGeneratingPurchaseLink(false);
        }
    }

    /**
     * Copia um link gerado para a área de transferência.
     *
     * @param link URL a ser copiada.
     * @returns Promise<void>
     */
    async function handleCopyLink(link: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(link);
        } catch {
            setError("Não foi possível copiar o link.");
        }
    }

    return {
        state: {
            activeTab,
            books,
            subjects,
            authors,
            isLoadingBooks,
            isLoadingSubjects,
            isLoadingAuthors,
            isSavingBook,
            isGeneratingPurchaseLink,
            error,
            bookSearch,
            publisherFilter,
            bookModalOpen,
            bookModalMode,
            bookModalError,
            bookForm,
            bookFormErrors,
            bookFile,
            purchasePublisherId,
            purchaseEmail,
            purchasePassword,
            purchaseHint,
            purchaseBookId,
            purchaseLinks,
            bookOptions,
            publisherAdminPublishers,
            hasPublisherScope: publisherAdminPublishers.length > 0,
        },
        actions: {
            setActiveTab,
            setBookSearch,
            setPublisherFilter,
            applyBookFilters,
            clearBookFilters,
            refreshCurrentTab,
            openCreateBookModal,
            openEditBookModal,
            closeBookModal,
            saveBook,
            setBookForm,
            clearBookFieldError,
            setBookFile,
            setPurchasePublisherId,
            setPurchaseEmail,
            setPurchasePassword,
            setPurchaseHint,
            setPurchaseBookId,
            handleGeneratePurchaseLink,
            handleCopyLink,
        },
    };
}
