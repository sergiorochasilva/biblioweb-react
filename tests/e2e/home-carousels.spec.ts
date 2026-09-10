import { expect, test, type Page } from "@playwright/test";

/**
 * Localiza o carrossel imediatamente posterior ao título de uma seção da home.
 *
 * @param page Página da home carregada no navegador.
 * @param title Título visível da seção.
 * @returns Locator do carrossel da seção.
 */
function carouselForSection(page: Page, title: string) {
    return page
        .locator(".section-header")
        .filter({ hasText: title })
        .locator("xpath=following-sibling::div[contains(@class, 'carousel-shell')][1]");
}

test("home carrega publicações recentes e mais acessados sem loading persistente", async ({
    page,
}) => {
    let recentCalls = 0;
    let mostAccessedCalls = 0;
    page.on("response", (response) => {
        if (response.request().method() !== "GET" || !response.url().includes("/libraries_books?")) {
            return;
        }

        if (response.url().includes("order=access_count")) {
            mostAccessedCalls += 1;
        } else {
            recentCalls += 1;
        }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const recentCarousel = carouselForSection(page, "Publicações recentes");
    const mostAccessedCarousel = carouselForSection(page, "Mais acessados");

    await expect(recentCarousel.locator(".carousel-loading")).toHaveCount(0);
    await expect(mostAccessedCarousel.locator(".carousel-loading")).toHaveCount(0);
    await expect.poll(() => recentCarousel.locator(".book-card").count()).toBeGreaterThan(0);
    await expect.poll(() => mostAccessedCarousel.locator(".book-card").count()).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    expect(recentCalls).toBeGreaterThan(0);
    expect(mostAccessedCalls).toBeGreaterThan(0);
    expect(recentCalls).toBeLessThanOrEqual(2);
    expect(mostAccessedCalls).toBeLessThanOrEqual(2);
});
