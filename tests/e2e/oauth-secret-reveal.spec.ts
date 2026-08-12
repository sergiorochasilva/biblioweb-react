import { expect, test } from "@playwright/test";
import { API_BASE_URL } from "./support";

const REVEAL_PATH = "/oauth-clients/secret-reveal";
// Escopado à origem da API (não "**/oauth-clients/secret-reveal"): o front
// usa exatamente o mesmo path para a própria rota da página, e um glob tão
// amplo intercepta a navegação do page.goto além da chamada de API.
const REVEAL_ENDPOINT = `${API_BASE_URL}/oauth-clients/secret-reveal`;

test.describe("Revelação pública de client_secret OAuth", () => {
    test("sem token na URL: mostra link inválido e nunca chama o endpoint", async ({ page }) => {
        let callCount = 0;
        await page.route(REVEAL_ENDPOINT, (route) => {
            callCount += 1;
            return route.abort("failed");
        });

        await page.goto(REVEAL_PATH);

        await expect(
            page.getByText("Este link não contém um token de revelação válido.")
        ).toBeVisible();
        await page.waitForTimeout(500);
        expect(callCount).toBe(0);
    });

    test("com token, sem clique: nunca chama o endpoint só por carregar a página", async ({
        page,
    }) => {
        let callCount = 0;
        await page.route(REVEAL_ENDPOINT, (route) => {
            callCount += 1;
            expect(
                false,
                "reveal endpoint must not be called before a click"
            ).toBeTruthy();
            return route.abort("failed");
        });

        await page.goto(`${REVEAL_PATH}#faketoken123`);

        await expect(page.getByRole("button", { name: "Revelar segredo" })).toBeVisible();
        await page.waitForTimeout(500);
        expect(callCount).toBe(0);
    });

    test("clique em Revelar com sucesso: mostra o segredo retornado", async ({ page }) => {
        await page.route(REVEAL_ENDPOINT, (route) => {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ client_secret: "test-secret-abc123" }),
            });
        });

        await page.goto(`${REVEAL_PATH}#faketoken123`);
        await page.getByRole("button", { name: "Revelar segredo" }).click();

        await expect(page.getByText("test-secret-abc123")).toBeVisible();
    });

    test("clique em Revelar com 404: mostra mensagem genérica sem vazar o corpo bruto", async ({
        page,
    }) => {
        await page.route(REVEAL_ENDPOINT, (route) => {
            return route.fulfill({
                status: 404,
                contentType: "application/json",
                body: JSON.stringify({ message: "not found" }),
            });
        });

        await page.goto(`${REVEAL_PATH}#faketoken123`);
        await page.getByRole("button", { name: "Revelar segredo" }).click();

        await expect(
            page.getByText(
                "Este link de revelação é inválido, expirou ou já foi usado. Peça ao administrador do BiblioWeb para rotacionar o segredo novamente."
            )
        ).toBeVisible();
        await expect(page.getByText("not found")).toHaveCount(0);
    });

    test("clique em Revelar com falha de rede: mostra mensagem amigável em português e permite tentar novamente", async ({
        page,
    }) => {
        await page.route(REVEAL_ENDPOINT, (route) => route.abort("failed"));

        await page.goto(`${REVEAL_PATH}#faketoken123`);
        await page.getByRole("button", { name: "Revelar segredo" }).click();

        await expect(
            page.getByText(
                "Não foi possível contatar o servidor. Verifique sua conexão e tente novamente. Se o problema persistir, peça ao administrador para rotacionar o segredo."
            )
        ).toBeVisible();
        await expect(page.getByText("Failed to fetch")).toHaveCount(0);

        const retryButton = page.getByRole("button", { name: "Tentar novamente" });
        await expect(retryButton).toBeVisible();

        await page.unroute(REVEAL_ENDPOINT);
        await page.route(REVEAL_ENDPOINT, (route) => {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ client_secret: "retry-secret-xyz789" }),
            });
        });

        await retryButton.click();
        await expect(page.getByRole("button", { name: "Revelar segredo" })).toBeVisible();

        await page.getByRole("button", { name: "Revelar segredo" }).click();
        await expect(page.getByText("retry-secret-xyz789")).toBeVisible();
    });
});
