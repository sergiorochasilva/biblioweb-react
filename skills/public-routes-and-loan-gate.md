# Skill: public-routes-and-loan-gate

## Quando usar
Use esta skill ao alterar rotas, protecao de acesso e fluxo de emprestimo/download.

## Objetivo
Garantir que a app continue majoritariamente publica, protegendo apenas admin e exigindo login apenas na acao de emprestimo.

## Arquivos foco
- `src/App.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/service/BookService.ts`
- `src/service/postLoginAction.ts`
- `src/view/BookDetailsView.tsx` (ou view que dispara emprestimo)
- `src/view/CodeVerificationView.tsx`

## Passos
1. Confirmar que apenas `"/publisher-admin"` esta dentro de `ProtectedRoute`.
2. Manter home/busca/detalhes como rotas publicas.
3. Ao clicar em emprestimo sem token:
   - salvar acao pendente (`bookId`, `libraryId`, `returnTo`)
   - redirecionar para login/validacao
4. Apos login valido:
   - recuperar acao pendente
   - navegar de volta
   - disparar download imediatamente
   - limpar acao pendente
5. Tratar falhas do download com mensagem clara ao usuario.

## Validacao minima
- `npm run build`
- Teste manual:
  - usuario anonimo abre pagina publica normalmente
  - emprestimo anonimo redireciona para login
  - apos login, download inicia sem novo clique
  - rota `/publisher-admin` redireciona anonimo para login

## Criterios de pronto
- Nao ha exigencia indevida de login em rotas publicas.
- Fluxo de emprestimo pos-login funciona ponta a ponta.
