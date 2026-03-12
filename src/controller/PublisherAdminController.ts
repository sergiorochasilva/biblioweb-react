import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Book } from "../model/Book";
import { useAuth } from "../contexts/AuthContext";
import {
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
 * Hook/controller da tela administrativa da editora.
 *
 * @returns Objeto com estado da tela e ações para CRUD de livros e geração de links.
 */
export function usePublisherAdminController() {
    const { token, publisher, library } = useAuth();
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
        if (token) {
            loadBooks();
        }
    }, [token]);

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
        if (!token) {
            setError("Sessão expirada. Faça login novamente.");
            return;
        }

        setIsLoading(true);
        setError("");
        try {
            const result = await fetchBooks(token);
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
        if (!token) {
            setError("Sessão expirada. Faça login novamente.");
            return;
        }

        setError("");
        try {
            const payload = {
                title: editForm.title,
                publisher: editForm.publisher,
                author: editForm.author,
                subject: editForm.subject,
                file_name: editForm.file_name,
                image_url: editForm.image_url,
                edition: editForm.edition,
                year: editForm.year,
                isbn: editForm.isbn,
                pages: editForm.pages,
                language: editForm.language,
                review: editForm.review,
            };

            await updateBook(token, editForm.id, payload);
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
        if (!bookFile) {
            setError("Selecione o arquivo do livro.");
            return;
        }
        if (!token) {
            setError("Sessão expirada. Faça login novamente.");
            return;
        }

        setError("");
        try {
            const base64Content = await readFileAsBase64(bookFile);
            const { fileName, fileExtension } = getFileParts(bookFile);
            const resolvedLibraryId = createForm.library
                ? Number(createForm.library)
                : library?.id;

            const payload = {
                title: createForm.title,
                publisher: createForm.publisher,
                author: createForm.author,
                subject: createForm.subject,
                file_name: createForm.file_name || fileName,
                edition: createForm.edition,
                year: createForm.year,
                isbn: createForm.isbn,
                pages: createForm.pages,
                language: createForm.language,
                review: createForm.review,
                image_url: createForm.image_url,
                library: resolvedLibraryId,
                base64_content: base64Content,
                file_extension: fileExtension,
            };

            await createBook(token, payload);
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
        if (!token) {
            setError("Sessão expirada. Faça login novamente.");
            return;
        }

        setError("");
        try {
            const passHash = await sha256Hex(purchasePassword);
            const payload = {
                publisher: resolvedPublisherId,
                book_id: purchaseBookId,
                user_email: purchaseEmail,
                pass_hint: purchaseHint,
                pass_hash: passHash,
            };

            const data = await generatePurchaseLink(token, payload);
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
