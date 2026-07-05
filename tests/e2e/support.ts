import path from "node:path";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const API_BASE_URL =
    process.env.PLAYWRIGHT_API_BASE_URL || "http://127.0.0.1:5000";
export const FRONT_BASE_URL =
    process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.2:4173";
export const PUBLISHER_ID = "51548758000108";
export const SECOND_PUBLISHER_ID = "12345678000195";
export const ADMIN_EMAIL = "sergio.confidencial@gmail.com";
export const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "BiblioWeb@Admin123";
export const READ_PASSWORD = "LeituraTeste!123";
export const LOGIN_PASSWORD = "AcessoTeste!123";
export const FIXTURE_PDF_PATH = path.resolve(
    process.cwd(),
    "tests/e2e/fixtures/book-sample.pdf"
);
const POSTGRES_CONTAINER_NAME = process.env.PLAYWRIGHT_POSTGRES_CONTAINER || "";
const POSTGRES_DATABASE_NAME = process.env.PLAYWRIGHT_DB_NAME || "projeto";
const POSTGRES_DATABASE_USER = process.env.PLAYWRIGHT_DB_USER || "projeto";
const POSTGRES_DATABASE_PASSWORD = process.env.PLAYWRIGHT_DB_PASSWORD || "mysecretpassword";

let adminPasswordSync: Promise<void> | null = null;

type CreateUserPayload = {
    email: string;
    senha: string;
    dica_senha: string;
    admin: boolean;
    publishers?: Array<{
        publisher: string;
        admin: boolean;
    }>;
    library_limits?: Array<{
        library: number;
        max_concurrent_loans: number;
    }>;
};

type CreatedUser = {
    id: string;
    email: string;
};

type CreatedBook = {
    id?: string;
    book_id?: string;
    title?: string;
};

function sha256Hex(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function resolvePostgresContainerName(): string {
    const explicitName = POSTGRES_CONTAINER_NAME.trim();
    if (explicitName) {
        return explicitName;
    }

    const dockerPs = execFileSync("docker", ["ps", "--format", "{{.Names}}\t{{.Image}}"], {
        encoding: "utf8",
    });
    const containers = dockerPs
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.split("\t"))
        .filter((parts) => parts.length >= 2);

    const preferred = containers.find(([, image]) => image === "postgres:16.11");
    if (preferred?.[0]) {
        return preferred[0];
    }

    const named = containers.find(([name]) => name.includes("biblioweb-api-test-postgres"));
    if (named?.[0]) {
        return named[0];
    }

    const anyPostgres = containers.find(([, image]) => image.startsWith("postgres:"));
    if (anyPostgres?.[0]) {
        return anyPostgres[0];
    }

    throw new Error("Não foi possível localizar o container postgres do ambiente de e2e.");
}

/**
 * Executa SQL no banco do ambiente local via o container Postgres.
 *
 * @param sql Comando SQL a executar.
 * @returns Saída textual retornada pelo `psql`.
 */
function runPostgresSql(sql: string): string {
    const containerName = resolvePostgresContainerName();
    return execFileSync(
        "docker",
        [
            "exec",
            "-e",
            `PGPASSWORD=${POSTGRES_DATABASE_PASSWORD}`,
            containerName,
            "psql",
            "-U",
            POSTGRES_DATABASE_USER,
            "-d",
            POSTGRES_DATABASE_NAME,
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
        ],
        { encoding: "utf8" }
    );
}

/**
 * Executa SQL escalar no banco e devolve o valor bruto.
 *
 * @param sql Comando SQL que retorna uma única linha/coluna.
 * @returns Saída textual sem espaços nas bordas.
 */
function runPostgresScalar(sql: string): string {
    const containerName = resolvePostgresContainerName();
    return execFileSync(
        "docker",
        [
            "exec",
            "-e",
            `PGPASSWORD=${POSTGRES_DATABASE_PASSWORD}`,
            containerName,
            "psql",
            "-U",
            POSTGRES_DATABASE_USER,
            "-d",
            POSTGRES_DATABASE_NAME,
            "-t",
            "-A",
            "-c",
            sql,
        ],
        { encoding: "utf8" }
    ).trim();
}

/**
 * Sincroniza a senha do admin seed no banco do ambiente local.
 *
 * @returns Promise que conclui quando o hash do admin seed estiver atualizado.
 */
async function ensureSeedAdminPassword(): Promise<void> {
    if (!adminPasswordSync) {
        adminPasswordSync = (async () => {
            const passwordHash = sha256Hex(ADMIN_PASSWORD);
            const updateSql = [
                "update user_account",
                `set login_pass_hash = '${passwordHash}'`,
                `where email = '${ADMIN_EMAIL}';`,
            ].join(" ");

            runPostgresSql(updateSql);
        })();
    }

    try {
        await adminPasswordSync;
    } catch (error) {
        adminPasswordSync = null;
        throw error;
    }
}

/**
 * Remove o usuário de teste diretamente no banco quando o endpoint da API
 * encontra dependências pendentes.
 *
 * @param userId Identificador do usuário a remover.
 * @returns Promise que conclui quando o usuário e vínculos forem removidos.
 */
async function forceDeleteUserFromDatabase(userId: string): Promise<void> {
    const cleanupSql = [
        "begin;",
        `delete from user_publisher where user_id = '${userId}';`,
        `delete from user_library where user_id = '${userId}';`,
        `delete from library_license_binding where user_id = '${userId}';`,
        `delete from log_book_access where user_id = '${userId}';`,
        `delete from log_license_expiration where user_id = '${userId}';`,
        `delete from user_account where id = '${userId}';`,
        "commit;",
    ].join(" ");

    runPostgresSql(cleanupSql);
}

/**
 * Remove um livro de teste e os vínculos gerados localmente pelo fluxo de compra.
 *
 * @param bookId Identificador do livro a remover.
 * @returns Promise que conclui quando as tabelas relacionadas forem limpas.
 */
async function forceDeleteBookFromDatabase(bookId: string): Promise<void> {
    const cleanupSql = [
        "begin;",
        `delete from book_embedding_chunk where book_id = '${bookId}';`,
        `delete from book_embedding_summary where book_id = '${bookId}';`,
        `delete from book_purchase_order where book_id = '${bookId}';`,
        `delete from library_license_binding where book_id = '${bookId}';`,
        `delete from log_license_expiration where book_id = '${bookId}';`,
        `delete from log_book_access where book_id = '${bookId}';`,
        `delete from book_author where book = '${bookId}';`,
        `delete from book_subject where book = '${bookId}';`,
        `delete from event where license_status_fk in (select ls.id from license_status ls join license l on l.id = ls.license_ref where l.content_fk = '${bookId}');`,
        `delete from license_status where license_ref in (select id from license where content_fk = '${bookId}');`,
        `delete from license where content_fk = '${bookId}';`,
        `delete from content where id = '${bookId}';`,
        `delete from book where id = '${bookId}';`,
        "commit;",
    ].join(" ");

    runPostgresSql(cleanupSql);
}

/**
 * Conta os registros dos índices semânticos associados ao livro.
 *
 * @param bookId Identificador do livro.
 * @returns Quantidade de linhas em resumo e conteúdo.
 */
export function countSemanticIndexRows(bookId: string): { summary: number; chunk: number } {
    const summary = Number(
        runPostgresScalar(
            `select count(*) from book_embedding_summary where book_id = '${bookId}';`
        ) || "0"
    );
    const chunk = Number(
        runPostgresScalar(`select count(*) from book_embedding_chunk where book_id = '${bookId}';`) ||
            "0"
    );
    return { summary, chunk };
}

/**
 * Faz login administrativo direto via API.
 *
 * @param request Contexto de requests do Playwright.
 * @returns Access token do usuário administrador global.
 */
export async function loginAsAdminApi(request: APIRequestContext): Promise<string> {
    await ensureSeedAdminPassword();
    const response = await request.post(`${API_BASE_URL}/token`, {
        data: {
            type: "credentials",
            credentials: {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
            },
        },
    });

    if (!response.ok()) {
        throw new Error(
            `Falha ao autenticar admin seed: HTTP ${response.status()} - ${await response.text()}`
        );
    }
    const body = (await response.json()) as { access_token?: string };
    expect(body.access_token).toBeTruthy();
    return body.access_token!;
}

/**
 * Faz login por credenciais diretamente via API.
 *
 * @param request Contexto de requests do Playwright.
 * @param email E-mail do usuário.
 * @param password Senha de acesso.
 * @returns Access token retornado pelo backend.
 */
export async function loginWithCredentialsApi(
    request: APIRequestContext,
    email: string,
    password: string
): Promise<string> {
    const response = await request.post(`${API_BASE_URL}/token`, {
        data: {
            type: "credentials",
            credentials: {
                email,
                password,
            },
        },
    });

    if (!response.ok()) {
        throw new Error(`Falha ao autenticar ${email}: HTTP ${response.status()} - ${await response.text()}`);
    }

    const body = (await response.json()) as { access_token?: string };
    expect(body.access_token).toBeTruthy();
    return body.access_token!;
}

/**
 * Cria uma editora de teste via API.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param id Identificador da editora.
 * @param name Nome legível da editora.
 * @returns void
 */
export async function createPublisher(
    request: APIRequestContext,
    token: string,
    id: string,
    name: string
): Promise<void> {
    const response = await request.post(`${API_BASE_URL}/publishers`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        data: {
            id,
            name,
        },
    });

    expect(response.ok()).toBeTruthy();
}

async function fetchFirstIdFromCollection(
    request: APIRequestContext,
    token: string,
    path: string
): Promise<string> {
    const response = await request.get(`${API_BASE_URL}${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as unknown;
    const result = Array.isArray(body)
        ? body
        : body && typeof body === "object" && Array.isArray((body as { result?: unknown }).result)
            ? (body as { result: unknown[] }).result
            : [];
    const first = result.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
    const id = first?.id;
    if (typeof id === "string" && id.trim()) {
        return id.trim();
    }
    if (typeof id === "number" && Number.isFinite(id)) {
        return String(id);
    }

    throw new Error(`Não foi possível localizar um registro válido em ${path}.`);
}

/**
 * Obtém o primeiro autor disponível para testes.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso.
 * @returns Identificador do primeiro autor.
 */
export async function fetchFirstAuthorId(
    request: APIRequestContext,
    token: string
): Promise<string> {
    return fetchFirstIdFromCollection(request, token, "/authors?limit=1");
}

/**
 * Obtém o primeiro assunto disponível para testes.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso.
 * @returns Identificador do primeiro assunto.
 */
export async function fetchFirstSubjectId(
    request: APIRequestContext,
    token: string
): Promise<string> {
    return fetchFirstIdFromCollection(request, token, "/subjects?limit=1");
}

/**
 * Remove uma editora criada para o teste.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param publisherId Identificador da editora.
 * @returns void
 */
export async function deletePublisher(
    request: APIRequestContext,
    token: string,
    publisherId: string
): Promise<void> {
    const response = await request.delete(`${API_BASE_URL}/publishers/${encodeURIComponent(publisherId)}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    expect([204, 404]).toContain(response.status());
}

/**
 * Cria usuário por API usando o token do admin global.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param payload Payload de criação do usuário.
 * @returns Registro criado pela API.
 */
export async function createUser(
    request: APIRequestContext,
    token: string,
    payload: CreateUserPayload
): Promise<CreatedUser> {
    const response = await request.post(`${API_BASE_URL}/users`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        data: payload,
    });

    expect(response.ok()).toBeTruthy();
    return (await response.json()) as CreatedUser;
}

/**
 * Atualiza a senha de login do usuário via API.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param userId Identificador do usuário.
 * @param password Nova senha de acesso.
 * @returns void
 */
export async function setLoginPassword(
    request: APIRequestContext,
    token: string,
    userId: string,
    password: string
): Promise<void> {
    const response = await request.patch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        data: {
            senha_acesso: password,
        },
    });

    expect(response.ok()).toBeTruthy();
}

/**
 * Cria um usuário de teste com ou sem vínculo de editora.
 *
 * @param request Contexto de requests do Playwright.
 * @param options Opções de criação.
 * @returns Dados do usuário e credenciais de acesso.
 */
export async function createTestUser(
    request: APIRequestContext,
    options: {
        publisherAdmin?: boolean;
        linkPublisher?: boolean;
        withLibraries?: boolean;
    } = {}
): Promise<{
    adminToken: string;
    user: CreatedUser;
    email: string;
    readingPassword: string;
    loginPassword: string;
}> {
    const adminToken = await loginAsAdminApi(request);
    const email = `aaa-e2e-${randomUUID()}@example.com`;
    const readingPassword = READ_PASSWORD;
    const loginPassword = LOGIN_PASSWORD;

    const payload: CreateUserPayload = {
        email,
        senha: readingPassword,
        dica_senha: "Teste E2E",
        admin: false,
    };

    if (options.linkPublisher) {
        payload.publishers = [
            {
                publisher: PUBLISHER_ID,
                admin: Boolean(options.publisherAdmin),
            },
        ];
    }

    if (options.withLibraries) {
        payload.library_limits = [{ library: 1, max_concurrent_loans: 3 }];
    }

    const user = await createUser(request, adminToken, payload);
    await setLoginPassword(request, adminToken, user.id, loginPassword);

    return {
        adminToken,
        user,
        email,
        readingPassword,
        loginPassword,
    };
}

/**
 * Remove um usuário criado para o teste.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param userId Identificador do usuário.
 * @returns void
 */
export async function deleteUser(
    request: APIRequestContext,
    token: string,
    userId: string
): Promise<void> {
    const response = await request.delete(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if ([204, 404].includes(response.status())) {
        return;
    }

    await forceDeleteUserFromDatabase(userId);

    const retry = await request.delete(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    expect([204, 404]).toContain(retry.status());
}

/**
 * Remove um livro criado para o teste.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param bookId Identificador do livro.
 * @returns void
 */
export async function deleteBook(
    request: APIRequestContext,
    token: string,
    bookId: string
): Promise<void> {
    const response = await request.delete(`${API_BASE_URL}/books/${encodeURIComponent(bookId)}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if ([204, 404].includes(response.status())) {
        return;
    }

    await forceDeleteBookFromDatabase(bookId);

    const retry = await request.delete(`${API_BASE_URL}/books/${encodeURIComponent(bookId)}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    expect([204, 404]).toContain(retry.status());
}

/**
 * Faz login por credenciais na interface do front.
 *
 * @param page Página do navegador.
 * @param email E-mail do usuário.
 * @param password Senha de login.
 * @returns void
 */
export async function loginWithPassword(
    page: Page,
    email: string,
    password: string
): Promise<void> {
    await page.goto("/login");
    await page.getByPlaceholder("seu@email.com").fill(email);
    await Promise.all([
        page.waitForURL(/\/login-password(\?.*)?$/),
        page.getByRole("button", { name: "Entrar com senha" }).click(),
    ]);
    await page.getByPlaceholder("Digite sua senha").fill(password);
    await Promise.all([
        page.waitForURL(/\/(profile|publisher-admin|selection|admin)(\?.*)?$/),
        page.getByRole("button", { name: "Entrar" }).click(),
    ]);
}

/**
 * Limpa estado de sessão do navegador.
 *
 * @param page Página do navegador.
 * @returns void
 */
export async function clearSession(page: Page): Promise<void> {
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
}

/**
 * Localiza um bloco de formulário pelo texto do label.
 *
 * @param page Página do navegador.
 * @param labelText Texto do label que identifica o campo.
 * @param rootSelector Seletor base opcional para restringir a busca.
 * @returns Locator do bloco de formulário.
 */
export function locateFormField(
    page: Page,
    labelText: string,
    rootSelector = ".admin-form"
): Locator {
    return page
        .locator(`${rootSelector} .form-field, ${rootSelector} .form-field-full`)
        .filter({ hasText: labelText })
        .first();
}

/**
 * Preenche um campo de texto ou textarea localizado pelo label.
 *
 * @param page Página do navegador.
 * @param labelText Texto do label que identifica o campo.
 * @param value Valor a preencher.
 * @param rootSelector Seletor base opcional para restringir a busca.
 * @returns void
 */
export async function fillFormField(
    page: Page,
    labelText: string,
    value: string,
    rootSelector = ".admin-form"
): Promise<void> {
    const field = locateFormField(page, labelText, rootSelector);
    const input = field.locator('input:not([type="hidden"]), textarea').first();
    await input.fill(value);
}

/**
 * Envia arquivo para um campo Upload localizado pelo label.
 *
 * @param page Página do navegador.
 * @param labelText Texto do label que identifica o campo.
 * @param filePath Caminho absoluto do arquivo a enviar.
 * @param rootSelector Seletor base opcional para restringir a busca.
 * @returns void
 */
export async function uploadFileInField(
    page: Page,
    labelText: string,
    filePath: string,
    rootSelector = ".admin-form"
): Promise<void> {
    const field = locateFormField(page, labelText, rootSelector);
    await field.locator('input[type="file"]').setInputFiles(filePath);
}

/**
 * Seleciona a primeira opção disponível em um campo Select.
 *
 * @param page Página do navegador.
 * @param labelText Texto do label que identifica o campo.
 * @param rootSelector Seletor base opcional para restringir a busca.
 * @returns void
 */
export async function selectFirstOptionInField(
    page: Page,
    labelText: string,
    rootSelector = ".admin-form"
): Promise<void> {
    const field = locateFormField(page, labelText, rootSelector);
    const adminSelectTrigger = field.locator(".admin-select").first();
    const selectorTrigger = field.locator(".ant-select-selector").first();
    const comboboxTrigger = field.locator('[role="combobox"]').first();
    const trigger =
        (await adminSelectTrigger.count()) > 0
            ? adminSelectTrigger
            : (await selectorTrigger.count()) > 0
              ? selectorTrigger
              : comboboxTrigger;
    await expect(trigger).toBeVisible();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click({ force: true });
    const dropdown = page.locator(".ant-select-dropdown:visible").last();
    await expect(dropdown).toBeVisible();
    const firstOption = dropdown
        .locator(".ant-select-item-option:not(.ant-select-item-option-disabled)")
        .first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();
    await page.keyboard.press("Escape");
    await expect(dropdown).toBeHidden();
}

/**
 * Seleciona uma opção específica em um campo Select.
 *
 * @param page Página do navegador.
 * @param labelText Texto do label que identifica o campo.
 * @param optionText Texto exato da opção.
 * @param rootSelector Seletor base opcional para restringir a busca.
 * @returns void
 */
export async function selectOptionInField(
    page: Page,
    labelText: string,
    optionText: string,
    rootSelector = ".admin-form"
): Promise<void> {
    const field = locateFormField(page, labelText, rootSelector);
    const adminSelectTrigger = field.locator(".admin-select").first();
    const selectorTrigger = field.locator(".ant-select-selector").first();
    const comboboxTrigger = field.locator('[role="combobox"]').first();
    const trigger =
        (await adminSelectTrigger.count()) > 0
            ? adminSelectTrigger
            : (await selectorTrigger.count()) > 0
              ? selectorTrigger
              : comboboxTrigger;
    await expect(trigger).toBeVisible();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click({ force: true });
    const dropdown = page.locator(".ant-select-dropdown:visible").last();
    await expect(dropdown).toBeVisible();
    const searchInput = field.locator("input.ant-select-selection-search-input").last();
    if ((await searchInput.count()) > 0) {
        await searchInput.fill(optionText);
        const option = dropdown.getByRole("option", { name: optionText }).first();
        await option.click({ force: true });
    } else {
        await page.keyboard.type(optionText);
        const option = dropdown.getByRole("option", { name: optionText }).first();
        await option.click({ force: true });
    }
    await page.keyboard.press("Escape");
    await expect(dropdown).toBeHidden();
}

/**
 * Alterna um switch identificado pelo label textual.
 *
 * @param page Página do navegador.
 * @param labelText Label visual do switch.
 * @param rootSelector Seletor base opcional.
 * @returns void
 */
export async function toggleSwitchInField(
    page: Page,
    labelText: string,
    rootSelector = ".admin-form"
): Promise<void> {
    const field = page
        .locator(`${rootSelector} .switch-field`)
        .filter({ hasText: labelText })
        .first();
    await field.locator('[role="switch"]').click();
}

/**
 * Busca a linha de listagem correspondente a um texto.
 *
 * @param page Página do navegador.
 * @param text Texto de busca.
 * @returns Locator da linha de listagem.
 */
export function locateListRow(page: Page, text: string): Locator {
    return page.locator(".admin-list-item").filter({ hasText: text }).first();
}

/**
 * Busca um livro cadastrado pela API utilizando o título.
 *
 * @param request Contexto de requests do Playwright.
 * @param token Token de acesso do administrador global.
 * @param title Título do livro.
 * @returns Identificador do livro ou null.
 */
export async function findBookIdByTitle(
    request: APIRequestContext,
    token: string,
    title: string
): Promise<string | null> {
    const attempts = [
        {
            method: "post" as const,
            url: `${API_BASE_URL}/books/search-semantic`,
            data: {
                query: title,
                library: 1,
                limit: 20,
            },
        },
        `${API_BASE_URL}/books?limit=200`,
    ];

    for (const url of attempts) {
        const response =
            typeof url === "string"
                ? await request.get(url, {
                      headers: {
                          Authorization: `Bearer ${token}`,
                      },
                  })
                : await request.post(url.url, {
                      headers: {
                          Authorization: `Bearer ${token}`,
                      },
                      data: url.data,
                  });

        expect(response.ok()).toBeTruthy();
        const body = (await response.json()) as unknown;
        const result = Array.isArray(body)
            ? body
            : body && typeof body === "object" && Array.isArray((body as { result?: unknown }).result)
                ? (body as { result: unknown[] }).result
                : [];

        const match = result.find((item) => {
            if (!item || typeof item !== "object") {
                return false;
            }
            const raw = item as CreatedBook;
            const resolvedTitle = typeof raw.title === "string" ? raw.title.trim() : "";
            return resolvedTitle === title;
        }) as CreatedBook | undefined;

        const matchId =
            (typeof match?.id === "string" && match.id) ||
            (typeof match?.book_id === "string" && match.book_id) ||
            null;

        if (matchId) {
            return matchId;
        }
    }

    return null;
}

/**
 * Gera um nome de livro único para os testes e2e.
 *
 * @returns Nome único.
 */
export function buildUniqueBookTitle(): string {
    return `Livro E2E ${randomUUID()}`;
}
