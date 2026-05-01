# Biblioweb - React

## Deploy em producao

O deploy de producao é feito via `biblioweb-infra` (Ansible).
O servidor faz `git clone` deste repositorio usando uma deploy key.
Consulte `biblioweb-infra/README.md` para o setup completo.

Fluxo esperado:

1. Suba as alterações no `main`.
2. Execute o deploy no `biblioweb-infra`.

## Autenticacao e refresh (stateless)

O front-end mantém `access_token`, `refresh_token` e expiração no `localStorage`.
Quando faltam 30 segundos (ou menos) para o token expirar, o app chama `POST /token`
com `{ "type": "token", "refresh_token": "<refresh_token>" }` para renovar a sessão.
O backend retorna novos tokens e expirações. Os refresh tokens são JWTs assinados
no servidor (stateless).

O envio do código de login continua em `POST /login` (apenas `email`).
A troca do código por tokens ocorre em `POST /token` com
`{ "type": "code", "code": "<login_code>" }`.
O acesso por senha segue pelo front em `"/login-password"` e troca as credenciais
por token em `POST /token` com
`{ "type": "credentials", "credentials": { "email": "<email>", "password": "<senha>" } }`.

### Revogacao total

Para invalidar todos os tokens de um usuário, atualize a coluna
`user_account.revoke_tokens_before`:

```sql
update user_account set revoke_tokens_before = now() where id = <user_id>;
```

## Painel administrativo global

Foi adicionada a rota protegida `"/admin"` para manutenção global do sistema:

- Abas separadas de **Livros**, **Usuários**, **Libraries** e **Editoras**.
- CRUD de livros em modal único (criar/editar no mesmo formulário).
- Busca e filtros de livros por texto, editora e biblioteca (combos carregados por API).
- Paginação por `next` com botão **Carregar mais** na listagem.
- CRUD de usuários em modal único.
- Associação N:N de usuários com múltiplas libraries e editoras.
- CRUD de libraries e editoras em modal único por aba, com pesquisa.
- Botão **Atualizar** contextual, respeitando a aba ativa.
- Validação local com feedback imediato em modal (toaster + destaque visual de campo inválido).
- Regras condicionais no cadastro de livro:
  - `Assunto` obrigatório.
  - `URL da capa` opcional (pode ser `null`).
  - Tipo `Externo`: `URL externa` obrigatória, `Nome do arquivo` e `Arquivo` não obrigatórios.
  - Tipos não externos: `Nome do arquivo` e `Arquivo` obrigatórios.

A rota `"/publisher-admin"` continua disponível para o fluxo legado da editora.

## Navegação pública e descoberta

- Header público com:
  - botão central **Assuntos** (`/subjects`);
  - botão de perfil com iniciais do usuário autenticado (menu com **Meu perfil** e **Administração** para administradores).
- Nova rota protegida `"/profile"` para visualização de contexto do usuário (email, vínculo admin, libraries e editoras).
- Home com dois carrosséis:
  - **Publicações recentes**;
  - **Mais acessados** (baseado em `book.access_count`).
- Clique em **Ler agora** registra acesso via `POST /books/:id/access`.
- Tela de detalhes do livro com ações secundárias:
  - **Exportar MARC21** abre modal com payload MARC21 e ação de cópia;
  - **Referência Bibliográfica** gera referência dinâmica em **APA** e **ABNT** usando apenas campos presentes.

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

### Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
