/**
 * Textos de apresentação da tela pública de revelação de segredo OAuth.
 * Mantém a linguagem de produto separada dos nomes técnicos usados pela API.
 */
export const OAUTH_SECRET_REVEAL_COPY = {
    readyTitle: "Revelar segredo da integração",
    readySubtitle:
        "Este link permite visualizar uma única vez o segredo desta integração. Depois de revelá-lo, copie e guarde o valor em um local seguro.",
    uniqueUseTitle: "Exibição única",
    uniqueUseMessage:
        "Depois que o segredo for revelado, este link não poderá ser utilizado novamente.",
    revealedTitle: "Segredo da integração",
    revealedWarning:
        "Esta é a única vez que este segredo será exibido. Copie-o e armazene-o agora em um local seguro.",
    revealedStorageHint:
        "Guarde-o em um gerenciador de senhas ou cofre de credenciais seguro.",
    missingTokenMessage: "Este link de revelação é inválido.",
    missingTokenDescription:
        "Solicite um novo link ao administrador responsável pela integração.",
    invalidOrUsedMessage:
        "Este link não está mais disponível. Ele pode ter expirado ou já ter sido utilizado. Solicite ao administrador um novo segredo.",
    networkErrorMessage:
        "Não foi possível acessar o servidor. Verifique sua conexão e tente novamente.",
} as const;
