import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginWithPassword } from "./support";

const EXTERNAL_BOOK_ID = "9abedcf5-cae0-4cad-bea5-d4f442a6bc8c";
const EXTERNAL_BOOK_URL =
    "https://www.grace-ebooks.com/library/index.php?dir=Alexander%20Maclaren&file=05%20-%20Expositions%20of%20Holy%20Scripture.pdf";
const WEB_VERSION_URL =
    "https://storage.googleapis.com/fronesis_bucket/books_html/Alexander%20Maclaren/05%20-%20Expositions%20of%20Holy%20Scripture.html";

test("Ler agora abre o endereço de um livro externo sem exigir compra", async ({ page }) => {
    await loginWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/ebook/${EXTERNAL_BOOK_ID}`);

    await expect(page.getByText("Externo", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manual completo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ler versão web" })).toBeVisible();

    const accessResponse = page.waitForResponse((response) => {
        return (
            response.request().method() === "POST" &&
            response.url().includes(`/books/${EXTERNAL_BOOK_ID}/access`)
        );
    });
    const popupPromise = page.waitForEvent("popup");
    const externalRequest = page.context().waitForEvent(
        "request",
        (request) => request.url() === EXTERNAL_BOOK_URL
    );

    await page.getByRole("button", { name: "Ler agora" }).click();

    const [popup, response, request] = await Promise.all([
        popupPromise,
        accessResponse,
        externalRequest,
    ]);
    expect(response.ok()).toBeTruthy();
    expect(request.url()).toBe(EXTERNAL_BOOK_URL);
    expect(popup).toBeTruthy();
    await popup.close();
    await expect(page.getByText("Livro ainda não foi comprado por este usuário.")).toHaveCount(0);

    const webAccessResponse = page.waitForResponse((response) => {
        return (
            response.request().method() === "POST" &&
            response.url().includes(`/books/${EXTERNAL_BOOK_ID}/access`)
        );
    });
    const webPopupPromise = page.waitForEvent("popup");
    const webRequest = page.context().waitForEvent(
        "request",
        (request) => request.url() === WEB_VERSION_URL
    );

    await page.getByRole("button", { name: "Ler versão web" }).click();

    const [webPopup, webResponse, requestedWebUrl] = await Promise.all([
        webPopupPromise,
        webAccessResponse,
        webRequest,
    ]);
    expect(webResponse.ok()).toBeTruthy();
    expect(webResponse.request().postDataJSON()).toMatchObject({ action_type: "read_web" });
    expect(requestedWebUrl.url()).toBe(WEB_VERSION_URL);
    await webPopup.close();
});
