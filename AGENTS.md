# AGENTS.md - biblioweb-react

## 1) Escopo
Este repositorio contem o front-end React do BiblioWeb.
Objetivo: evoluir UI/fluxos sem quebrar contratos com a API.

## 2) Stack e arquitetura
- React + TypeScript + Vite
- Estrutura atual:
  - Views: `src/view`
  - Controllers/hooks: `src/controller`
  - Services HTTP: `src/service`
  - Auth global: `src/contexts/AuthContext.tsx`
  - Rotas: `src/App.tsx`

## 3) Regras obrigatorias de autenticacao e acesso
- Apenas `"/publisher-admin"` deve ser rota protegida.
- Home, busca e detalhes de livro devem funcionar sem login.
- Fluxo de login:
  - `"/login"`: informar e-mail.
  - `"/verify-code"`: informar codigo.
  - `"/selection"`: escolher editora/biblioteca quando houver mais de uma opcao.
- Emprestimo (download licenciado):
  - Se usuario nao autenticado, redirecionar para login.
  - Apos login bem-sucedido, voltar ao contexto e disparar download automaticamente.
- Persistencia:
  - `token`, `profile`, `publisher`, `library` no storage via `AuthContext`.

## 4) Padrao de implementacao
- Toda chamada HTTP deve passar por `src/service/api.ts` (ou service especializado usando esse modulo).
- Evitar fetch direto em view, exceto quando estritamente necessario.
- Regras de fluxo ficam em controller/hook ou service, nao no JSX visual.
- Manter componentes previsiveis e com responsabilidade unica.
- Adicionar JSDoc em funcoes alteradas/criadas (params e retorno).

## 5) Contratos e robustez
- Suportar APIs que retornam lista direta ou `{ result: [...] }` quando aplicavel.
- Tratar erros HTTP com mensagens consistentes ao usuario.
- Nao assumir token para endpoints publicos.
- Nao quebrar navegacao por query param `next` no login.

## 5.1) Padrao visual (telas publicas)
- Este padrao vale para home, busca, detalhes, login e selecao.
- Reutilizar tokens e classes globais em `src/styles/global.css`:
  - tipografia (`Manrope` e `Sora`)
  - paleta e superficies (`--accent`, `--glass-*`, `--text-*`)
- Priorizar `glass-card`/`glass-panel` e estrutura `page-*`/`auth-*`.
- Preservar responsividade existente (`@media (max-width: 720px)`).
- Evitar criar tema paralelo com novas cores/fontes sem necessidade.

## 6) Validacoes locais minimas
- Build:
  - `npm run build`
- Lint (quando alterar TS/JS):
  - `npm run lint`
- Validacao manual de fluxo:
  - acesso anonimo (home/busca/detalhes)
  - login por e-mail+codigo
  - selecao de editora/biblioteca
  - tentativa de emprestimo sem login e retomada pos-login

## 6.1) Skills disponiveis
- `skills/auth-frontend-flow.md`
- `skills/public-routes-and-loan-gate.md`
- `skills/frontend-visual-patterns-public-pages.md`

## 6.2) Evolucao cooperativa de AGENTS e Skills
- O agente pode (e deve) cooperar evoluindo este `AGENTS.md` quando perceber lacunas recorrentes durante as interacoes.
- Sinal forte de lacuna: varias mensagens seguidas do usuario para ajustar a mesma tarefa/fluxo por falta de padrao explicito.
- O agente pode manter skills existentes e criar novas skills em `skills/` quando identificar ganho real para acoes futuras.
- Se uma tarefa exigir inspecao ampla do codigo para descobrir como agir, tratar isso como indicio de falta de instrucao, documentacao ou skill:
  - propor/registrar a lacuna;
  - atualizar `AGENTS.md` e/ou criar/ajustar skill correspondente de forma objetiva.
- Essas evolucoes devem ser incrementais, sem quebrar regras ja estabelecidas neste arquivo.

## 7) Checklist final (obrigatorio)
- [ ] Requisito funcional implementado.
- [ ] Rota `"/publisher-admin"` continua protegida.
- [ ] Rotas publicas continuam acessiveis sem login.
- [ ] Fluxo de emprestimo pos-login funciona ponta a ponta.
- [ ] Contratos de API preservados.
- [ ] JSDoc/comentarios adicionados nos pontos alterados.
- [ ] Build executado com sucesso.
- [ ] Lint executado (quando aplicavel) ou justificativa registrada.
- [ ] Documentacao relevante atualizada (`README`/notas tecnicas).
- [ ] Quando houve descoberta de lacuna de processo, `AGENTS.md`/`skills` foram atualizados.
