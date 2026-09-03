import assert from "node:assert/strict";
import test from "node:test";

import * as presentation from "../../src/model/OAuthPartnerPresentation.ts";

const {
    getOAuthScopeGroup,
    matchesOAuthPartnerSearch,
    translateOAuthGrantType,
    translateOAuthScope,
} = presentation;

const partner = {
    id: "844617ff-69bc-4ba0-b532-20f1c3cd185e",
    name: "OPALS Demo Partner",
    redirect_uris: ["https://partner.example/callback"],
    grant_types: ["authorization_code"],
    scopes: ["openid", "biblioweb.catalog.read", "biblioweb.loans.read"],
    is_confidential: true,
    active: true,
    created_at: null,
    description: "Integração de homologação",
    organization: "OPALS",
    technical_contacts: [{ name: "Ana", email: "ana@opals.example" }],
    expires_at: null,
    library_ids: [1, 2],
};

test("busca de parceiros considera nome, organização, ID e contato técnico", () => {
    assert.equal(matchesOAuthPartnerSearch(partner, "opals"), true);
    assert.equal(matchesOAuthPartnerSearch(partner, "844617ff"), true);
    assert.equal(matchesOAuthPartnerSearch(partner, "ana@opals.example"), true);
    assert.equal(matchesOAuthPartnerSearch(partner, "inexistente"), false);
});

test("escopos recebem rótulos e grupos de produto", () => {
    assert.equal(translateOAuthScope("biblioweb.integration.read"), "Consultar dados da integração");
    assert.equal(getOAuthScopeGroup("openid"), "Identidade");
    assert.equal(getOAuthScopeGroup("biblioweb.catalog.read"), "Catálogo");
    assert.equal(getOAuthScopeGroup("biblioweb.loans.write"), "Empréstimos");
});

test("grant types são apresentados em linguagem administrativa", () => {
    assert.equal(translateOAuthGrantType("authorization_code"), "Acesso em nome de um usuário");
    assert.equal(translateOAuthGrantType("refresh_token"), "Renovação automática da sessão");
    assert.equal(translateOAuthGrantType("client_credentials"), "Integração entre servidores");
});


test("apps conectados agrupam permissões em áreas compreensíveis ao usuário", () => {
    assert.equal(typeof presentation.getOAuthConnectedAppScopeSections, "function");

    const sections = presentation.getOAuthConnectedAppScopeSections([
        "openid",
        "biblioweb.catalog.read",
        "biblioweb.libraries.read",
        "biblioweb.licenses.read",
        "biblioweb.loans.read",
        "biblioweb.loans.write",
        "biblioweb.profile.read",
        "offline_access",
    ]);

    assert.deepEqual(sections, [
        {
            key: "profile",
            label: "Perfil",
            permissions: ["Ver seu perfil BiblioWeb", "Manter a sessão ativa"],
        },
        {
            key: "catalog",
            label: "Catálogo e bibliotecas",
            permissions: ["Consultar catálogo", "Ver bibliotecas disponíveis"],
        },
        {
            key: "loans",
            label: "Empréstimos",
            permissions: [
                "Baixar licenças de empréstimos",
                "Consultar empréstimos",
                "Criar e devolver empréstimos",
            ],
        },
    ]);
});

test("data de autorização de app conectado é apresentada sem horário e segundos", () => {
    assert.equal(typeof presentation.formatOAuthConnectedAppDate, "function");

    const value = presentation.formatOAuthConnectedAppDate("2026-09-02T12:42:01", "pt-BR");
    assert.match(value, /2\s+set\s+2026/i);
    assert.equal(value.includes(":"), false);
});
