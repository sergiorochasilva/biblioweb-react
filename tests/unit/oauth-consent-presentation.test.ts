import assert from "node:assert/strict";
import test from "node:test";

import * as presentation from "../../src/model/OAuthConsentPresentation.ts";

test("consentimento agrupa permissões e destaca ações feitas em nome do usuário", () => {
    assert.equal(typeof presentation.getOAuthConsentScopeSections, "function");

    const sections = presentation.getOAuthConsentScopeSections([
        "openid",
        "biblioweb.profile.read",
        "offline_access",
        "biblioweb.catalog.read",
        "biblioweb.libraries.read",
        "biblioweb.loans.read",
        "biblioweb.loans.write",
        "biblioweb.licenses.read",
    ]);

    assert.deepEqual(sections, [
        {
            key: "profile",
            label: "Perfil",
            permissions: [
                { scope: "biblioweb.profile.read", label: "Ver seu perfil BiblioWeb", kind: "read" },
                { scope: "offline_access", label: "Manter sua sessão ativa", kind: "read" },
            ],
        },
        {
            key: "catalog",
            label: "Catálogo e bibliotecas",
            permissions: [
                { scope: "biblioweb.catalog.read", label: "Consultar catálogo", kind: "read" },
                { scope: "biblioweb.libraries.read", label: "Ver bibliotecas disponíveis", kind: "read" },
            ],
        },
        {
            key: "loans",
            label: "Empréstimos",
            permissions: [
                { scope: "biblioweb.loans.read", label: "Consultar seus empréstimos", kind: "read" },
                {
                    scope: "biblioweb.loans.write",
                    label: "Criar e devolver empréstimos em seu nome",
                    kind: "action",
                },
                {
                    scope: "biblioweb.licenses.read",
                    label: "Baixar licenças dos seus empréstimos",
                    kind: "action",
                },
            ],
        },
    ]);
});

test("contexto de bibliotecas usa nomes quando poucos e contagem quando muitos", () => {
    assert.deepEqual(
        presentation.getOAuthConsentLibrariesPresentation([{ id: 1, name: "FITREF" }]),
        { label: "Acesso limitado a", value: "FITREF" }
    );

    assert.deepEqual(
        presentation.getOAuthConsentLibrariesPresentation(
            Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `Biblioteca ${index + 1}` }))
        ),
        { label: "Acesso limitado às bibliotecas", value: "6 bibliotecas autorizadas" }
    );
});

test("copy diferencia primeira autorização de ampliação de acesso", () => {
    assert.deepEqual(presentation.getOAuthConsentHeading("OPALS Demo Partner", false), {
        title: "Autorizar aplicativo",
        appName: "OPALS Demo Partner",
        description: "quer acessar sua conta BiblioWeb",
    });

    assert.deepEqual(presentation.getOAuthConsentHeading("OPALS Demo Partner", true), {
        title: "OPALS Demo Partner quer ampliar o acesso",
        appName: "OPALS Demo Partner",
        description: "O aplicativo já está conectado à sua conta e está solicitando novas permissões.",
    });

    assert.equal(presentation.OAUTH_CONSENT_COPY.denyAction, "Não permitir");
    assert.equal(presentation.OAUTH_CONSENT_COPY.approveAction, "Permitir acesso");
    assert.match(presentation.OAUTH_CONSENT_COPY.revocationHint, /Meu perfil.*Apps conectados/i);
});
