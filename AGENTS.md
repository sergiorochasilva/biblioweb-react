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
- `"/publisher-admin"` e `"/admin"` devem ser rotas protegidas.
- Home, busca e detalhes de livro devem funcionar sem login.
- Fluxo de login:
  - `"/login"`: informar e-mail.
  - `"/login-password"`: informar senha após capturar o e-mail na etapa anterior.
  - `"/verify-code"`: informar codigo.
  - `"/selection"`: escolher editora/biblioteca quando houver mais de uma opcao.
- `POST /token` deve aceitar `type: "credentials"` com `credentials.email` e `credentials.password` para login direto por senha, preservando `next` e o retorno ao contexto apos autenticação.
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

## 6.1) Validacao integrada e Playwright
- Quando a mudanca tocar login, selecao, admin de editoras, perfil, CRUD de livro, links de venda ou download licenciado, prefira validar com a stack real:
  - front rodando de verdade;
  - API rodando de verdade;
  - PostgreSQL rodando de verdade.
- Em cenarios de integracao/e2e, nao use `localhost` como pressuposto do front se ele estiver dentro de container; a URL da API deve vir de uma variavel de ambiente ou do hostname alcancavel na rede Docker.
- Para Playwright local, prefira abrir o front em um host que nao seja `localhost` nem `127.0.0.1` (por exemplo, `127.0.0.2`), porque `src/service/api.ts` cai em `http://localhost:15000` nesses hostnames.
- Ao rodar e2e, configure `VITE_API_BASE_URL` para a URL real da API no Docker e suba o Vite com `--host 0.0.0.0`.
- Playwright deve abrir o browser real e percorrer o fluxo real; nao mocke auth, rota ou download quando o objetivo for validar contrato.
- Sequencia minima recomendada quando houver teste ponta a ponta:
  - subir `postgres` e `app` pelo `docker compose` da API;
  - iniciar o front com a URL da API apontando para essa stack;
  - executar a suite do navegador contra o front em execucao.
- Coberturas que valem como baseline:
  - acesso anonimo a home, busca e detalhe;
  - login por e-mail + codigo;
  - login por credenciais;
  - selecao quando houver mais de um contexto;
  - landing sem biblioteca;
  - CRUD de publisher-admin;
  - geracao e teste de URL de venda.
- Se a suite e2e for adicionada, prefira um script dedicado como `npm run test:e2e`, separado de `build` e `lint`.

## 6.2) Skills disponiveis
- `skills/auth-frontend-flow.md`
- `skills/public-routes-and-loan-gate.md`
- `skills/frontend-visual-patterns-public-pages.md`

## 6.3) Evolucao cooperativa de AGENTS e Skills
- O agente pode (e deve) cooperar evoluindo este `AGENTS.md` quando perceber lacunas recorrentes durante as interacoes.
- Sinal forte de lacuna: varias mensagens seguidas do usuario para ajustar a mesma tarefa/fluxo por falta de padrao explicito.
- O agente pode manter skills existentes e criar novas skills em `skills/` quando identificar ganho real para acoes futuras.
- Se uma tarefa exigir inspecao ampla do codigo para descobrir como agir, tratar isso como indicio de falta de instrucao, documentacao ou skill:
  - propor/registrar a lacuna;
  - atualizar `AGENTS.md` e/ou criar/ajustar skill correspondente de forma objetiva.
- Essas evolucoes devem ser incrementais, sem quebrar regras ja estabelecidas neste arquivo.

## 7) Checklist final (obrigatorio)
- [ ] Requisito funcional implementado.
- [ ] Rotas `"/publisher-admin"` e `"/admin"` continuam protegidas.
- [ ] Rotas publicas continuam acessiveis sem login.
- [ ] Fluxo de emprestimo pos-login funciona ponta a ponta.
- [ ] Contratos de API preservados.
- [ ] JSDoc/comentarios adicionados nos pontos alterados.
- [ ] Build executado com sucesso.
- [ ] Lint executado (quando aplicavel) ou justificativa registrada.
- [ ] Documentacao relevante atualizada (`README`/notas tecnicas).
- [ ] Quando houve descoberta de lacuna de processo, `AGENTS.md`/`skills` foram atualizados.
- [ ] Varrida final em `agent-learnings.md` executada; entradas nao consolidadas com mais de 14 dias foram expurgadas, e as ainda uteis foram consolidadas.

## Memoria operacional do agente
Use `agent-learnings.md` como base de memoria incremental do repositorio.

Registrar quando houver:
- decisao tecnica nova recorrente;
- divergencia relevante entre documentacao e implementacao;
- descoberta de padrao/caminho que reduza retrabalho;
- preferencia explicita do usuario que deve virar padrao.

Formato minimo por entrada em `agent-learnings.md`:
- Data (`YYYY-MM-DD`)
- Contexto (task/feature)
- Descoberta
- Evidencias (arquivos/caminhos)
- Acao aplicada
- Impacto esperado

## Regra de consolidacao e higiene de recorrencia
Quando a mesma orientacao se repetir em tarefas similares:
- promover para `AGENTS.md` quando for regra geral do repositorio;
- criar/atualizar skill em `skills/` quando for fluxo especializado.

Ao final de todo processo/tarefa, executar uma varrida completa em `agent-learnings.md`:
- remover entradas que nao sao mais necessarias;
- expurgar entradas com mais de 14 dias que ainda nao foram consolidadas em `AGENTS.md` ou em alguma skill;
- quando uma entrada antiga ainda for util, consolidar antes (em `AGENTS.md`/skill) e depois reduzir/remover do registro operacional.
