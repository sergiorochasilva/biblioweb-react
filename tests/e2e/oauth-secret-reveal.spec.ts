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
            page.getByText("Este link de revelação é inválido.")
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

        await expect(page.getByRole("heading", { name: "Revelar segredo da integração" })).toBeVisible();
        await expect(page.getByText("Exibição única")).toBeVisible();
        await expect(
            page.getByText("Depois que o segredo for revelado, este link não poderá ser utilizado novamente.")
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Revelar segredo" })).toBeVisible();
        await page.waitForTimeout(500);
        expect(callCount).toBe(0);
    });

    test("clique em Revelar com sucesso: mostra e permite copiar o segredo retornado", async ({ page }) => {
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.route(REVEAL_ENDPOINT, (route) => {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ client_secret: "test-secret-abc123" }),
            });
        });

        await page.goto(`${REVEAL_PATH}#faketoken123`);
        await page.getByRole("button", { name: "Revelar segredo" }).click();

        await expect(page.getByRole("heading", { name: "Segredo da integração" })).toBeVisible();
        await expect(page.getByText("test-secret-abc123")).toBeVisible();

        const copyButton = page.getByRole("button", { name: "Copiar segredo" });
        await expect(copyButton).toBeVisible();
        await copyButton.click();
        await expect(page.getByText("Segredo copiado.")).toBeVisible();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
            "test-secret-abc123"
        );
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
                "Este link não está mais disponível. Ele pode ter expirado ou já ter sido utilizado. Solicite ao administrador um novo segredo."
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
                "Não foi possível acessar o servidor. Verifique sua conexão e tente novamente."
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
