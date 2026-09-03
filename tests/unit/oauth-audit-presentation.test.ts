import assert from "node:assert/strict";
import test from "node:test";

import * as auditPresentation from "../../src/model/OAuthAudit.ts";

const tokenIssuedEvent = {
    event_type: "TOKEN_ISSUED",
    client_id: "client-123",
    user_id: "user-456",
    library_id: 3,
    correlation_id: "correlation-789",
    result: "success",
    reason: null,
    metadata: {
        grant_type: "authorization_code",
        scope: "biblioweb.catalog.read biblioweb.loans.read",
    },
    created_at: "2026-09-02T17:20:00+00:00",
};

test("eventos e resultados de auditoria são apresentados em português", () => {
    assert.equal(typeof auditPresentation.translateOAuthAuditEventType, "function");
    assert.equal(typeof auditPresentation.translateOAuthAuditResult, "function");

    assert.equal(auditPresentation.translateOAuthAuditEventType("CLIENT_SECRET_ROTATED"), "Novo segredo gerado");
    assert.equal(auditPresentation.translateOAuthAuditEventType("RESOURCE_ALLOWED"), "Acesso permitido");
    assert.equal(auditPresentation.translateOAuthAuditResult("success"), "Sucesso");
    assert.equal(auditPresentation.translateOAuthAuditResult("allowed"), "Permitido");
    assert.equal(auditPresentation.translateOAuthAuditResult("denied"), "Negado");
});

test("categorias agrupam eventos para o filtro de auditoria", () => {
    assert.equal(typeof auditPresentation.getOAuthAuditEventCategory, "function");

    assert.equal(auditPresentation.getOAuthAuditEventCategory("CLIENT_CREATED"), "Parceiros");
    assert.equal(auditPresentation.getOAuthAuditEventCategory("TOKEN_ISSUED"), "Autorização e segurança");
    assert.equal(auditPresentation.getOAuthAuditEventCategory("LOAN_CREATED"), "Operações");
});

test("detalhes traduzem metadata útil sem tratar RESOURCE user_id como usuário final", () => {
    assert.equal(typeof auditPresentation.getOAuthAuditEventDetails, "function");

    const details = auditPresentation.getOAuthAuditEventDetails(tokenIssuedEvent);
    assert.deepEqual(details, [
        { key: "user", label: "Usuário", value: "user-456" },
        { key: "library", label: "Biblioteca", value: "3" },
        { key: "grant_type", label: "Tipo de integração", value: "Acesso em nome de um usuário" },
        { key: "scope", label: "Permissões", value: "Consultar catálogo, Consultar empréstimos" },
        { key: "correlation", label: "ID de correlação", value: "correlation-789", copyable: true },
    ]);

    const resourceDetails = auditPresentation.getOAuthAuditEventDetails({
        ...tokenIssuedEvent,
        event_type: "RESOURCE_ALLOWED",
        user_id: "client-123",
        library_id: null,
        metadata: { path: "/me", method: "GET" },
    });

    assert.equal(resourceDetails.some((detail) => detail.label === "Usuário"), false);
    assert.equal(resourceDetails.some((detail) => detail.label === "Rota" && detail.value === "/me"), true);
    assert.equal(resourceDetails.some((detail) => detail.label === "Método" && detail.value === "GET"), true);
});

test("datas de auditoria aceitam timestamps com e sem timezone explícito", () => {
    assert.equal(typeof auditPresentation.formatOAuthAuditDateTime, "function");

    const withOffset = auditPresentation.formatOAuthAuditDateTime("2026-09-02T17:20:00+00:00", "pt-BR");
    const withoutOffset = auditPresentation.formatOAuthAuditDateTime("2026-09-02T17:20:00", "pt-BR");

    assert.notEqual(withOffset, "—");
    assert.notEqual(withoutOffset, "—");
});


test("criação e edição preservam o nome histórico enviado em metadata", () => {
    const details = auditPresentation.getOAuthAuditEventDetails({
        ...tokenIssuedEvent,
        event_type: "CLIENT_UPDATED",
        user_id: null,
        library_id: null,
        correlation_id: "",
        metadata: { name: "OPALS Integration" },
    });

    assert.deepEqual(details, [
        { key: "name", label: "Nome registrado", value: "OPALS Integration" },
    ]);
});
