import { expect, test } from "@playwright/test";
import {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    deactivateOAuthClientApi,
    fillFormField,
    loginAsAdminApi,
    loginWithPassword,
    locateListRow,
} from "./support";

test.describe.serial("Administração de clients OAuth", () => {
    test("admin cria, edita, rotaciona segredo e desativa um client OAuth", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const clientName = `E2E OAuth Client ${Date.now()}`;
        let createdClientId: string | null = null;

        try {
            await loginWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
            await page.goto("/admin");
            await page.getByRole("tab", { name: "Clients OAuth" }).click();

            await page.getByRole("button", { name: "Novo client" }).click();
            await fillFormField(page, "Nome (*)", clientName);
            await fillFormField(
                page,
                "URIs de redirecionamento (*)",
                "https://partner.example.com/callback"
            );
            await page.getByText("openid — Confirmar sua identidade").click();
            await page.getByText("biblioweb.profile.read — Ver seu perfil BiblioWeb").click();
            await page.getByRole("button", { name: "Salvar" }).click();

            const row = locateListRow(page, clientName);
            await expect(row).toBeVisible();
            await expect(row.getByText(/Link de revelação do segredo/)).toBeVisible();

            const clientIdText = await row.getByText(/^ID: /).innerText();
            createdClientId = clientIdText.replace("ID: ", "").trim();

            await page.getByRole("tab", { name: "Editoras" }).click();
            await page.getByRole("tab", { name: "Clients OAuth" }).click();
            await expect(row.getByText(/Link de revelação do segredo/)).not.toBeVisible();

            await row.getByRole("button", { name: "Rotacionar segredo" }).click();
            await page
                .getByRole("button", { name: "Rotacionar", exact: true })
                .last()
                .click();
            await expect(row.getByText(/Link de revelação do segredo/)).toBeVisible();

            await row.getByRole("button", { name: "Editar" }).click();
            await fillFormField(page, "Nome (*)", `${clientName} editado`);
            await page.getByRole("button", { name: "Salvar" }).click();
            await expect(page.getByText(`${clientName} editado`)).toBeVisible();

            const editedRow = locateListRow(page, `${clientName} editado`);
            await editedRow.getByRole("button", { name: "Desativar" }).click();
            await page
                .getByRole("button", { name: "Desativar", exact: true })
                .last()
                .click();
            await expect(page.getByText(`${clientName} editado`)).not.toBeVisible();

            await page.locator(".users-toolbar").getByRole("switch").click();
            await expect(page.getByText(`${clientName} editado`)).toBeVisible();
            await expect(editedRow.getByText("Inativo")).toBeVisible();
        } finally {
            if (createdClientId) {
                await deactivateOAuthClientApi(request, adminToken, createdClientId);
            }
        }
    });
});
