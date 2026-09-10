import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginWithPassword } from "./support";

test("seleção por cards preserva o destino administrativo solicitado", async ({ page }) => {
    await loginWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/selection?next=%2Fadmin");

    const cards = page.getByRole("button", { name: /selecionar acervo/i });
    await expect(cards.first()).toBeVisible();
    await expect.poll(() => cards.count()).toBeGreaterThan(1);

    await Promise.all([
        page.waitForURL(/\/admin$/),
        cards.first().click(),
    ]);
    await expect(page.getByRole("heading", { name: "Administração do sistema" })).toBeVisible();
});
