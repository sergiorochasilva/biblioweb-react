import { expect, test } from "@playwright/test";
import {
    API_BASE_URL,
    ADMIN_EMAIL,
    PUBLISHER_ID,
    buildUniqueBookTitle,
    countSemanticIndexRows,
    deleteBook,
    fetchFirstAuthorId,
    fetchFirstSubjectId,
    loginAsAdminApi,
    setChatConversationUsage,
    setChatDailyUsageForEmail,
    resetChatUsageForEmail,
} from "./support";

test.describe.serial("Chat bibliotecário", () => {
    test.beforeEach(async () => {
        resetChatUsageForEmail(ADMIN_EMAIL);
    });

    test("mantém o chat abaixo do cabeçalho sem overflow horizontal", async ({ page }) => {
        await page.goto("/bibliotecario");

        const [headerBox, chatBox] = await Promise.all([
            page.locator(".glass-header").boundingBox(),
            page.locator(".bibliotecario-layout").boundingBox(),
        ]);

        expect(headerBox).not.toBeNull();
        expect(chatBox).not.toBeNull();
        expect(chatBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
        const horizontalMargins = await page.evaluate(() => {
            const chatLayout = document.querySelector(".bibliotecario-layout");
            if (!chatLayout) {
                return null;
            }

            const { left, right } = chatLayout.getBoundingClientRect();
            return {
                left,
                right: window.innerWidth - right,
            };
        });
        expect(horizontalMargins).not.toBeNull();
        expect(Math.abs(horizontalMargins!.left - horizontalMargins!.right)).toBeLessThanOrEqual(1);
        await expect(page.locator(".header-center-actions button")).toHaveText([
            "Home",
            "Bibliotecário",
            "Assuntos",
            "Autores",
        ]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("abre pelo header e mostra o estado de análise", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const profileResponse = await request.get(`${API_BASE_URL}/profile`, {
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });
        expect(profileResponse.ok()).toBeTruthy();
        const profile = (await profileResponse.json()) as {
            publishers?: Array<{ id: string; name?: string }>;
            libraries?: Array<{ id: number; name?: string; nome?: string }>;
        };

        await page.addInitScript(
            ({ token, profileData, publisher, library }) => {
                localStorage.setItem("token", token);
                localStorage.setItem("profile", JSON.stringify(profileData));
                if (publisher) {
                    localStorage.setItem("publisher", JSON.stringify(publisher));
                }
                if (library) {
                    localStorage.setItem("library", JSON.stringify(library));
                }
            },
            {
                token: adminToken,
                profileData: profile,
                publisher: profile.publishers?.[0] ?? null,
                library: profile.libraries?.[0] ?? null,
            }
        );
        await page.goto("/");
        await page.getByRole("button", { name: "Bibliotecário", exact: true }).click();

        await expect(page).toHaveURL(/\/bibliotecario$/);
        const chatInput = page.getByPlaceholder("Digite sua pergunta ao bibliotecário...");
        await chatInput.fill("Meus livros");
        await page.getByRole("button", { name: "Enviar" }).click();

        await expect(chatInput).toHaveValue("");
        await expect(page.locator(".chat-loading-panel")).toBeVisible();
        await expect(page.locator(".chat-loading-panel")).toContainText(/Analisando(?: \(.+\))?\.\.\./);
        await expect(page.locator(".chat-response-markdown")).toBeVisible({ timeout: 120_000 });
        await expect(page.locator(".chat-response-markdown")).not.toHaveText("");
    });

    test("mostra mensagem tratada quando a cota diária é atingida", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const profileResponse = await request.get(`${API_BASE_URL}/profile`, {
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });
        expect(profileResponse.ok()).toBeTruthy();
        const profile = (await profileResponse.json()) as {
            publishers?: Array<{ id: string; name?: string }>;
            libraries?: Array<{ id: number; name?: string; nome?: string }>;
        };

        await page.addInitScript(
            ({ token, profileData, publisher, library }) => {
                localStorage.setItem("token", token);
                localStorage.setItem("profile", JSON.stringify(profileData));
                if (publisher) {
                    localStorage.setItem("publisher", JSON.stringify(publisher));
                }
                if (library) {
                    localStorage.setItem("library", JSON.stringify(library));
                }
            },
            {
                token: adminToken,
                profileData: profile,
                publisher: profile.publishers?.[0] ?? null,
                library: profile.libraries?.[0] ?? null,
            }
        );

        await page.goto("/bibliotecario");
        const chatInput = page.getByPlaceholder("Digite sua pergunta ao bibliotecário...");
        await chatInput.fill("Primeira pergunta");
        await page.getByRole("button", { name: "Enviar" }).click();

        await expect(page.locator(".chat-response-markdown")).toBeVisible({ timeout: 120_000 });

        setChatDailyUsageForEmail(ADMIN_EMAIL, 100000);

        await chatInput.fill("Segunda pergunta");
        await page.getByRole("button", { name: "Enviar" }).click();

        await expect(page.locator(".ant-message-notice")).toContainText(
            "Você atingiu o limite diário de uso do bibliotecário."
        );
        await expect(chatInput).toHaveValue("Segunda pergunta");
    });

    test("mostra mensagem tratada quando o limite da conversa é atingido", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const profileResponse = await request.get(`${API_BASE_URL}/profile`, {
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });
        expect(profileResponse.ok()).toBeTruthy();
        const profile = (await profileResponse.json()) as {
            publishers?: Array<{ id: string; name?: string }>;
            libraries?: Array<{ id: number; name?: string; nome?: string }>;
        };

        await page.addInitScript(
            ({ token, profileData, publisher, library }) => {
                localStorage.setItem("token", token);
                localStorage.setItem("profile", JSON.stringify(profileData));
                if (publisher) {
                    localStorage.setItem("publisher", JSON.stringify(publisher));
                }
                if (library) {
                    localStorage.setItem("library", JSON.stringify(library));
                }
            },
            {
                token: adminToken,
                profileData: profile,
                publisher: profile.publishers?.[0] ?? null,
                library: profile.libraries?.[0] ?? null,
            }
        );

        await page.goto("/bibliotecario");
        const chatInput = page.getByPlaceholder("Digite sua pergunta ao bibliotecário...");
        await chatInput.fill("Primeira pergunta");
        await page.getByRole("button", { name: "Enviar" }).click();

        await expect(page.locator(".chat-response-markdown")).toBeVisible({ timeout: 120_000 });

        const conversationsResponse = await request.get(
            `${API_BASE_URL}/chat/conversations?limit=1`,
            {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
            }
        );
        expect(conversationsResponse.ok()).toBeTruthy();
        const conversationsBody = (await conversationsResponse.json()) as {
            result?: Array<{ id?: string }>;
        };
        const conversationId = conversationsBody.result?.[0]?.id || "";
        expect(conversationId).toBeTruthy();

        setChatConversationUsage(conversationId, 20000);

        await chatInput.fill("Outra pergunta");
        await page.getByRole("button", { name: "Enviar" }).click();

        await expect(page.locator(".ant-message-notice")).toContainText(
            "Você atingiu o limite desta conversa."
        );
        await expect(chatInput).toHaveValue("Outra pergunta");
    });

    test("abre pelo atalho da busca e responde sem tool", async ({ page }) => {
        await page.goto("/");
        await page.getByPlaceholder("Procure por: título, autor ou descrição de um livro").fill("Olá");
        await page.getByRole("button", { name: "Pergunte ao bibliotecário" }).click();

        await expect(page).toHaveURL(/\/bibliotecario\?message=/);
        await expect(page.locator(".chat-loading-panel")).toBeVisible();
        const responseText = page.locator(".chat-response-markdown");
        await expect(responseText).toBeVisible({ timeout: 60_000 });
        await expect(responseText).not.toHaveText("");
    });

    test("exige texto antes de abrir o bibliotecário pela busca", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Pergunte ao bibliotecário" }).click();

        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator(".ant-message-notice")).toContainText(
            "Escreva algo antes de perguntar ao bibliotecário."
        );
    });

    test("acesso direto ao bibliotecário inicia conversa nova mesmo após histórico", async ({ page }) => {
        await page.goto("/");
        await page.getByPlaceholder("Procure por: título, autor ou descrição de um livro").fill("Olá");
        await page.getByRole("button", { name: "Pergunte ao bibliotecário" }).click();
        await expect(page.locator(".chat-loading-panel")).toBeVisible();
        await expect(page.locator(".chat-response-markdown")).toBeVisible({ timeout: 120_000 });
        await expect(page.locator(".chat-bubble-user")).toContainText("Olá");

        await page.goto("/");
        await page.getByRole("button", { name: "Bibliotecário", exact: true }).click();

        await expect(page).toHaveURL(/\/bibliotecario$/);
        await expect(page.locator(".chat-empty-state")).toContainText("Digite uma pergunta para começar.");
        await expect(page.locator(".chat-bubble-user")).toHaveCount(0);
    });

    test("atalho da busca sempre abre conversa nova com a primeira mensagem do campo", async ({ page }) => {
        await page.goto("/");
        await page.getByPlaceholder("Procure por: título, autor ou descrição de um livro").fill("Primeira");
        await page.getByRole("button", { name: "Pergunte ao bibliotecário" }).click();
        await expect(page.locator(".chat-response-markdown")).toBeVisible({ timeout: 120_000 });

        await page.goto("/");
        await page.getByPlaceholder("Procure por: título, autor ou descrição de um livro").fill("Segunda");
        await page.getByRole("button", { name: "Pergunte ao bibliotecário" }).click();

        await expect(page).toHaveURL(/\/bibliotecario\?message=Segunda/);
        const userBubbles = page.locator(".chat-bubble-user");
        await expect(userBubbles).toHaveCount(1);
        await expect(userBubbles.first()).toContainText("Segunda");
    });

    test("exibe cards de livros quando a resposta traz sugestões do acervo", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const authorId = await fetchFirstAuthorId(request, adminToken);
        const subjectId = await fetchFirstSubjectId(request, adminToken);
        const title = buildUniqueBookTitle();
        let bookId = "";

        try {
            const createResponse = await request.post(`${API_BASE_URL}/books`, {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
                data: {
                    title,
                    publisher: PUBLISHER_ID,
                    type: "external",
                    external_url: "file:///var/www/html/tests/fixtures/semantic-search-book.html",
                    external_source: "fixture-e2e-chat",
                    edition: "1",
                    year: "2026",
                    isbn: "9780000000005",
                    pages: "100",
                    language: "pt-BR",
                    summary: "Resumo sobre gatos, bibliotecas e busca semântica.",
                    authors: [{ author: Number(authorId) }],
                    subjects: [{ subject: Number(subjectId) }],
                    libraries: [
                        {
                            library: 1,
                            available_licenses: 0,
                            max_uses_per_license: 0,
                            license_uses_count: 0,
                        },
                    ],
                },
            });

            expect(createResponse.ok()).toBeTruthy();
            const createdBody = (await createResponse.json()) as { id?: string };
            bookId = createdBody.id || "";
            expect(bookId).toBeTruthy();

            await expect
                .poll(async () => countSemanticIndexRows(bookId).summary, {
                    timeout: 120_000,
                    intervals: [2_000, 4_000, 8_000],
                })
                .toBeGreaterThan(0);

            await expect
                .poll(async () => countSemanticIndexRows(bookId).chunk, {
                    timeout: 120_000,
                    intervals: [2_000, 4_000, 8_000],
                })
                .toBeGreaterThan(0);

            await page.goto("/bibliotecario");
            const chatInput = page.getByPlaceholder("Digite sua pergunta ao bibliotecário...");
            await chatInput.fill(`Quero livros sobre ${title}`);
            await page.getByRole("button", { name: "Enviar" }).click();

            await expect(page.locator(".chat-response-markdown")).toBeVisible({ timeout: 120_000 });
            const booksBlock = page.locator(".chat-books-block");
            await expect(booksBlock).toBeVisible({ timeout: 120_000 });
            await expect
                .poll(async () => booksBlock.locator(".chat-book-card-wrap").count(), {
                    timeout: 60_000,
                    intervals: [2_000, 4_000, 8_000],
                })
                .toBeGreaterThan(0);
            await expect(booksBlock.locator(".chat-book-card-wrap").filter({ hasText: title }).first()).toBeVisible();
            await expect(booksBlock.getByRole("button", { name: "Abrir" }).first()).toBeVisible();
        } finally {
            if (bookId) {
                await deleteBook(request, adminToken, bookId);
            }
        }
    });
});
