import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
    API_BASE_URL,
    createTestUser,
    deleteUser,
    loginAsAdminApi,
} from "./support";

test.describe.serial("Multi-acervo", () => {
    test.setTimeout(90_000);

    test("pede a escolha apenas para usuário com dois acervos e troca pelo cabeçalho", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const libraryName = `Acervo E2E ${randomUUID().slice(0, 8)}`;
        const libraryCnpj = `e2e-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
        const createLibraryResponse = await request.post(`${API_BASE_URL}/libraries`, {
            headers: { Authorization: `Bearer ${adminToken}` },
            data: { cnpj: libraryCnpj, nome: libraryName },
        });
        expect(createLibraryResponse.ok()).toBeTruthy();
        const librariesResponse = await request.get(`${API_BASE_URL}/libraries?limit=100`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(librariesResponse.ok()).toBeTruthy();
        const librariesPayload = (await librariesResponse.json()) as { result?: Array<{ id: number; cnpj: string }> } | Array<{ id: number; cnpj: string }>;
        const libraries = Array.isArray(librariesPayload) ? librariesPayload : librariesPayload.result || [];
        const createdLibrary = libraries.find((library) => library.cnpj === libraryCnpj);
        expect(createdLibrary).toBeTruthy();

        const testUser = await createTestUser(request, { libraryIds: [1, createdLibrary!.id] });
        try {
            await page.goto("/login");
            await page.getByLabel("E-mail").fill(testUser.email);
            await page.getByRole("button", { name: "Entrar com senha" }).click();
            await expect(page).toHaveURL(/\/login-password$/);
            await page.getByLabel("Senha").fill(testUser.loginPassword);
            await page.getByRole("button", { name: "Entrar", exact: true }).click();

            await expect(page).toHaveURL(/\/selection/);
            await expect(page.getByRole("heading", { name: "Qual acervo você quer acessar?" })).toBeVisible();
            await expect(page.getByRole("button", { name: `Selecionar acervo ${libraryName}` })).toBeVisible();
            await page.getByRole("button", { name: `Selecionar acervo ${libraryName}` }).click();

            await expect(page).toHaveURL(/\/$/);
            await expect(page.getByLabel("Trocar acervo")).toHaveText(libraryName);
            await page.getByLabel("Trocar acervo").click();
            await expect(page.getByRole("menuitem", { name: "FITREF" })).toBeVisible();
        } finally {
            await deleteUser(request, testUser.adminToken, testUser.user.id);
            await request.delete(`${API_BASE_URL}/libraries/${createdLibrary!.id}`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });
        }
    });

    test("entra diretamente quando o leitor só possui um acervo", async ({ page, request }) => {
        const testUser = await createTestUser(request, { libraryIds: [1] });
        try {
            await page.goto("/login");
            await page.getByLabel("E-mail").fill(testUser.email);
            await page.getByRole("button", { name: "Entrar com senha" }).click();
            await expect(page).toHaveURL(/\/login-password$/);
            await page.getByLabel("Senha").fill(testUser.loginPassword);
            await page.getByRole("button", { name: "Entrar", exact: true }).click();

            await expect(page).toHaveURL(/\/$/);
            await expect(page.getByRole("heading", { name: "Qual acervo você quer acessar?" })).toHaveCount(0);
            await expect(page.getByLabel("Trocar acervo")).toHaveCount(0);
        } finally {
            await deleteUser(request, testUser.adminToken, testUser.user.id);
        }
    });
});
