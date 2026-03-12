# Skill: auth-frontend-flow

## Quando usar
Use esta skill ao alterar login por e-mail/codigo, contexto de autenticacao, ou tela de selecao pos-login.

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
2. `CodeVerificationView`: enviar `POST /login` com e-mail+codigo e salvar `access_token`.
3. Persistir token/profile/publisher/library via `AuthContext`.
4. `SelectionView`: carregar `GET /profile` e aplicar regra:
   - se so houver uma opcao valida, pular tela
   - se houver multiplas, exigir selecao
5. Preservar suporte a `next` na navegacao pos-login.
6. Atualizar JSDoc em funcoes alteradas.

## Validacao minima
- `npm run build`
- Teste manual:
  - login completo
  - comportamento quando profile tem 0, 1 e varias opcoes
  - logout limpando storage

## Criterios de pronto
- Fluxo de autenticacao sem loops de redirecionamento.
- Dados de sessao persistidos e limpos corretamente.
