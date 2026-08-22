import { expect, test } from "@playwright/test";
import {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    createOAuthClientApi,
    deactivateOAuthClientApi,
    loginAsAdminApi,
    loginWithPassword,
    locateListRow,
} from "./support";

test.describe.serial("Auditoria OAuth", () => {
    test("histórico de client mostra criação e edição; aba de auditoria lista eventos", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const clientName = `E2E Auditoria Client ${Date.now()}`;
        const client = await createOAuthClientApi(request, adminToken, { name: clientName });

        try {
            await loginWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
            await page.goto("/admin");
            await page.getByRole("tab", { name: "Clients OAuth" }).click();

            const row = locateListRow(page, clientName);
            await row.getByRole("button", { name: "Histórico" }).click();

            await expect(page.getByText("CLIENT_CREATED")).toBeVisible();

            // O modal de Histórico é renderizado com `footer={null}` (sem botão
            // "Cancel"); fechamos pelo atalho de teclado padrão do antd Modal.
            await page.keyboard.press("Escape");
            await expect(page.getByText("Histórico de alterações")).not.toBeVisible();

            await page.getByRole("tab", { name: "Auditoria" }).click();
            await expect(page.getByText(/CLIENT_CREATED|RESOURCE_ALLOWED/).first()).toBeVisible();
        } finally {
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });
});
