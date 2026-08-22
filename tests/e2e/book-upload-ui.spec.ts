import { expect, test } from "@playwright/test";
import {
    buildUniqueBookTitle,
    createTestUser,
    deleteBook,
    deleteUser,
    fillFormField,
    locateListRow,
    loginWithPassword,
    selectFirstOptionInField,
    uploadFileInField,
    FIXTURE_PDF_PATH,
} from "./support";

test("publisher admin cadastra livro com upload pela tela", async ({ page, request }) => {
    const created = await createTestUser(request, {
        linkPublisher: true,
        publisherAdmin: true,
    });
    const title = buildUniqueBookTitle();
    let bookId: string | null = null;

    try {
        await loginWithPassword(page, created.email, created.loginPassword);
        await expect(page).toHaveURL(/\/publisher-admin$/);

        await page.getByRole("tab", { name: "Livros" }).click();
        await page.getByRole("button", { name: "Adicionar livro" }).click();
        await expect(page.getByText("Tamanho máximo: 100 MB.")).toBeVisible();

        await fillFormField(page, "Título (*)", title);
        await selectFirstOptionInField(page, "Autores (*)");
        await selectFirstOptionInField(page, "Editora (*)");
        await fillFormField(page, "Edição (*)", "1");
        await selectFirstOptionInField(page, "Assuntos (*)");
        await uploadFileInField(page, "Arquivo (EPUB) (*)", FIXTURE_PDF_PATH);

        const responsePromise = page.waitForResponse((response) => {
            return response.request().method() === "POST" && response.url().endsWith("/books");
        });
        await page.getByRole("button", { name: "Salvar" }).click();
        const response = await responsePromise;

        expect(response.ok()).toBeTruthy();
        const payload = response.request().postDataJSON() as {
            base64_content?: string;
            file_extension?: string;
        };
        expect(payload.base64_content).toBeTruthy();
        expect(payload.file_extension).toBe("pdf");

        const responseBody = (await response.json()) as { id?: string };
        bookId = responseBody.id || null;
        expect(bookId).toBeTruthy();
        await expect(locateListRow(page, title)).toBeVisible();
    } finally {
        if (bookId) {
            await deleteBook(request, created.adminToken, bookId);
        }
        await deleteUser(request, created.adminToken, created.user.id);
    }
});
