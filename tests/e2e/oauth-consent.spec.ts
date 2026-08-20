import { expect, test } from "@playwright/test";
import {
    FRONT_BASE_URL,
    buildOAuthAuthorizeUrl,
    createOAuthClientApi,
    createTestUser,
    deactivateOAuthClientApi,
    deleteUser,
    getFirstLibraryApi,
    loginAsAdminApi,
    loginWithPassword,
} from "./support";

const TEST_REDIRECT_URI = `${FRONT_BASE_URL}/oauth-test-callback`;

test.describe.serial("Fluxo de consentimento OAuth", () => {
    test("usuário aprova um app parceiro pela primeira vez e é redirecionado com o code", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid", "biblioweb.profile.read"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);

            const authorizeUrl = buildOAuthAuthorizeUrl(
                client.id,
                TEST_REDIRECT_URI,
                "openid biblioweb.profile.read"
            );
            await page.goto(authorizeUrl);

            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);
            await expect(page.getByText(client.name)).toBeVisible();
            await expect(page.getByText("Ver seu perfil BiblioWeb")).toBeVisible();

            await Promise.all([
                page.waitForURL(/oauth-test-callback\?/),
                page.getByRole("button", { name: "Permitir" }).click(),
            ]);

            const finalUrl = new URL(page.url());
            expect(finalUrl.searchParams.get("code")).toBeTruthy();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });

    test("usuário nega um app parceiro e é redirecionado com access_denied", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);

            const authorizeUrl = buildOAuthAuthorizeUrl(client.id, TEST_REDIRECT_URI, "openid");
            await page.goto(authorizeUrl);
            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);

            await Promise.all([
                page.waitForURL(/oauth-test-callback\?/),
                page.getByRole("button", { name: "Negar" }).click(),
            ]);

            const finalUrl = new URL(page.url());
            expect(finalUrl.searchParams.get("error")).toBe("access_denied");
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });

    test("tela de consentimento mostra organização e biblioteca do client", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const library = await getFirstLibraryApi(request, adminToken);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid"],
            organization: "Parceiro E2E Consentimento Ltda",
            library_ids: [library.id],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);

            const authorizeUrl = buildOAuthAuthorizeUrl(client.id, TEST_REDIRECT_URI, "openid");
            await page.goto(authorizeUrl);
            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);

            await expect(
                page.getByText("Organização: Parceiro E2E Consentimento Ltda")
            ).toBeVisible();
            await expect(page.getByText(`Biblioteca: ${library.nome}`)).toBeVisible();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });

    test("segunda autorização com mesmo escopo pula a tela; escopo maior mostra só o delta", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const client = await createOAuthClientApi(request, adminToken, {
            scopes: ["openid", "biblioweb.profile.read", "biblioweb.loans.write"],
        });
        const created = await createTestUser(request);

        try {
            await loginWithPassword(page, created.email, created.loginPassword);

            const firstAuthorizeUrl = buildOAuthAuthorizeUrl(
                client.id,
                TEST_REDIRECT_URI,
                "openid biblioweb.profile.read"
            );
            await page.goto(firstAuthorizeUrl);
            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);
            await Promise.all([
                page.waitForURL(/oauth-test-callback\?/),
                page.getByRole("button", { name: "Permitir" }).click(),
            ]);

            const sameScopeUrl = buildOAuthAuthorizeUrl(
                client.id,
                TEST_REDIRECT_URI,
                "openid biblioweb.profile.read"
            );
            await page.goto(sameScopeUrl);
            await page.waitForURL(/oauth-test-callback\?/);
            const skippedUrl = new URL(page.url());
            expect(skippedUrl.searchParams.get("code")).toBeTruthy();

            const upgradedScopeUrl = buildOAuthAuthorizeUrl(
                client.id,
                TEST_REDIRECT_URI,
                "openid biblioweb.profile.read biblioweb.loans.write"
            );
            await page.goto(upgradedScopeUrl);
            await expect(page).toHaveURL(/\/oauth\/consent\?request_id=/);
            await expect(
                page.getByText("Criar e devolver empréstimos em seu nome")
            ).toBeVisible();
            await expect(page.getByText(/já está conectado/i)).toBeVisible();
        } finally {
            await deleteUser(request, created.adminToken, created.user.id);
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });
});
