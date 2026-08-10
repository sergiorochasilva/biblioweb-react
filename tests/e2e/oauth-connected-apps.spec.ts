import { expect, test } from "@playwright/test";
import {
    FRONT_BASE_URL,
    buildOAuthAuthorizeUrl,
    createOAuthClientApi,
    createTestUser,
    deactivateOAuthClientApi,
    deleteUser,
    loginAsAdminApi,
    loginWithPassword,
} from "./support";

const TEST_REDIRECT_URI = `${FRONT_BASE_URL}/oauth-test-callback`;

/**
 * Conecta um app de teste à conta do usuário, aprovando a tela de
 * consentimento uma vez (pré-condição dos testes de apps conectados).
 */
async function connectTestApp(
    page: import("@playwright/test").Page,
    clientId: string
): Promise<void> {
    const authorizeUrl = buildOAuthAuthorizeUrl(
        clientId,
        TEST_REDIRECT_URI,
        "openid biblioweb.profile.read"
    );
    await page.goto(authorizeUrl);
    await Promise.all([
        page.waitForURL(/oauth-test-callback\?/),
        page.getByRole("button", { name: "Permitir" }).click(),
    ]);
}

test.describe.serial("Apps conectados em /profile", () => {
    test("usuário vê o app conectado e consegue desconectar", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid", "biblioweb.profile.read"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);
            await connectTestApp(page, client.id);

            await page.goto("/profile");
            await expect(page.getByText(client.name)).toBeVisible();
            await expect(page.getByText("Ver seu perfil BiblioWeb")).toBeVisible();

            await page.getByRole("button", { name: "Desconectar" }).click();
            const confirmDialog = page.getByRole("dialog");
            await expect(confirmDialog).toBeVisible();
            await confirmDialog.getByRole("button", { name: "Desconectar" }).click();
            await expect(confirmDialog).not.toBeVisible();

            await expect(page.getByText(client.name)).not.toBeVisible();
            await expect(page.getByText("Nenhum app conectado à sua conta.")).toBeVisible();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });

    test("apps conectados não aparecem em /meus-livros", async ({ page, request }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid", "biblioweb.profile.read"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);
            await connectTestApp(page, client.id);

            await page.goto("/meus-livros");
            await expect(page.getByText("Apps conectados")).not.toBeVisible();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });
});
