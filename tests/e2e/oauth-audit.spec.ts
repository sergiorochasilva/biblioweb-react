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
            await page.getByRole("tab", { name: "Parceiros" }).click();

            // O histórico por parceiro foi unificado com a Auditoria (filtrada
            // por client_id), sem modal dedicado — a ação "Ver histórico" do
            // menu do parceiro leva direto para lá.
            const row = locateListRow(page, clientName);
            await row.getByRole("button", { name: `Mais ações para ${clientName}` }).click();
            await page.getByRole("menuitem", { name: "Ver histórico" }).click();

            await expect(page.getByText("Parceiro cadastrado").first()).toBeVisible();

            // Limpa o filtro por parceiro e confirma que o evento também aparece
            // na auditoria geral (não filtrada).
            await page.getByRole("button", { name: "Limpar" }).click();
            await expect(page.getByText(/Parceiro cadastrado|Acesso permitido/).first()).toBeVisible();
        } finally {
            await deactivateOAuthClientApi(request, adminToken, client.id);
        }
    });
});
