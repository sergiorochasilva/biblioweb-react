import { expect, test, type Page } from "@playwright/test";
import {
    createTestUser,
    deleteUser,
    loginWithPassword,
} from "./support";

const PROTECTED_BOOK_ID = "51aa8b21-6d32-4d35-95c3-576ea83fcdde";

/**
 * Empresta o livro protegido, confirma a atualização imediata e devolve a cópia.
 *
 * @param page Página autenticada na rota que será validada.
 * @returns Promise<void>.
 */
async function assertLoanStateLifecycle(
    page: Page
): Promise<void> {
    const loanResponse = page.waitForResponse((response) => {
        return response.request().method() === "POST" && response.url().endsWith("/books-loan");
    });
    await page.getByRole("button", { name: "Ler agora" }).click();

    const response = await loanResponse;
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/octet-stream");
    await expect(page.getByRole("button", { name: "Baixar novamente" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Devolver" })).toBeVisible();
    await expect(page.getByText(/^Expira em:/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Baixar novamente" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Devolver" })).toBeVisible();

    const returnResponse = page.waitForResponse((response) => {
        return (
            response.request().method() === "POST" &&
            response.url().endsWith(`/books-loan/${PROTECTED_BOOK_ID}/return`)
        );
    });
    await page.getByRole("button", { name: "Devolver" }).click();
    await page
        .getByRole("dialog", { name: "Devolver livro" })
        .getByRole("button", { name: "Devolver", exact: true })
        .click();
    const responseAfterReturn = await returnResponse;
    expect(responseAfterReturn.status()).toBe(204);
    await expect(page.getByRole("button", { name: "Ler agora" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Devolver" })).toHaveCount(0);
}

test("empréstimo protegido atualiza e persiste o estado em ebook e detalhes", async ({
    page,
    request,
}) => {
    const testUser = await createTestUser(request, { withLibraries: true });

    try {
        await loginWithPassword(page, testUser.email, testUser.loginPassword);

        await page.goto(`/ebook/${PROTECTED_BOOK_ID}`);
        await assertLoanStateLifecycle(page);

        await page.goto(`/book/${PROTECTED_BOOK_ID}`);
        await assertLoanStateLifecycle(page);
    } finally {
        await deleteUser(request, testUser.adminToken, testUser.user.id);
    }
});
