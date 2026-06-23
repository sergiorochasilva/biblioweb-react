import { expect, test } from "@playwright/test";
import {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    buildUniqueBookTitle,
    clearSession,
    createPublisher,
    createTestUser,
    deleteBook,
    deletePublisher,
    deleteUser,
    findBookIdByTitle,
    fillFormField,
    fetchFirstAuthorId,
    fetchFirstSubjectId,
    loginWithPassword,
    loginWithCredentialsApi,
    locateListRow,
    selectFirstOptionInField,
    uploadFileInField,
    toggleSwitchInField,
    PUBLISHER_ID,
    SECOND_PUBLISHER_ID,
    FIXTURE_PDF_PATH,
    API_BASE_URL,
} from "./support";

test.describe.serial("Fluxos de administração", () => {
    test("usuário sem biblioteca e sem admin de editora vai direto para o profile", async ({
        page,
        request,
    }) => {
        const created = await createTestUser(request, {
            linkPublisher: false,
            publisherAdmin: false,
        });

        try {
            await loginWithPassword(page, created.email, created.loginPassword);
            await expect(page).toHaveURL(/\/profile$/);
            await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
        }
    });

    test("admin pode marcar publisher admin na tela de usuários e isso libera o publisher-admin", async ({
        page,
        request,
    }) => {
        const created = await createTestUser(request, {
            linkPublisher: true,
            publisherAdmin: false,
        });

        try {
            await loginWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
            await page.goto("/admin");
            await expect(page).toHaveURL(/\/admin$/);

            await page.getByRole("tab", { name: "Usuários" }).click();
            await page.getByPlaceholder("Buscar por e-mail, dica ou ID...").fill(created.email);
            await page.getByRole("button", { name: "Buscar" }).click();

            const row = locateListRow(page, created.email);
            await expect(row).toBeVisible();
            await row.getByRole("button", { name: "Editar" }).click();

            const publisherCard = page
                .locator(".admin-publisher-permission-card")
                .filter({ hasText: "51548758000108" })
                .first();
            await expect(publisherCard).toContainText("Vinculada ao usuário");
            await publisherCard.locator('[role="switch"]').click();
            await page.getByRole("button", { name: "Salvar" }).click();

            await row.getByRole("button", { name: "Editar" }).click();
            const reopenedCard = page
                .locator(".admin-publisher-permission-card")
                .filter({ hasText: "51548758000108" })
                .first();
            await expect(reopenedCard.locator('[role="switch"]')).toHaveAttribute(
                "aria-checked",
                "true"
            );
            await page.getByRole("button", { name: "Cancelar" }).click();

            await clearSession(page);
            await loginWithPassword(page, created.email, created.loginPassword);
            await expect(page).toHaveURL(/\/publisher-admin$/);
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
        }
    });

    test("publisher admin cria, edita, bloqueia e gera link de venda protegido", async ({
        page,
        request,
    }) => {
        const created = await createTestUser(request, {
            linkPublisher: true,
            publisherAdmin: true,
        });
        const buyer = await createTestUser(request, {
            linkPublisher: false,
            publisherAdmin: false,
        });
        const createdTitle = buildUniqueBookTitle();
        const editedTitle = `${createdTitle} - editado`;
        const buyerEmail = buyer.email;
        const buyerPassword = buyer.readingPassword;
        const buyerHint = "Compra de teste";
        const publisherToken = await loginWithCredentialsApi(
            request,
            created.email,
            created.loginPassword
        );
        const authorId = await fetchFirstAuthorId(request, created.adminToken);
        const subjectId = await fetchFirstSubjectId(request, created.adminToken);
        const libraryPayload = [
            {
                library: 1,
                available_licenses: 5,
                max_uses_per_license: 26,
                license_uses_count: 0,
                preco_compra: 9.9,
            },
        ];
        let createdBookId: string | null = null;

        try {
            await test.step("cadastro e edição", async () => {
                await loginWithPassword(page, created.email, created.loginPassword);
                await expect(page).toHaveURL(/\/publisher-admin$/);

                await page.getByRole("tab", { name: "Livros" }).click();
                await page.getByRole("button", { name: "Adicionar livro" }).click();

                await expect(page.locator('input[value="Protegido"]').first()).toBeVisible();
                await fillFormField(page, "Título (*)", createdTitle);
                await selectFirstOptionInField(page, "Autores (*)");
                await selectFirstOptionInField(page, "Editora (*)");
                await fillFormField(page, "Edição (*)", "1");
                await selectFirstOptionInField(page, "Assuntos (*)");
                await uploadFileInField(page, "Arquivo (EPUB) (*)", FIXTURE_PDF_PATH);
                const createResponsePromise = page.waitForResponse((response) => {
                    return response.request().method() === "POST" && response.url().endsWith("/books");
                });
                await page.getByRole("button", { name: "Salvar" }).click();
                const createResponse = await createResponsePromise;
                expect(createResponse.ok()).toBeTruthy();

                await expect(page.getByText(createdTitle, { exact: true })).toBeVisible();
                const createBody = (await createResponse.json()) as { id?: string };
                createdBookId = createBody.id || null;
                expect(createdBookId).toBeTruthy();

                await page.getByPlaceholder("Título, autor, ISBN, edição...").fill(createdTitle);
                await page.getByRole("button", { name: "Buscar" }).click();
                const bookRow = locateListRow(page, createdTitle);
                await expect(bookRow).toBeVisible();
                await bookRow.getByRole("button", { name: "Editar" }).click();

                await fillFormField(page, "Título (*)", editedTitle);
                const updateResponsePromise = page.waitForResponse((response) => {
                    return (
                        response.request().method() === "PUT" &&
                        createdBookId !== null &&
                        response.url().includes(`/books/${encodeURIComponent(createdBookId)}`)
                    );
                });
                await page.getByRole("button", { name: "Salvar" }).click();
                const updateResponse = await updateResponsePromise;
                expect(updateResponse.ok()).toBeTruthy();
                await expect(page.getByText(editedTitle, { exact: true })).toBeVisible();
            });

            await test.step("enriquecimento via api", async () => {
                const updatePayload = {
                    title: editedTitle,
                    subtitle: null,
                    original_title: null,
                    corporate_author: null,
                    publisher: PUBLISHER_ID,
                    publication_place: null,
                    preco_sugerido: null,
                    dewey_decimal: null,
                    type: "protected",
                    external_url: null,
                    external_source: null,
                    html_version_url: null,
                    file_name: "book-sample",
                    image_url: null,
                    edition: "1",
                    year: "2026",
                    isbn: "9780000000002",
                    pages: "100",
                    language: "pt-BR",
                    summary: null,
                    general_note: null,
                    bibliography_note: null,
                    content_type: null,
                    media_type: null,
                    carrier_type: null,
                    active: true,
                    authors: [{ author: Number(authorId) }],
                    subjects: [{ subject: Number(subjectId) }],
                    libraries: libraryPayload,
                };

                const addLibraryResponse = await request.put(
                    `${API_BASE_URL}/books/${encodeURIComponent(createdBookId as string)}`,
                    {
                        headers: {
                            Authorization: `Bearer ${publisherToken}`,
                        },
                        data: updatePayload,
                    }
                );
                expect(addLibraryResponse.ok()).toBeTruthy();
            });

            await test.step("geracao do link", async () => {
                await page.getByRole("tab", { name: "Link de venda" }).click();
                await test.step("gerar url", async () => {
                    const purchaseLinkResponse = await request.post(
                        `${API_BASE_URL}/books-purchase-links`,
                        {
                            headers: {
                                Authorization: `Bearer ${publisherToken}`,
                            },
                            data: {
                                publisher: PUBLISHER_ID,
                                book_id: createdBookId,
                                user_email: buyerEmail,
                                reading_pass_hint: buyerHint,
                                reading_password: buyerPassword,
                            },
                        }
                    );
                    const purchaseLinkBodyText = await purchaseLinkResponse.text();
                    expect(purchaseLinkResponse.status(), purchaseLinkBodyText).toBe(200);
                    const purchaseLinkBody = JSON.parse(purchaseLinkBodyText) as {
                        purchase_link?: string;
                    };
                    const generatedLink = purchaseLinkBody.purchase_link || "";
                    expect(generatedLink).toContain("window=");
                    expect(generatedLink).toContain("token=");

                    await test.step("baixar lcpl", async () => {
                        const purchaseResponse = await page.request.get(generatedLink);
                        expect(purchaseResponse.ok()).toBeTruthy();
                        expect(purchaseResponse.headers()["content-disposition"]).toContain(".lcpl");
                    });
                });
            });

            await test.step("compra do usuario", async () => {
                await clearSession(page);
                await loginWithPassword(page, buyer.email, buyer.loginPassword);
                await expect(page).toHaveURL(/\/profile$/);
                await expect(page.getByText(editedTitle, { exact: true })).toBeVisible();
            });

            await test.step("bloqueio e ocultacao", async () => {
                await clearSession(page);
                await loginWithPassword(page, created.email, created.loginPassword);
                await expect(page).toHaveURL(/\/publisher-admin$/);
                await page.getByRole("tab", { name: "Livros" }).click();
                await page.getByPlaceholder("Título, autor, ISBN, edição...").fill(editedTitle);
                await page.getByRole("button", { name: "Buscar" }).click();
                const editedRow = locateListRow(page, editedTitle);
                await expect(editedRow).toBeVisible();
                await editedRow.getByRole("button", { name: "Editar" }).click();

                await toggleSwitchInField(page, "Livro ativo");
                await page.getByRole("button", { name: "Salvar" }).click();
                await expect(page.getByText("Status: Inativo")).toBeVisible();

                const publicSearch = await page.request.get(
                    `${API_BASE_URL}/libraries_books?library=1&search=${encodeURIComponent(
                        editedTitle
                    )}&fields=title,active&limit=20`
                );
                expect(publicSearch.ok()).toBeTruthy();
                const publicSearchBody = (await publicSearch.json()) as unknown;
                const publicItems = Array.isArray(publicSearchBody)
                    ? publicSearchBody
                    : publicSearchBody && typeof publicSearchBody === "object" && Array.isArray((publicSearchBody as { result?: unknown }).result)
                        ? (publicSearchBody as { result: Array<{ title?: string }> }).result
                        : [];
                const publicTitles = publicItems
                    .map((item) => (item && typeof item === "object" ? (item as { title?: string }).title : undefined))
                    .filter(Boolean);
                expect(publicTitles).not.toContain(editedTitle);
            });
        } finally {
            if (createdBookId) {
                await deleteBook(request, created.adminToken, createdBookId);
            }
            await deleteUser(request, created.adminToken, buyer.user.id);
            await deleteUser(request, created.adminToken, created.user.id);
        }
    });

    test("publisher admin não pode atribuir livro a editora fora do escopo", async ({
        request,
    }) => {
        const created = await createTestUser(request, {
            linkPublisher: true,
            publisherAdmin: true,
        });
        const publisherToken = await loginWithCredentialsApi(
            request,
            created.email,
            created.loginPassword
        );
        const authorId = await fetchFirstAuthorId(request, created.adminToken);
        const subjectId = await fetchFirstSubjectId(request, created.adminToken);

        try {
            await createPublisher(request, created.adminToken, SECOND_PUBLISHER_ID, "Editora fora do escopo");

            const response = await request.post(`${API_BASE_URL}/books`, {
                headers: {
                    Authorization: `Bearer ${publisherToken}`,
                },
                data: {
                    title: buildUniqueBookTitle(),
                    publisher: SECOND_PUBLISHER_ID,
                    edition: "1",
                    year: "2026",
                    isbn: "9780000000003",
                    pages: "100",
                    language: "pt-BR",
                    type: "protected",
                    file_name: "book-sample",
                    base64_content: "AA==",
                    file_extension: "pdf",
                    authors: [{ author: Number(authorId) }],
                    subjects: [{ subject: Number(subjectId) }],
                    active: true,
                },
            });

            expect(response.status()).toBe(403);
        } finally {
            await deletePublisher(request, created.adminToken, SECOND_PUBLISHER_ID);
            await deleteUser(request, created.adminToken, created.user.id);
        }
    });

    test("publisher admin não pode criar nem editar livro externo", async ({ request }) => {
        const created = await createTestUser(request, {
            linkPublisher: true,
            publisherAdmin: true,
        });
        const publisherToken = await loginWithCredentialsApi(
            request,
            created.email,
            created.loginPassword
        );
        const authorId = await fetchFirstAuthorId(request, created.adminToken);
        const subjectId = await fetchFirstSubjectId(request, created.adminToken);
        const createdTitle = buildUniqueBookTitle();

        try {
            const response = await request.post(`${API_BASE_URL}/books`, {
                headers: {
                    Authorization: `Bearer ${publisherToken}`,
                },
                data: {
                    title: createdTitle,
                    publisher: PUBLISHER_ID,
                    edition: "1",
                    year: "2026",
                    isbn: "9780000000004",
                    pages: "100",
                    language: "pt-BR",
                    type: "external",
                    external_url: "https://example.com/livro",
                    external_source: "Externo",
                    authors: [{ author: Number(authorId) }],
                    subjects: [{ subject: Number(subjectId) }],
                    active: true,
                },
            });

            expect(response.status()).toBe(403);
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
        }
    });

    test("publisher admin não pode apagar livro", async ({ page, request }) => {
        const created = await createTestUser(request, {
            linkPublisher: true,
            publisherAdmin: true,
        });
        const publisherToken = await loginWithCredentialsApi(
            request,
            created.email,
            created.loginPassword
        );
        const createdTitle = buildUniqueBookTitle();
        let createdBookId: string | null = null;

        try {
            await loginWithPassword(page, created.email, created.loginPassword);
            await page.getByRole("tab", { name: "Livros" }).click();
            await page.getByRole("button", { name: "Adicionar livro" }).click();
            await fillFormField(page, "Título (*)", createdTitle);
            await selectFirstOptionInField(page, "Autores (*)");
            await selectFirstOptionInField(page, "Editora (*)");
            await fillFormField(page, "Edição (*)", "1");
            await selectFirstOptionInField(page, "Assuntos (*)");
            await uploadFileInField(page, "Arquivo (EPUB) (*)", FIXTURE_PDF_PATH);
            const saveResponsePromise = page.waitForResponse((response) => {
                return response.request().method() === "POST" && response.url().endsWith("/books");
            });
            await page.getByRole("button", { name: "Salvar" }).click();
            const saveResponse = await saveResponsePromise;
            expect(saveResponse.ok()).toBeTruthy();
            await expect(page.getByText(createdTitle, { exact: true })).toBeVisible();

            const saveBody = (await saveResponse.json()) as { id?: string };
            createdBookId = saveBody.id || (await findBookIdByTitle(request, created.adminToken, createdTitle));
            expect(createdBookId).toBeTruthy();

            const deleteResponse = await request.delete(
                `${API_BASE_URL}/books/${encodeURIComponent(createdBookId)}`,
                {
                    headers: {
                        Authorization: `Bearer ${publisherToken}`,
                    },
                }
            );
            expect(deleteResponse.status()).toBe(403);
        } finally {
            if (createdBookId) {
                await deleteBook(request, created.adminToken, createdBookId);
            }
            await deleteUser(request, created.adminToken, created.user.id);
        }
    });
});
