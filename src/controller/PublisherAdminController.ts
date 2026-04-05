import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Book } from "../model/Book";
import { useAuth } from "../contexts/AuthContext";
import {
    CreateBookPayload,
    UpdateBookPayload,
    createBook,
    fetchBooks,
    generatePurchaseLink,
    getFileParts,
    readFileAsBase64,
    sha256Hex,
    updateBook,
} from "../service/PublisherAdminService";

type PurchaseLinkItem = {
    url: string;
    bookId: string;
    userEmail: string;
    createdAt: string;
};

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
 * @param type Tipo selecionado no formulário.
 * @returns ``true`` quando o tipo for ``external``.
 */
function isExternalType(type: string): boolean {
    return normalizeBookType(type) === "external";
}

/**
 * Valida campos obrigatórios do formulário de livro da editora.
 *
 * @param form Estado atual do formulário.
 * @param mode Modo do formulário (criação ou edição).
 * @param hasBookFile Indica se arquivo foi selecionado para upload.
 * @returns Mensagem de erro quando inválido, senão ``null``.
 */
function validatePublisherBookForm(
    form: BookFormState,
    mode: "create" | "edit",
    hasBookFile: boolean
): string | null {
    const externalType = isExternalType(form.type);

    if (!form.subject.trim()) {
        return "Assunto obrigatório.";
    }

    if (externalType && !form.external_url.trim()) {
        return "URL externa obrigatória para livros do tipo Externo.";
    }

    if (!externalType && !form.file_name.trim() && !(mode === "create" && hasBookFile)) {
        return "Nome do arquivo obrigatório para tipos não externos.";
    }

    if (mode === "create" && !externalType && !hasBookFile) {
        return "Selecione o arquivo do livro para tipos não externos.";
    }

    if (mode === "create" && externalType && hasBookFile) {
        return "Arquivo não permitido para livros do tipo Externo.";
    }

    return null;
}

/**
 * Hook/controller da tela administrativa da editora.
 *
 * @returns Objeto com estado da tela e ações para CRUD de livros e geração de links.
 */
export function usePublisherAdminController() {
    const { getAccessToken, isAuthenticated, publisher, library } = useAuth();
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [editForm, setEditForm] = useState<BookFormState>(emptyBookForm);
    const [createForm, setCreateForm] = useState<BookFormState>(emptyBookForm);
    const [bookFile, setBookFile] = useState<File | null>(null);
    const [publisherId, setPublisherId] = useState("");
    const [purchaseEmail, setPurchaseEmail] = useState("");
    const [purchasePassword, setPurchasePassword] = useState("");
    const [purchaseHint, setPurchaseHint] = useState("");
    const [purchaseBookId, setPurchaseBookId] = useState("");
    const [purchaseLinks, setPurchaseLinks] = useState<PurchaseLinkItem[]>([]);

    const bookOptions = useMemo(() => books.filter((book) => book.id), [books]);

    useEffect(() => {
        if (isAuthenticated) {
            loadBooks();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!selectedBook) {
            return;
        }

        setEditForm({
            id: selectedBook.id,
            title: selectedBook.title || "",
            publisher: selectedBook.publisher || "",
            author: selectedBook.author || "",
            subject: selectedBook.subject || "",
            type: selectedBook.type || "",
            external_url: selectedBook.external_url || "",
            file_name: selectedBook.file_name || "",
            edition: selectedBook.edition || "",
            year: selectedBook.year || "",
            isbn: selectedBook.isbn || "",
            pages: selectedBook.pages || "",
            language: selectedBook.language || "",
            review: selectedBook.review || "",
            image_url: selectedBook.image_url || "",
            library: "",
        });
        setPurchaseBookId(selectedBook.id);
    }, [selectedBook]);

    useEffect(() => {
        if (publisher && !publisherId) {
            setPublisherId(publisher.id);
        }
    }, [publisher, publisherId]);

    useEffect(() => {
        if (library && !createForm.library) {
            setCreateForm((prev) => ({ ...prev, library: library.id.toString() }));
        }
    }, [library, createForm.library]);

    /**
     * Carrega a lista de livros administrativos.
     *
     * @returns Promise<void>
     */
    async function loadBooks(): Promise<void> {
        setIsLoading(true);
        setError("");
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }
            const result = await fetchBooks(accessToken);
            setBooks(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao buscar livros."));
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Submete atualização dos dados de um livro já existente.
     *
     * @param event Evento de submit do formulário.
     * @returns Promise<void>
     */
    async function handleUpdateBook(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!editForm.id) {
            setError("Selecione um livro para editar.");
            return;
        }

        const validationError = validatePublisherBookForm(editForm, "edit", false);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError("");
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const payload: UpdateBookPayload = {
                title: toNullableField(editForm.title),
                publisher: toNullableField(editForm.publisher),
                author: toNullableField(editForm.author),
                subject: toNullableField(editForm.subject),
                type: normalizeBookType(editForm.type),
                external_url: toNullableField(editForm.external_url),
                file_name: toNullableField(editForm.file_name),
                image_url: toNullableField(editForm.image_url),
                edition: toNullableField(editForm.edition),
                year: toNullableField(editForm.year),
                isbn: toNullableField(editForm.isbn),
                pages: toNullableField(editForm.pages),
                language: toNullableField(editForm.language),
                review: toNullableField(editForm.review),
            };

            await updateBook(accessToken, editForm.id, payload);
            await loadBooks();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao atualizar livro."));
        }
    }

    /**
     * Submete cadastro de novo livro com upload de arquivo.
     *
     * @param event Evento de submit do formulário.
     * @returns Promise<void>
     */
    async function handleCreateBook(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const validationError = validatePublisherBookForm(
            createForm,
            "create",
            Boolean(bookFile)
        );
        if (validationError) {
            setError(validationError);
            return;
        }

        setError("");
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }
            const resolvedLibraryId = createForm.library
                ? Number(createForm.library)
                : library?.id;

            const payload: CreateBookPayload = {
                title: toNullableField(createForm.title),
                publisher: toNullableField(createForm.publisher),
                author: toNullableField(createForm.author),
                subject: toNullableField(createForm.subject),
                type: normalizeBookType(createForm.type),
                external_url: toNullableField(createForm.external_url),
                file_name: toNullableField(createForm.file_name),
                edition: toNullableField(createForm.edition),
                year: toNullableField(createForm.year),
                isbn: toNullableField(createForm.isbn),
                pages: toNullableField(createForm.pages),
                language: toNullableField(createForm.language),
                review: toNullableField(createForm.review),
                image_url: toNullableField(createForm.image_url),
                library: resolvedLibraryId,
            };

            if (bookFile) {
                const base64Content = await readFileAsBase64(bookFile);
                const { fileName, fileExtension } = getFileParts(bookFile);
                payload.file_name = payload.file_name || fileName;
                payload.base64_content = base64Content;
                payload.file_extension = fileExtension;
            }

            await createBook(accessToken, payload);
            setCreateForm(emptyBookForm);
            setBookFile(null);
            await loadBooks();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao cadastrar livro."));
        }
    }

    /**
     * Gera um link assinado de compra/empréstimo licenciado.
     *
     * @param event Evento de submit do formulário.
     * @returns Promise<void>
     */
    async function handleGeneratePurchaseLink(
        event: FormEvent<HTMLFormElement>
    ): Promise<void> {
        event.preventDefault();

        const resolvedPublisherId = publisherId || publisher?.id || "";

        if (!resolvedPublisherId || !purchaseBookId || !purchaseEmail || !purchasePassword || !purchaseHint) {
            setError("Preencha todos os campos do link de compra.");
            return;
        }
        setError("");
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }
            const passHash = await sha256Hex(purchasePassword);
            const payload = {
                publisher: resolvedPublisherId,
                book_id: purchaseBookId,
                user_email: purchaseEmail,
                pass_hint: purchaseHint,
                pass_hash: passHash,
            };

            const data = await generatePurchaseLink(accessToken, payload);
            if (!data.purchase_link) {
                throw new Error("Resposta inválida ao gerar link.");
            }

            setPurchaseLinks((prev) => [
                {
                    url: data.purchase_link,
                    bookId: purchaseBookId,
                    userEmail: purchaseEmail,
                    createdAt: new Date().toLocaleString("pt-BR"),
                },
                ...prev,
            ]);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao gerar link."));
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
            books,
            isLoading,
            error,
            selectedBook,
            editForm,
            createForm,
            bookFile,
            publisherId,
            purchaseEmail,
            purchasePassword,
            purchaseHint,
            purchaseBookId,
            purchaseLinks,
            bookOptions,
        },
        actions: {
            setSelectedBook,
            setEditForm,
            setCreateForm,
            setBookFile,
            setPublisherId,
            setPurchaseEmail,
            setPurchasePassword,
            setPurchaseHint,
            setPurchaseBookId,
            loadBooks,
            handleUpdateBook,
            handleCreateBook,
            handleGeneratePurchaseLink,
            handleCopyLink,
        },
    };
}
