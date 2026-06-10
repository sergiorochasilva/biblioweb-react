import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { useAuth } from "../contexts/useAuth";
import {
    BookLibraryForm,
    BOOK_LIBRARY_DEFAULT_POLICY,
    buildBookLibraryForms,
    buildBookLibraryPayloads,
    extractBookLibraryIds,
    syncBookLibrarySelection,
} from "../model/BookLibrary";
import {
    AdminAuthor,
    AdminBook,
    AdminLibrary,
    AdminPublisher,
    AdminSubject,
    AdminUser,
    CreateBookPayload,
    createBook,
    createAuthor,
    createLibrary,
    createPublisher,
    createSubject,
    createUser,
    deleteBook,
    deleteAuthor,
    deleteLibrary,
    deletePublisher,
    deleteSubject,
    deleteUser,
    fetchBookById,
    fetchBookLibraryLinks,
    fetchBooksPage,
    fetchBooksPageByNext,
    fetchAuthors,
    fetchLibraries,
    fetchPublishers,
    fetchSubjects,
    fetchUserById,
    fetchUsers,
    getFileParts,
    readFileAsBase64,
    resolveBookIdByLibraryBookId,
    updateAuthor,
    updateBook,
    updateLibrary,
    updatePublisher,
    updateSubject,
    updateUser,
    updateUserPassword,
} from "../service/AdminService";
import { validateStrongPassword } from "../service/passwordPolicy";

type BookFormState = {
    id?: string;
    title: string;
    subtitle: string;
    original_title: string;
    corporate_author: string;
    publisher: string;
    publication_place: string;
    preco_sugerido: string;
    authors: string[];
    dewey_decimal: string;
    subjects: string[];
    type: string;
    external_url: string;
    external_source: string;
    html_version_url: string;
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
    libraries: BookLibraryForm[];
};

type UserLibraryLimitForm = {
    library: string;
    max_concurrent_loans: string;
};

type UserFormState = {
    id?: string;
    email: string;
    senha: string;
    dica_senha: string;
    admin: boolean;
    library_limits: UserLibraryLimitForm[];
    publishers: string[];
};

type UserPasswordFormState = {
    id?: string;
    email: string;
    senha_acesso: string;
    confirmacao_senha: string;
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

type SubjectFormState = {
    id?: number;
    name: string;
};

type AuthorFormState = {
    id?: number;
    name: string;
};

type AppliedBookFilters = {
    search: string;
    publisher: string;
    library: string;
};

type AdminTabKey =
    | "books"
    | "users"
    | "libraries"
    | "publishers"
    | "subjects"
    | "authors";

type BookFieldErrorKey =
    | "title"
    | "authors"
    | "publisher"
    | "subjects"
    | "file_name"
    | "image_url"
    | "edition"
    | "external_url"
    | "external_source"
    | "libraries"
    | "library_policy"
    | "file";

type UserFieldErrorKey =
    | "email"
    | "senha"
    | "dica_senha"
    | "library_limits";
type UserPasswordFieldErrorKey = "senha_acesso" | "confirmacao_senha";
type LibraryFieldErrorKey = "cnpj" | "nome";
type PublisherFieldErrorKey = "id" | "name";
type SubjectFieldErrorKey = "name";
type AuthorFieldErrorKey = "name";

type ValidationResult<TField extends string> = {
    message: string;
    fieldErrors: Partial<Record<TField, string>>;
};

const ADMIN_BOOKS_PAGE_SIZE = 20;

const emptyBookForm: BookFormState = {
    title: "",
    subtitle: "",
    original_title: "",
    corporate_author: "",
    publisher: "",
    publication_place: "",
    preco_sugerido: "",
    authors: [],
    dewey_decimal: "",
    subjects: [],
    type: "protected",
    external_url: "",
    external_source: "",
    html_version_url: "",
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

const emptyUserForm: UserFormState = {
    email: "",
    senha: "",
    dica_senha: "",
    admin: false,
    library_limits: [],
    publishers: [],
};

const emptyUserPasswordForm: UserPasswordFormState = {
    email: "",
    senha_acesso: "",
    confirmacao_senha: "",
};

const emptyLibraryForm: LibraryFormState = {
    cnpj: "",
    nome: "",
};

const emptyPublisherForm: PublisherFormState = {
    id: "",
    name: "",
};

const emptySubjectForm: SubjectFormState = {
    name: "",
};

const emptyAuthorForm: AuthorFormState = {
    name: "",
};

const emptyFilters: AppliedBookFilters = {
    search: "",
    publisher: "",
    library: "",
};

/**
 * Normaliza os limites por acervo do formulário de usuário.
 *
 * @param limits Limites já selecionados no formulário.
 * @returns Lista sem duplicidades e com valores válidos.
 */
function normalizeUserLibraryLimits(limits: UserLibraryLimitForm[]): UserLibraryLimitForm[] {
    const unique = new Map<string, UserLibraryLimitForm>();

    for (const item of limits) {
        const library = item.library.trim();
        const maxConcurrentLoans = toNullableIntegerField(item.max_concurrent_loans);
        if (!library || maxConcurrentLoans === null || maxConcurrentLoans <= 0) {
            continue;
        }

        unique.set(library, {
            library,
            max_concurrent_loans: String(maxConcurrentLoans),
        });
    }

    return Array.from(unique.values());
}

/**
 * Constrói o formulário de limites por biblioteca a partir do payload do usuário.
 *
 * @param user Usuário retornado pela API.
 * @returns Limites prontos para edição.
 */
function mapUserLibraryLimitsToForm(user: AdminUser): UserLibraryLimitForm[] {
    const rawLimits = Array.isArray(user.library_limits) ? user.library_limits : [];
    const normalizedLimits = rawLimits
        .map((item) => {
            const library = String(item.library || "").trim();
            const maxConcurrentLoans = Number(item.max_concurrent_loans);
            if (!library || !Number.isFinite(maxConcurrentLoans) || maxConcurrentLoans <= 0) {
                return null;
            }

            return {
                library,
                max_concurrent_loans: String(Math.floor(maxConcurrentLoans)),
            };
        })
        .filter((item): item is UserLibraryLimitForm => Boolean(item));

    return normalizeUserLibraryLimits(normalizedLimits);
}

/**
 * Converte dados de livro para o estado de formulário utilizado no modal.
 *
 * @param book Livro bruto vindo da listagem ou do endpoint de detalhe.
 * @param fallbackLibraryIds Bibliotecas padrão quando o livro não tiver vínculo explícito.
 * @returns Estado preenchido para o formulário de livro.
 */
function mapBookToForm(book: AdminBook, fallbackLibraryIds: string[]): BookFormState {
    const rawSubjects = Array.isArray(book.subjects) ? book.subjects : [];
    const rawAuthors = Array.isArray(book.authors) ? book.authors : [];
    const suggestedPrice = typeof book.preco_sugerido === "number" || typeof book.preco_sugerido === "string"
        ? String(book.preco_sugerido)
        : "";
    const libraries = buildBookLibraryForms(
        book.libraries,
        {
            ...BOOK_LIBRARY_DEFAULT_POLICY,
            preco_compra: suggestedPrice,
        },
        fallbackLibraryIds
    );

    return {
        id: book.book_id || book.id,
        title: book.title || "",
        subtitle: book.subtitle || "",
        original_title: book.original_title || "",
        corporate_author: book.corporate_author || "",
        publisher: book.publisher_name || book.publisher || "",
        publication_place: book.publication_place || "",
        preco_sugerido: suggestedPrice,
        authors: rawAuthors
            .map((item) => (item && typeof item.author === "number" ? String(item.author) : ""))
            .filter((item) => Boolean(item)),
        dewey_decimal: book.dewey_decimal || "",
        subjects: rawSubjects
            .map((item) => (item && typeof item.subject === "number" ? String(item.subject) : ""))
            .filter((item) => Boolean(item)),
        type: book.type || "protected",
        external_url: book.external_url || "",
        external_source: book.external_source || "",
        html_version_url: book.html_version_url || "",
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
        libraries,
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

    if (!form.authors || form.authors.length <= 0) {
        fieldErrors.authors = "Selecione ao menos um autor.";
    }

    if (!form.publisher.trim()) {
        fieldErrors.publisher = "Editora obrigatória.";
    }

    if (!form.subjects || form.subjects.length <= 0) {
        fieldErrors.subjects = "Selecione ao menos um assunto.";
    }

    if (!form.libraries || form.libraries.length <= 0) {
        fieldErrors.libraries = "Selecione ao menos um acervo.";
    }

    const invalidLibraryPolicy = form.libraries.some((item) => {
        const availableLicenses = toNullableIntegerField(item.available_licenses);
        const maxUsesPerLicense = toNullableIntegerField(item.max_uses_per_license);
        return (
            availableLicenses === null ||
            availableLicenses < 0 ||
            maxUsesPerLicense === null ||
            maxUsesPerLicense <= 0
        );
    });

    if (invalidLibraryPolicy) {
        fieldErrors.library_policy = "Preencha a política de cada acervo selecionado.";
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

    if (externalType && !form.external_source.trim()) {
        fieldErrors.external_source = "Fonte externa obrigatória.";
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

    const password = form.senha.trim();
    if (mode === "create" && !password) {
        fieldErrors.senha = "Senha de leitura obrigatória no cadastro.";
    } else if (password) {
        const strongPasswordError = validateStrongPassword(password);
        if (strongPasswordError) {
            fieldErrors.senha = strongPasswordError;
        }
    }

    if (form.library_limits.length > 0) {
        const normalizedLibraryLimits = normalizeUserLibraryLimits(form.library_limits);
        if (normalizedLibraryLimits.length !== form.library_limits.length) {
            fieldErrors.library_limits =
                "Preencha um limite válido para cada acervo selecionado.";
        }
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
 * Valida a senha de acesso antes de enviar a troca ao backend.
 *
 * @param form Estado atual do formulário de troca de senha.
 * @returns Estrutura de erro com mensagem/campos inválidos ou ``null``.
 */
function validateUserPasswordForm(
    form: UserPasswordFormState
): ValidationResult<UserPasswordFieldErrorKey> | null {
    const fieldErrors: Partial<Record<UserPasswordFieldErrorKey, string>> = {};

    const senhaAcesso = form.senha_acesso.trim();
    const confirmacao = form.confirmacao_senha.trim();

    if (!senhaAcesso) {
        fieldErrors.senha_acesso = "Nova senha de acesso obrigatória.";
    } else {
        const strongPasswordError = validateStrongPassword(senhaAcesso);
        if (strongPasswordError) {
            fieldErrors.senha_acesso = strongPasswordError;
        }
    }

    if (!confirmacao) {
        fieldErrors.confirmacao_senha = "Confirmação de senha obrigatória.";
    }

    if (senhaAcesso && confirmacao && senhaAcesso !== confirmacao) {
        fieldErrors.confirmacao_senha = "As senhas precisam ser iguais.";
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
 * Valida campos do formulário de assunto.
 *
 * @param form Estado atual do formulário.
 * @returns Estrutura de erro com mensagem/campos inválidos ou ``null``.
 */
function validateSubjectForm(
    form: SubjectFormState
): ValidationResult<SubjectFieldErrorKey> | null {
    const fieldErrors: Partial<Record<SubjectFieldErrorKey, string>> = {};

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
 * Valida campos do formulário de autor.
 *
 * @param form Estado atual do formulário.
 * @returns Estrutura de erro com mensagem/campos inválidos ou ``null``.
 */
function validateAuthorForm(
    form: AuthorFormState
): ValidationResult<AuthorFieldErrorKey> | null {
    const fieldErrors: Partial<Record<AuthorFieldErrorKey, string>> = {};

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
 * Converte texto numérico para inteiro opcional.
 *
 * @param value Texto bruto do campo.
 * @returns Inteiro ou ``null`` quando vazio/inválido.
 */
function toNullableIntegerField(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.trunc(parsed);
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
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
    const [isLoadingAuthors, setIsLoadingAuthors] = useState(false);
    const [isSavingBook, setIsSavingBook] = useState(false);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const [isSavingLibrary, setIsSavingLibrary] = useState(false);
    const [isSavingPublisher, setIsSavingPublisher] = useState(false);
    const [isSavingSubject, setIsSavingSubject] = useState(false);
    const [isSavingAuthor, setIsSavingAuthor] = useState(false);

    const [books, setBooks] = useState<AdminBook[]>([]);
    const [booksNext, setBooksNext] = useState<string | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [libraries, setLibraries] = useState<AdminLibrary[]>([]);
    const [publishers, setPublishers] = useState<AdminPublisher[]>([]);
    const [subjects, setSubjects] = useState<AdminSubject[]>([]);
    const [authors, setAuthors] = useState<AdminAuthor[]>([]);
    const [libraryRows, setLibraryRows] = useState<AdminLibrary[]>([]);
    const [publisherRows, setPublisherRows] = useState<AdminPublisher[]>([]);
    const [subjectRows, setSubjectRows] = useState<AdminSubject[]>([]);
    const [authorRows, setAuthorRows] = useState<AdminAuthor[]>([]);

    const [bookSearch, setBookSearch] = useState("");
    const [publisherFilter, setPublisherFilter] = useState("");
    const [libraryFilter, setLibraryFilter] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [librarySearch, setLibrarySearch] = useState("");
    const [publisherSearch, setPublisherSearch] = useState("");
    const [subjectSearch, setSubjectSearch] = useState("");
    const [authorSearch, setAuthorSearch] = useState("");

    const [activeTab, setActiveTabState] = useState<AdminTabKey>("books");
    const [appliedFilters, setAppliedFilters] = useState<AppliedBookFilters>(emptyFilters);
    const [appliedUserSearch, setAppliedUserSearch] = useState("");
    const [appliedLibrarySearch, setAppliedLibrarySearch] = useState("");
    const [appliedPublisherSearch, setAppliedPublisherSearch] = useState("");
    const [appliedSubjectSearch, setAppliedSubjectSearch] = useState("");
    const [appliedAuthorSearch, setAppliedAuthorSearch] = useState("");

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

    const [userPasswordModalOpen, setUserPasswordModalOpen] = useState(false);
    const [userPasswordForm, setUserPasswordForm] =
        useState<UserPasswordFormState>(emptyUserPasswordForm);
    const [userPasswordModalError, setUserPasswordModalError] = useState("");
    const [userPasswordFormErrors, setUserPasswordFormErrors] =
        useState<Partial<Record<UserPasswordFieldErrorKey, string>>>({});
    const [isSavingUserPassword, setIsSavingUserPassword] = useState(false);

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

    const [subjectModalOpen, setSubjectModalOpen] = useState(false);
    const [subjectModalMode, setSubjectModalMode] = useState<"create" | "edit">("create");
    const [subjectForm, setSubjectForm] = useState<SubjectFormState>(emptySubjectForm);
    const [subjectModalError, setSubjectModalError] = useState("");
    const [subjectFormErrors, setSubjectFormErrors] =
        useState<Partial<Record<SubjectFieldErrorKey, string>>>({});

    const [authorModalOpen, setAuthorModalOpen] = useState(false);
    const [authorModalMode, setAuthorModalMode] = useState<"create" | "edit">("create");
    const [authorForm, setAuthorForm] = useState<AuthorFormState>(emptyAuthorForm);
    const [authorModalError, setAuthorModalError] = useState("");
    const [authorFormErrors, setAuthorFormErrors] =
        useState<Partial<Record<AuthorFieldErrorKey, string>>>({});

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

            const [
                loadedLibraries,
                loadedPublishers,
                loadedSubjects,
                loadedAuthors,
            ] = await Promise.all([
                fetchLibraries(token),
                fetchPublishers(token),
                fetchSubjects(token),
                fetchAuthors(token),
            ]);

            setLibraries(loadedLibraries);
            setPublishers(loadedPublishers);
            setSubjects(loadedSubjects);
            setAuthors(loadedAuthors);
            setLibraryRows(loadedLibraries);
            setPublisherRows(loadedPublishers);
            setSubjectRows(loadedSubjects);
            setAuthorRows(loadedAuthors);

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
     * Carrega assuntos para aba de manutenção.
     *
     * @returns Promise<void>.
     */
    const loadSubjectRows = useCallback(async (): Promise<void> => {
        setIsLoadingSubjects(true);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await fetchSubjects(token, appliedSubjectSearch || undefined);
            setSubjectRows(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar assuntos."));
        } finally {
            setIsLoadingSubjects(false);
        }
    }, [appliedSubjectSearch, getAccessToken]);

    /**
     * Carrega autores para aba de manutenção.
     *
     * @returns Promise<void>.
     */
    const loadAuthorRows = useCallback(async (): Promise<void> => {
        setIsLoadingAuthors(true);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            const result = await fetchAuthors(token, appliedAuthorSearch || undefined);
            setAuthorRows(result);
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao carregar autores."));
        } finally {
            setIsLoadingAuthors(false);
        }
    }, [appliedAuthorSearch, getAccessToken]);

    /**
     * Atualiza a aba ativa de administração.
     *
     * @param tabKey Identificador da aba.
     * @returns void.
     */
    function setActiveTab(tabKey: string): void {
        if (
            tabKey === "users" ||
            tabKey === "libraries" ||
            tabKey === "publishers" ||
            tabKey === "subjects" ||
            tabKey === "authors"
        ) {
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

        if (activeTab === "subjects") {
            await loadReferenceData();
            await loadSubjectRows();
            return;
        }

        if (activeTab === "authors") {
            await loadReferenceData();
            await loadAuthorRows();
            return;
        }

        await loadReferenceData();
        await loadBooks();
    }, [
        activeTab,
        loadBooks,
        loadAuthorRows,
        loadLibraryRows,
        loadPublisherRows,
        loadReferenceData,
        loadSubjectRows,
        loadUsers,
    ]);

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
     * Remove erro de um campo do formulário de troca de senha.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearUserPasswordFieldError(field: UserPasswordFieldErrorKey): void {
        setUserPasswordModalError("");
        setUserPasswordFormErrors((previous) => {
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
     * Remove erro de um campo do formulário de assunto.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearSubjectFieldError(field: SubjectFieldErrorKey): void {
        setSubjectModalError("");
        setSubjectFormErrors((previous) => {
            if (!previous[field]) {
                return previous;
            }
            const next = { ...previous };
            delete next[field];
            return next;
        });
    }

    /**
     * Remove erro de um campo do formulário de autor.
     *
     * @param field Campo a ser limpo.
     * @returns void.
     */
    function clearAuthorFieldError(field: AuthorFieldErrorKey): void {
        setAuthorModalError("");
        setAuthorFormErrors((previous) => {
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

    /**
     * Exibe erro no modal de assuntos e dispara toaster.
     *
     * @param text Mensagem a ser exibida.
     * @param fieldErrors Erros de campos opcionais.
     * @returns void.
     */
    function showSubjectModalError(
        text: string,
        fieldErrors: Partial<Record<SubjectFieldErrorKey, string>> = {}
    ): void {
        setSubjectModalError(text);
        setSubjectFormErrors(fieldErrors);
        message.error(text);
    }

    /**
     * Exibe erro no modal de autores e dispara toaster.
     *
     * @param text Mensagem a ser exibida.
     * @param fieldErrors Erros de campos opcionais.
     * @returns void.
     */
    function showAuthorModalError(
        text: string,
        fieldErrors: Partial<Record<AuthorFieldErrorKey, string>> = {}
    ): void {
        setAuthorModalError(text);
        setAuthorFormErrors(fieldErrors);
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

    useEffect(() => {
        if (!isAuthenticated || activeTab !== "subjects") {
            return;
        }

        void loadSubjectRows();
    }, [activeTab, isAuthenticated, loadSubjectRows]);

    useEffect(() => {
        if (!isAuthenticated || activeTab !== "authors") {
            return;
        }

        void loadAuthorRows();
    }, [activeTab, isAuthenticated, loadAuthorRows]);

    /**
     * Aplica filtros da listagem de livros.
     *
     * @returns void.
     */
    function applyBookFilters(): void {
        const normalizedLibrary = libraryFilter.trim();
        if (!normalizedLibrary) {
            message.error("Selecione um acervo para filtrar os livros.");
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
     * Aplica busca textual da aba de assuntos.
     *
     * @returns void.
     */
    function applySubjectSearch(): void {
        setAppliedSubjectSearch(subjectSearch.trim());
    }

    /**
     * Limpa busca textual da aba de assuntos.
     *
     * @returns void.
     */
    function clearSubjectSearch(): void {
        setSubjectSearch("");
        setAppliedSubjectSearch("");
    }

    /**
     * Aplica busca textual da aba de autores.
     *
     * @returns void.
     */
    function applyAuthorSearch(): void {
        setAppliedAuthorSearch(authorSearch.trim());
    }

    /**
     * Limpa busca textual da aba de autores.
     *
     * @returns void.
     */
    function clearAuthorSearch(): void {
        setAuthorSearch("");
        setAppliedAuthorSearch("");
    }

    /**
     * Abre modal para cadastro de novo livro.
     *
     * @returns void.
     */
    function openCreateBookModal(): void {
        const defaultLibrary = libraryFilter.trim() || (libraries[0] ? String(libraries[0].id) : "");
        if (!defaultLibrary) {
            message.error("Cadastre ao menos um acervo antes de adicionar livros.");
            return;
        }

        setBookModalMode("create");
        setBookForm({
            ...emptyBookForm,
            libraries: buildBookLibraryForms(
                undefined,
                BOOK_LIBRARY_DEFAULT_POLICY,
                [defaultLibrary]
            ),
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

        const fallbackLibraries = Array.isArray(book.libraries) && book.libraries.length > 0
            ? extractBookLibraryIds(
                  buildBookLibraryForms(book.libraries, BOOK_LIBRARY_DEFAULT_POLICY)
              )
            : [];
        if (fallbackLibraries.length <= 0) {
            const fallbackLibrary =
                libraryFilter.trim() || (libraries[0] ? String(libraries[0].id) : "");
            if (fallbackLibrary) {
                fallbackLibraries.push(fallbackLibrary);
            }
        }
        const fallbackForm = mapBookToForm(book, fallbackLibraries);

        const token = await getAccessToken();
        if (!token || !book.id) {
            showBookModalError("Sessão expirada. Faça login novamente.");
            return;
        }

        try {
            const selected = await fetchBookById(token, book.book_id || book.id);
            const resolvedBookId = selected.book_id || selected.id;
            let selectedLibraries = Array.isArray(selected.libraries) ? selected.libraries : [];
            const selectedLibraryId =
                selected.library ?? book.library ?? fallbackLibraries[0] ?? null;
            if (resolvedBookId) {
                try {
                    if (selectedLibraries.length <= 0 && selectedLibraryId !== null) {
                        selectedLibraries = await fetchBookLibraryLinks(
                            token,
                            resolvedBookId,
                            selectedLibraryId
                        );
                    }
                } catch {
                    // Mantém fallback de bibliotecas já conhecidas no DTO principal.
                }
            }

            setBookForm(
                mapBookToForm(
                    {
                        ...selected,
                        libraries: selectedLibraries,
                    },
                    fallbackLibraries
                )
            );
            setBookFile(null);
            setBookModalOpen(true);
        } catch (err) {
            const lookupLibraryId = book.library ?? fallbackLibraries[0] ?? null;
            const resolvedByLibraryBook = await resolveBookIdByLibraryBookId(
                token,
                book.id,
                lookupLibraryId !== null ? lookupLibraryId : 1
            );
            if (resolvedByLibraryBook) {
                try {
                    const selected = await fetchBookById(token, resolvedByLibraryBook);
                    const linkedLibraryId =
                        selected.library ?? book.library ?? fallbackLibraries[0] ?? null;
                    const linkedLibraries =
                        linkedLibraryId !== null
                            ? await fetchBookLibraryLinks(
                                  token,
                                  resolvedByLibraryBook,
                                  linkedLibraryId
                              )
                            : [];
                    setBookForm(
                        mapBookToForm(
                            {
                                ...selected,
                                libraries:
                                    linkedLibraries.length > 0
                                        ? linkedLibraries
                                        : (Array.isArray(selected.libraries) ? selected.libraries : []),
                            },
                            fallbackLibraries
                        )
                    );
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
     * Atualiza a seleção de acervos do formulário de livro.
     *
     * @param values IDs de acervo em formato textual.
     * @returns void.
     */
    function setBookLibrarySelection(values: string[]): void {
        setBookForm((previous) => {
            return {
                ...previous,
                libraries: syncBookLibrarySelection(
                    previous.libraries,
                    values,
                    {
                        ...BOOK_LIBRARY_DEFAULT_POLICY,
                        preco_compra: previous.preco_sugerido,
                    }
                ),
            };
        });
    }

    /**
     * Atualiza diretamente a lista de vínculos do formulário de livro.
     *
     * @param libraries Lista de vínculos já editada.
     * @returns void.
     */
    function setBookLibraries(libraries: BookLibraryForm[]): void {
        setBookForm((previous) => ({
            ...previous,
            libraries,
        }));
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

            const libraryIds = extractBookLibraryIds(bookForm.libraries);
            if (libraryIds.length <= 0) {
                showBookModalError("Selecione ao menos um acervo.", {
                    libraries: "Selecione ao menos um acervo.",
                });
                return;
            }

            const subjectIds = parseBookSubjectIds(bookForm.subjects);
            if (subjectIds.length <= 0) {
                showBookModalError("Selecione ao menos um assunto.", {
                    subjects: "Selecione ao menos um assunto.",
                });
                return;
            }
            const authorIds = parseBookAuthorIds(bookForm.authors);
            if (authorIds.length <= 0) {
                showBookModalError("Selecione ao menos um autor.", {
                    authors: "Selecione ao menos um autor.",
                });
                return;
            }

            const payload = {
                title: toNullableField(bookForm.title),
                subtitle: toNullableField(bookForm.subtitle),
                original_title: toNullableField(bookForm.original_title),
                corporate_author: toNullableField(bookForm.corporate_author),
                publisher: toNullableField(bookForm.publisher),
                publication_place: toNullableField(bookForm.publication_place),
                preco_sugerido: toNullableField(bookForm.preco_sugerido),
                dewey_decimal: toNullableField(bookForm.dewey_decimal),
                type: normalizeBookType(bookForm.type),
                external_url: toNullableField(bookForm.external_url),
                external_source: toNullableField(bookForm.external_source),
                html_version_url: toNullableField(bookForm.html_version_url),
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
                libraries: buildBookLibraryPayloads(bookForm.libraries),
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
                dica_senha: detailed.reading_pass_hint,
                admin: Boolean(detailed.admin),
                library_limits: mapUserLibraryLimitsToForm(detailed),
                publishers: detailed.publishers,
            });
            setUserModalOpen(true);
        } catch (err) {
            setUserForm({
                id: user.id,
                email: user.email,
                senha: "",
                dica_senha: user.reading_pass_hint,
                admin: Boolean(user.admin),
                library_limits: mapUserLibraryLimitsToForm(user),
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
            const userLibraryLimits = normalizeUserLibraryLimits(userForm.library_limits);
            const userPublishers = parseUserPublisherIds(userForm.publishers);

            if (userModalMode === "edit" && userForm.id) {
                await updateUser(token, userForm.id, {
                    email,
                    dica_senha: dicaSenha,
                    admin: userForm.admin,
                    library_limits: userLibraryLimits.map((item) => ({
                        library: Number(item.library),
                        max_concurrent_loans: Number(item.max_concurrent_loans),
                    })),
                    publishers: userPublishers,
                    ...(senha ? { senha } : {}),
                });
            } else {
                await createUser(token, {
                    email,
                    dica_senha: dicaSenha,
                    admin: userForm.admin,
                    senha,
                    library_limits: userLibraryLimits.map((item) => ({
                        library: Number(item.library),
                        max_concurrent_loans: Number(item.max_concurrent_loans),
                    })),
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
     * Abre modal para troca de senha de acesso de um usuário.
     *
     * @param user Usuário selecionado.
     * @returns void.
     */
    function openChangePasswordModal(user: AdminUser): void {
        setUserPasswordForm({
            id: user.id,
            email: user.email,
            senha_acesso: "",
            confirmacao_senha: "",
        });
        setUserPasswordModalError("");
        setUserPasswordFormErrors({});
        setUserPasswordModalOpen(true);
    }

    /**
     * Fecha modal de troca de senha de acesso.
     *
     * @returns void.
     */
    function closeUserPasswordModal(): void {
        setUserPasswordModalOpen(false);
        setUserPasswordModalError("");
        setUserPasswordFormErrors({});
        setUserPasswordForm(emptyUserPasswordForm);
    }

    /**
     * Salva a nova senha de acesso do usuário selecionado.
     *
     * @param event Evento de submit.
     * @returns Promise<void>.
     */
    async function saveUserPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError("");
        setUserPasswordModalError("");
        setUserPasswordFormErrors({});

        const validationError = validateUserPasswordForm(userPasswordForm);
        if (validationError) {
            setUserPasswordModalError(validationError.message);
            setUserPasswordFormErrors(validationError.fieldErrors);
            return;
        }

        if (!userPasswordForm.id) {
            setUserPasswordModalError("Usuário inválido para troca de senha.");
            return;
        }

        setIsSavingUserPassword(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                setUserPasswordModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            await updateUserPassword(token, userPasswordForm.id, {
                senha_acesso: userPasswordForm.senha_acesso.trim(),
            });

            closeUserPasswordModal();
            await loadUsers();
        } catch (err) {
            setUserPasswordModalError(
                normalizeErrorMessage(err, "Erro ao atualizar a senha de acesso.")
            );
        } finally {
            setIsSavingUserPassword(false);
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

    /**
     * Abre modal de criação de assunto.
     *
     * @returns void.
     */
    function openCreateSubjectModal(): void {
        setSubjectModalMode("create");
        setSubjectForm(emptySubjectForm);
        setSubjectModalError("");
        setSubjectFormErrors({});
        setSubjectModalOpen(true);
    }

    /**
     * Abre modal de edição de assunto.
     *
     * @param item Assunto selecionado.
     * @returns void.
     */
    function openEditSubjectModal(item: AdminSubject): void {
        setSubjectModalMode("edit");
        setSubjectForm({
            id: item.id,
            name: item.name,
        });
        setSubjectModalError("");
        setSubjectFormErrors({});
        setSubjectModalOpen(true);
    }

    /**
     * Fecha modal de assunto.
     *
     * @returns void.
     */
    function closeSubjectModal(): void {
        setSubjectModalOpen(false);
        setSubjectModalError("");
        setSubjectFormErrors({});
    }

    /**
     * Persiste formulário de assunto.
     *
     * @param event Evento de submit.
     * @returns Promise<void>.
     */
    async function saveSubject(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSubjectModalError("");
        setSubjectFormErrors({});

        const validationError = validateSubjectForm(subjectForm);
        if (validationError) {
            showSubjectModalError(validationError.message, validationError.fieldErrors);
            return;
        }

        setIsSavingSubject(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                showSubjectModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const payload = {
                name: subjectForm.name.trim(),
            };

            if (subjectModalMode === "edit" && subjectForm.id) {
                await updateSubject(token, subjectForm.id, payload);
            } else {
                await createSubject(token, payload);
            }

            setSubjectModalOpen(false);
            setSubjectForm(emptySubjectForm);
            setSubjectModalError("");
            setSubjectFormErrors({});

            await loadReferenceData();
            await loadSubjectRows();
        } catch (err) {
            showSubjectModalError(normalizeErrorMessage(err, "Erro ao salvar assunto."));
        } finally {
            setIsSavingSubject(false);
        }
    }

    /**
     * Remove um assunto da manutenção.
     *
     * @param subjectId ID do assunto.
     * @returns Promise<void>.
     */
    async function removeSubject(subjectId: number): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deleteSubject(token, subjectId);
            await loadReferenceData();
            await loadSubjectRows();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao remover assunto."));
        }
    }

    /**
     * Abre modal de criação de autor.
     *
     * @returns void.
     */
    function openCreateAuthorModal(): void {
        setAuthorModalMode("create");
        setAuthorForm(emptyAuthorForm);
        setAuthorModalError("");
        setAuthorFormErrors({});
        setAuthorModalOpen(true);
    }

    /**
     * Abre modal de edição de autor.
     *
     * @param item Autor selecionado.
     * @returns void.
     */
    function openEditAuthorModal(item: AdminAuthor): void {
        setAuthorModalMode("edit");
        setAuthorForm({
            id: item.id,
            name: item.name,
        });
        setAuthorModalError("");
        setAuthorFormErrors({});
        setAuthorModalOpen(true);
    }

    /**
     * Fecha modal de autor.
     *
     * @returns void.
     */
    function closeAuthorModal(): void {
        setAuthorModalOpen(false);
        setAuthorModalError("");
        setAuthorFormErrors({});
    }

    /**
     * Persiste formulário de autor.
     *
     * @param event Evento de submit.
     * @returns Promise<void>.
     */
    async function saveAuthor(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setAuthorModalError("");
        setAuthorFormErrors({});

        const validationError = validateAuthorForm(authorForm);
        if (validationError) {
            showAuthorModalError(validationError.message, validationError.fieldErrors);
            return;
        }

        setIsSavingAuthor(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                showAuthorModalError("Sessão expirada. Faça login novamente.");
                return;
            }

            const payload = {
                name: authorForm.name.trim(),
            };

            if (authorModalMode === "edit" && authorForm.id) {
                await updateAuthor(token, authorForm.id, payload);
            } else {
                await createAuthor(token, payload);
            }

            setAuthorModalOpen(false);
            setAuthorForm(emptyAuthorForm);
            setAuthorModalError("");
            setAuthorFormErrors({});

            await loadReferenceData();
            await loadAuthorRows();
        } catch (err) {
            showAuthorModalError(normalizeErrorMessage(err, "Erro ao salvar autor."));
        } finally {
            setIsSavingAuthor(false);
        }
    }

    /**
     * Remove um autor da manutenção.
     *
     * @param authorId ID do autor.
     * @returns Promise<void>.
     */
    async function removeAuthor(authorId: number): Promise<void> {
        setError("");
        try {
            const token = await getAccessToken();
            if (!token) {
                setError("Sessão expirada. Faça login novamente.");
                return;
            }

            await deleteAuthor(token, authorId);
            await loadReferenceData();
            await loadAuthorRows();
        } catch (err) {
            setError(normalizeErrorMessage(err, "Erro ao remover autor."));
        }
    }

    return {
        state: {
            books,
            users,
            libraries,
            publishers,
            subjects,
            authors,
            libraryRows,
            publisherRows,
            subjectRows,
            authorRows,
            hasMoreBooks,
            isLoadingBooks,
            isLoadingMoreBooks,
            isLoadingUsers,
            isLoadingLibraries,
            isLoadingPublishers,
            isLoadingSubjects,
            isLoadingAuthors,
            isSavingBook,
            isSavingUser,
            isSavingLibrary,
            isSavingPublisher,
            isSavingSubject,
            isSavingAuthor,
            bookSearch,
            publisherFilter,
            libraryFilter,
            userSearch,
            librarySearch,
            publisherSearch,
            subjectSearch,
            authorSearch,
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
            userPasswordModalOpen,
            userPasswordForm,
            userPasswordModalError,
            userPasswordFormErrors,
            isSavingUserPassword,
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
            subjectModalOpen,
            subjectModalMode,
            subjectForm,
            subjectModalError,
            subjectFormErrors,
            authorModalOpen,
            authorModalMode,
            authorForm,
            authorModalError,
            authorFormErrors,
        },
        actions: {
            setBookSearch,
            setPublisherFilter,
            setLibraryFilter,
            setUserSearch,
            setLibrarySearch,
            setPublisherSearch,
            setSubjectSearch,
            setAuthorSearch,
            clearBookFieldError,
            clearUserFieldError,
            clearUserPasswordFieldError,
            clearLibraryFieldError,
            clearPublisherFieldError,
            clearSubjectFieldError,
            clearAuthorFieldError,
            setActiveTab,
            applyBookFilters,
            clearBookFilters,
            applyUserSearch,
            clearUserSearch,
            applyLibrarySearch,
            clearLibrarySearch,
            applyPublisherSearch,
            clearPublisherSearch,
            applySubjectSearch,
            clearSubjectSearch,
            applyAuthorSearch,
            clearAuthorSearch,
            loadBooks,
            loadMoreBooks,
            loadUsers,
            loadLibraryRows,
            loadPublisherRows,
            loadSubjectRows,
            loadAuthorRows,
            refreshCurrentTab,
            openCreateBookModal,
            openEditBookModal,
            closeBookModal,
            setBookForm,
            setBookLibrarySelection,
            setBookLibraries,
            setBookFile,
            saveBook,
            removeBook,
            openCreateUserModal,
            openEditUserModal,
            closeUserModal,
            setUserForm,
            saveUser,
            openChangePasswordModal,
            closeUserPasswordModal,
            setUserPasswordForm,
            saveUserPassword,
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
            openCreateSubjectModal,
            openEditSubjectModal,
            closeSubjectModal,
            setSubjectForm,
            saveSubject,
            removeSubject,
            openCreateAuthorModal,
            openEditAuthorModal,
            closeAuthorModal,
            setAuthorForm,
            saveAuthor,
            removeAuthor,
        },
    };
}
