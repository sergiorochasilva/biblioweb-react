# Skill: auth-frontend-flow

## Quando usar
Use esta skill ao alterar login por e-mail/codigo, contexto de autenticacao, refresh stateless ou tela de selecao pos-login.

## Objetivo
Manter o fluxo de autenticacao consistente, com persistencia de sessao e navegacao previsivel.

## Arquivos foco
- `src/view/LoginView.tsx`
- `src/view/CodeVerificationView.tsx`
- `src/view/SelectionView.tsx`
- `src/contexts/AuthContext.tsx`
- `src/service/api.ts`
- `src/types/index.ts`

## Passos
1. `LoginView`: enviar `POST /login` com e-mail e tratar `202`.
2. `CodeVerificationView`: enviar `POST /token` com `type="code"` + `code` e salvar tokens via `setSessionFromResponse`.
3. `AuthContext`: centralizar `getAccessToken()` com refresh automático via `POST /token` (`type="token"`).
4. Tokens stateless: `access_token` e `refresh_token` são JWTs assinados; expiração vem do payload.
5. Revogacao: tokens com `iat` anterior a `user_account.revoke_tokens_before` devem ser invalidados no backend.
6. Persistir token/profile/publisher/library via `AuthContext`.
7. `SelectionView`: carregar `GET /profile` e aplicar regra:
   - se so houver uma opcao valida, pular tela
   - se houver multiplas, exigir selecao
8. Preservar suporte a `next` na navegacao pos-login.
9. Atualizar JSDoc em funcoes alteradas.

## Validacao minima
- `npm run build`
- Teste manual:
- login completo
- comportamento quando profile tem 0, 1 e varias opcoes
- logout limpando storage
- refresh quando faltarem 30s para expirar
- revogacao total via `revoke_tokens_before`

## Criterios de pronto
- Fluxo de autenticacao sem loops de redirecionamento.
- Dados de sessao persistidos e limpos corretamente.
