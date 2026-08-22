import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import {
    API_BASE_URL,
    FIXTURE_PDF_PATH,
    PUBLISHER_ID,
    buildUniqueBookTitle,
    createTestUser,
    deleteBook,
    deleteUser,
    fetchFirstAuthorId,
    fetchFirstSubjectId,
    loginWithCredentialsApi,
} from "./support";

test("API cadastra um livro com upload pequeno", async ({ request }) => {
    const created = await createTestUser(request, {
        linkPublisher: true,
        publisherAdmin: true,
    });
    const title = buildUniqueBookTitle();
    let bookId: string | null = null;

    try {
        const [publisherToken, authorId, subjectId, file] = await Promise.all([
            loginWithCredentialsApi(request, created.email, created.loginPassword),
            fetchFirstAuthorId(request, created.adminToken),
            fetchFirstSubjectId(request, created.adminToken),
            readFile(FIXTURE_PDF_PATH),
        ]);
        const response = await request.post(`${API_BASE_URL}/books`, {
            headers: {
                Authorization: `Bearer ${publisherToken}`,
            },
            data: {
                title,
                publisher: PUBLISHER_ID,
                type: "protected",
                file_name: "book-sample",
                file_extension: "pdf",
                base64_content: file.toString("base64"),
                edition: "1",
                year: "2026",
                isbn: "9780000000003",
                pages: "1",
                language: "pt-BR",
                active: true,
                authors: [{ author: Number(authorId) }],
                subjects: [{ subject: Number(subjectId) }],
                libraries: [],
            },
        });

        expect(response.ok()).toBeTruthy();
        const responseBody = (await response.json()) as { id?: string };
        bookId = responseBody.id || null;
        expect(bookId).toBeTruthy();
    } finally {
        if (bookId) {
            await deleteBook(request, created.adminToken, bookId);
        }
        await deleteUser(request, created.adminToken, created.user.id);
    }
});
