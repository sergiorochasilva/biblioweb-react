import assert from "node:assert/strict";
import test from "node:test";

import * as presentation from "../../src/model/OAuthSecretRevealPresentation.ts";

test("copy da revelação usa linguagem de produto e destaca uso único", () => {
    assert.equal(
        presentation.OAUTH_SECRET_REVEAL_COPY.readyTitle,
        "Revelar segredo da integração"
    );
    assert.equal(
        presentation.OAUTH_SECRET_REVEAL_COPY.uniqueUseTitle,
        "Exibição única"
    );
    assert.match(
        presentation.OAUTH_SECRET_REVEAL_COPY.uniqueUseMessage,
        /não poderá ser utilizado novamente/i
    );
    assert.equal(
        presentation.OAUTH_SECRET_REVEAL_COPY.revealedTitle,
        "Segredo da integração"
    );
});

test("erros públicos evitam jargão de rotação de segredo", () => {
    assert.equal(
        presentation.OAUTH_SECRET_REVEAL_COPY.missingTokenMessage,
        "Este link de revelação é inválido."
    );
    assert.equal(
        presentation.OAUTH_SECRET_REVEAL_COPY.invalidOrUsedMessage,
        "Este link não está mais disponível. Ele pode ter expirado ou já ter sido utilizado. Solicite ao administrador um novo segredo."
    );
    assert.equal(
        presentation.OAUTH_SECRET_REVEAL_COPY.networkErrorMessage,
        "Não foi possível acessar o servidor. Verifique sua conexão e tente novamente."
    );
    assert.equal(
        presentation.OAUTH_SECRET_REVEAL_COPY.invalidOrUsedMessage.includes("rotacion"),
        false
    );
});
