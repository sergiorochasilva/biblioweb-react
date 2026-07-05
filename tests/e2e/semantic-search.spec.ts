import { expect, test } from "@playwright/test";
import {
    API_BASE_URL,
    PUBLISHER_ID,
    buildUniqueBookTitle,
    countSemanticIndexRows,
    deleteBook,
    fetchFirstAuthorId,
    fetchFirstSubjectId,
    loginAsAdminApi,
} from "./support";

const SEMANTIC_FIXTURE_URL =
    "file:///var/www/html/tests/fixtures/semantic-search-book.html";

test.describe.serial("Busca semântica", () => {
    test("front encontra livro por pesquisa semântica e o índice é preenchido no banco", async ({
        page,
        request,
    }) => {
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
                    external_url: SEMANTIC_FIXTURE_URL,
                    external_source: "fixture-e2e",
                    edition: "1",
                    year: "2026",
                    isbn: "9780000000004",
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

            const apiSearchResponsePromise = page.waitForResponse((response) => {
                return (
                    response.request().method() === "POST" &&
                    response.url().endsWith("/books/search-semantic")
                );
            });

            await page.goto(`/search?query=${encodeURIComponent(title)}`);
            await expect(page.locator(".search-loading-grid")).toBeVisible();
            const apiSearchResponse = await apiSearchResponsePromise;
            expect(apiSearchResponse.ok()).toBeTruthy();

            await expect(page.getByRole("heading", { name: "Resultado da pesquisa" })).toBeVisible();
            await expect(page.getByText(title, { exact: true })).toBeVisible();
            await expect(page.locator(".book-card").filter({ hasText: title }).first()).toBeVisible();

            const apiSearchBody = (await apiSearchResponse.json()) as {
                result?: Array<{ id?: string; title?: string }>;
            };
            expect(apiSearchBody.result?.some((item) => item.id === bookId)).toBeTruthy();
        } finally {
            if (bookId) {
                await deleteBook(request, adminToken, bookId);
            }
        }
    });
});
