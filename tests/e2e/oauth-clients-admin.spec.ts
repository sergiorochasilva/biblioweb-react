import { expect, test, type Page } from "@playwright/test";
import {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    deactivateOAuthClientApi,
    fillFormField,
    loginAsAdminApi,
    loginWithPassword,
    locateFormField,
    locateListRow,
    selectFirstOptionInField,
} from "./support";

/**
 * Seleciona o status ("Ativos"/"Inativos"/"Todos") do filtro de parceiros.
 *
 * O select usa a lista virtualizada do antd — `role="option"` não é
 * resolvido de forma confiável (mesma razão pela qual os demais selects
 * deste arquivo usam `.ant-select-dropdown`/`.ant-select-item-option` em
 * vez de `getByRole("option", ...)`).
 */
async function selectPartnerStatusFilter(page: Page, status: "Ativos" | "Inativos" | "Todos") {
    await page.getByLabel("Filtrar parceiros por status").click();
    const dropdown = page.locator(".ant-select-dropdown:visible").last();
    await expect(dropdown).toBeVisible();
    await dropdown.getByTitle(status, { exact: true }).click();
}

test.describe.serial("Administração de parceiros OAuth", () => {
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
            await page.getByRole("tab", { name: "Parceiros" }).click();

            await page.getByRole("button", { name: "Cadastrar parceiro" }).click();
            await fillFormField(page, "Nome da integração (*)", clientName);
            await fillFormField(
                page,
                "URLs de retorno (*)",
                "https://partner.example.com/callback"
            );
            await page.getByText("Confirmar sua identidade", { exact: true }).click();
            await page.getByText("Ver seu perfil BiblioWeb", { exact: true }).click();
            await page.getByRole("button", { name: "Criar parceiro" }).click();

            const row = locateListRow(page, clientName);
            await expect(row).toBeVisible();
            await expect(row.getByText(/Novo segredo gerado/)).toBeVisible();

            const clientIdText = await row.getByText(/^ID: /).innerText();
            createdClientId = clientIdText.replace("ID: ", "").trim();

            await page.getByRole("tab", { name: "Editoras" }).click();
            await page.getByRole("tab", { name: "Parceiros" }).click();
            await expect(row.getByText(/Novo segredo gerado/)).not.toBeVisible();

            await row.getByRole("button", { name: /Mais ações para/ }).click();
            await page.getByText("Gerar novo segredo", { exact: true }).click();
            await page
                .getByRole("button", { name: "Gerar novo segredo", exact: true })
                .last()
                .click();
            await expect(row.getByText(/Novo segredo gerado/)).toBeVisible();

            await row.getByRole("button", { name: "Editar" }).click();
            await fillFormField(page, "Nome da integração (*)", `${clientName} editado`);
            await page.getByRole("button", { name: "Salvar alterações" }).click();
            await expect(page.getByText(`${clientName} editado`)).toBeVisible();

            const editedRow = locateListRow(page, `${clientName} editado`);
            await editedRow.getByRole("button", { name: /Mais ações para/ }).click();
            await page.getByText("Desativar parceiro", { exact: true }).click();
            await page
                .getByRole("button", { name: "Desativar", exact: true })
                .last()
                .click();
            await expect(page.getByText(`${clientName} editado`)).not.toBeVisible();

            await selectPartnerStatusFilter(page, "Inativos");
            await expect(page.getByText(`${clientName} editado`)).toBeVisible();
            await expect(editedRow.getByText("Inativo")).toBeVisible();
        } finally {
            if (createdClientId) {
                await deactivateOAuthClientApi(request, adminToken, createdClientId);
            }
        }
    });

    test("admin preenche metadados completos e reativa um client desativado", async ({
        page,
        request,
    }) => {
        const adminToken = await loginAsAdminApi(request);
        const clientName = `E2E OAuth Client Completo ${Date.now()}`;
        let createdClientId: string | null = null;

        try {
            await loginWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
            await page.goto("/admin");
            await page.getByRole("tab", { name: "Parceiros" }).click();

            await page.getByRole("button", { name: "Cadastrar parceiro" }).click();
            await fillFormField(page, "Nome da integração (*)", clientName);
            await fillFormField(
                page,
                "URLs de retorno (*)",
                "https://partner.example.com/callback"
            );
            // O formulário já vem com o escopo "openid" pré-selecionado por padrão
            // (emptyOAuthClientForm em AdminController.ts), então não é necessário
            // clicar nele aqui — clicar de novo apenas o desmarcaria.
            await fillFormField(page, "Descrição", "Integração de teste E2E");
            await fillFormField(page, "Organização responsável", "Parceiro E2E Ltda");
            await selectFirstOptionInField(page, "Bibliotecas autorizadas");
            const selectedLibrary = (
                await locateFormField(page, "Bibliotecas autorizadas")
                    .locator(".ant-select-selection-item")
                    .first()
                    .innerText()
            ).trim();
            await page.getByRole("button", { name: "Criar parceiro" }).click();

            const row = locateListRow(page, clientName);
            await expect(row).toBeVisible();
            await expect(row.getByText("Parceiro E2E Ltda", { exact: true })).toBeVisible();
            await expect(row.getByText("Sem bibliotecas")).toHaveCount(0);

            const clientIdText = await row.getByText(/^ID: /).innerText();
            createdClientId = clientIdText.replace("ID: ", "").trim();

            // Reabre em modo edição para provar que os `library_ids` (number[] na
            // API) sobrevivem à conversão para string[] no estado do formulário.
            await row.getByRole("button", { name: "Editar" }).click();
            await expect(
                locateFormField(page, "Bibliotecas autorizadas")
                    .locator(".ant-select-selection-item")
                    .first()
            ).toHaveText(selectedLibrary);
            await page.getByRole("button", { name: "Cancelar" }).click();

            await row.getByRole("button", { name: /Mais ações para/ }).click();
            await page.getByText("Desativar parceiro", { exact: true }).click();
            await page
                .getByRole("button", { name: "Desativar", exact: true })
                .last()
                .click();
            await expect(page.getByText(clientName)).not.toBeVisible();

            await selectPartnerStatusFilter(page, "Inativos");
            const inactiveRow = locateListRow(page, clientName);
            await expect(inactiveRow.getByText("Inativo")).toBeVisible();

            await inactiveRow.getByRole("button", { name: "Reativar" }).click();
            await page
                .getByRole("button", { name: "Reativar", exact: true })
                .last()
                .click();
            await selectPartnerStatusFilter(page, "Ativos");
            await expect(locateListRow(page, clientName).getByText("Inativo")).not.toBeVisible();
        } finally {
            if (createdClientId) {
                await deactivateOAuthClientApi(request, adminToken, createdClientId);
            }
        }
    });
});
