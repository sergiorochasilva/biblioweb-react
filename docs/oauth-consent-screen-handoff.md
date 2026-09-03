# Handoff: tela de consentimento OAuth (`/oauth/consent`)

**Origem:** `biblioweb-api`, Fase 3 do trabalho de integração OAuth2/OIDC (`docs/superpowers/plans/2026-07-28-oauth-integration-api-phase3.md` naquele repositório).

**Atualizado na Fase 9** (`docs/superpowers/sdd/2026-07-30-oauth-integration-api-phase9/` naquele repositório): consentimento passou a ser persistido. Isso adiciona (a) três campos novos na resposta de `GET /oauth/authorize/requests/<request_id>`, usados para pular a tela quando o app já está autorizado com o mesmo escopo e para sinalizar ampliação de escopo (seções 3 e 4.1), e (b) uma tela nova de gerenciamento de apps conectados (seção 8).

**O que precisa ser implementado aqui:** uma rota nova, `/oauth/consent`, que recebe um `request_id` via query string e conduz o usuário por login (se necessário) + aprovação/negação de uma aplicação parceira pedindo acesso à conta BiblioWeb dele.

Este documento é autossuficiente — não é necessário ler o plano da API pra implementar isso, mas ele existe se for preciso entender o desenho de ponta a ponta do lado do backend.

---

## 1. Contexto: por que essa tela existe

O `biblioweb-api` está implementando um servidor OAuth2/OIDC para permitir que aplicações parceiras (terceiros) se integrem ao BiblioWeb em nome de um usuário. Quando uma dessas aplicações quer vincular a conta de um usuário, ela redireciona o navegador dele para:

```
GET https://<api>/oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...&nonce=...&code_challenge=...&code_challenge_method=S256
```

Como o `biblioweb-api` é uma API JSON pura (sem renderização de HTML), esse endpoint **não autentica ninguém diretamente** — ele só valida a solicitação e redireciona o navegador para cá:

```
GET {APP_PUBLIC_URL}/oauth/consent?request_id=<uuid>
```

A partir daqui, o trabalho é 100% deste repositório: garantir que o usuário esteja logado (fluxo já existente) e mostrar uma tela simples de "App X quer acessar sua conta BiblioWeb: [permissões]" com botões Permitir/Negar.

## 2. Fluxo completo (visão geral)

```text
1. Usuário chega em /oauth/consent?request_id=<id> (redirecionado pela API)
2. Se não estiver logado (isAuthenticated === false):
   - Redirecionar para /login?next=/oauth/consent%3Frequest_id%3D<id>
     (mesmo padrão de "next" já usado em ProtectedRoute/rotas protegidas)
   - Após login normal (e-mail + código, já existente), o usuário volta
     automaticamente para /oauth/consent?request_id=<id>
3. Com o usuário logado, chamar GET /oauth/authorize/requests/<id>
   (autenticado com o Bearer token já existente no AuthContext)
   → retorna nome do app e escopos pedidos, para exibir na tela
4. Usuário decide:
   - Permitir → POST /oauth/authorize/requests/<id>/approve
   - Negar    → POST /oauth/authorize/requests/<id>/deny
   Ambos retornam { "redirect_uri": "https://client-parceiro.com/callback?..." }
5. Navegar o navegador para esse redirect_uri (window.location.href = ...)
   — isso fecha o loop, voltando pro app parceiro que iniciou o fluxo.
```

## 3. Contrato dos 3 endpoints internos (já implementados no `biblioweb-api`, Fase 3)

Todos exigem o mesmo Bearer token de login que o resto da aplicação já usa (`Authorization: Bearer <token>`, via `AuthContext`/`api.ts` como qualquer outra chamada autenticada).

### `GET /oauth/authorize/requests/<request_id>`

Resposta `200`:
```json
{
  "client_id": "uuid-do-client",
  "client_name": "Nome do App Parceiro",
  "scope": "openid biblioweb.profile.read biblioweb.libraries.read",
  "consent_required": true,
  "already_granted_scopes": "openid biblioweb.profile.read",
  "new_scopes": "biblioweb.libraries.read"
}
```

Campos novos (Fase 9, consentimento persistido):

- `consent_required` (booleano): se `false`, o usuário já autorizou este app com exatamente este escopo antes — a tela de consentimento **não deve ser exibida** (ver seção 4.1).
- `already_granted_scopes` (string, escopos separados por espaço, ordenados): **todos** os escopos que o usuário já havia autorizado anteriormente para este app — não é a interseção com o `scope` deste pedido. Ex: se o usuário já concedeu `openid biblioweb.profile.read biblioweb.libraries.read` e o app agora pede só `openid biblioweb.profile.read`, este campo ainda traz os três. Vem como string vazia (`""`) quando nunca houve consentimento prévio.
- `new_scopes` (mesmo formato): os escopos deste pedido que ainda **não** foram autorizados. Quando nunca houve consentimento prévio, traz todos os escopos pedidos (idêntico a `scope`).

Resposta `404` (solicitação inexistente, expirada — 10 minutos de validade — ou já decidida): mostrar uma mensagem de erro genérica ("Este link de autorização expirou ou já foi usado. Peça para o aplicativo iniciar o processo novamente.").

Resposta `401`: usuário não está logado — nunca deveria acontecer se o passo 2 acima for respeitado, mas trate como "volta pro login" por segurança.

### `POST /oauth/authorize/requests/<request_id>/approve`

Sem corpo. Resposta `200`:
```json
{ "redirect_uri": "https://client-parceiro.com/callback?code=...&state=..." }
```

Resposta `404`: a solicitação não existe mais, já foi decidida, ou expirou (pode acontecer se o usuário demorar demais na tela — trate como erro e sugira recomeçar).

### `POST /oauth/authorize/requests/<request_id>/deny`

Sem corpo. Resposta `200`:
```json
{ "redirect_uri": "https://client-parceiro.com/callback?error=access_denied&state=..." }
```

## 4. O que exibir na tela

`scope` vem como string separada por espaço (ex: `"openid biblioweb.profile.read biblioweb.libraries.read"`). Sugestão de tradução amigável (a definir com design, mas nenhum desses escopos deve ser omitido silenciosamente — o usuário precisa ver o que está autorizando):

| Escopo | Texto sugerido |
|---|---|
| `openid` | Confirmar sua identidade |
| `profile` | Ver seu nome |
| `email` | Ver seu e-mail |
| `offline_access` | Continuar conectado sem precisar logar de novo |
| `biblioweb.profile.read` | Ver seu perfil BiblioWeb |
| `biblioweb.libraries.read` | Ver as bibliotecas às quais você tem acesso |
| `biblioweb.catalog.read` | Ver o catálogo das suas bibliotecas |
| `biblioweb.loans.read` | Ver seus empréstimos |
| `biblioweb.loans.write` | Criar e devolver empréstimos em seu nome |
| `biblioweb.licenses.read` | Baixar licenças dos seus empréstimos |

`openid` sempre está presente (é obrigatório no contrato) e pode ficar implícito ("App X quer acessar sua conta BiblioWeb"), sem precisar de um item de lista próprio.

### 4.1 Comportamento conforme `consent_required` (Fase 9)

Depois de receber a resposta de `GET /oauth/authorize/requests/<id>`, a tela deve se comportar de forma diferente conforme os três campos novos:

- **`consent_required: false`** — o usuário já autorizou este app com exatamente este escopo antes. **Não exibir a tela de consentimento.** Chamar `POST /oauth/authorize/requests/<id>/approve` diretamente (sem esperar clique do usuário) e seguir o `redirect_uri` retornado, exatamente como faria após um clique em "Permitir". Em vez de deixar a tela em branco enquanto isso acontece, mostrar um estado de carregamento curto (ex: "Conectando…").
- **`consent_required: true` e `already_granted_scopes` não vazio** — é uma **ampliação de escopo**: o app já estava conectado, mas está pedindo permissões adicionais. A tela deve deixar isso claro (ex: "App X já está conectado à sua conta e agora está pedindo acesso a:") e listar apenas os itens de `new_scopes` como os pedidos **novos** — não apresentar `already_granted_scopes` como se fosse a primeira conexão. Ainda cabe mostrar `already_granted_scopes` como contexto secundário ("você já havia autorizado: ..."), mas o destaque visual (botões, texto principal) deve ir para os escopos novos.
- **`consent_required: true` e `already_granted_scopes` vazio** — primeira conexão: comportamento idêntico ao já implementado hoje (usar `scope`/`new_scopes`, que nesse caso são equivalentes, para listar tudo o que está sendo pedido).

Em todos os casos, use a mesma tabela de tradução de escopos acima para os códigos presentes em `new_scopes`/`already_granted_scopes`.

## 5. Onde encaixar no código (seguindo os padrões já existentes neste repo)

Conforme `AGENTS.md` deste repositório:

- **View nova:** `src/view/OAuthConsentView.tsx`.
- **Chamadas HTTP:** passar por `src/service/api.ts` (ou um `src/service/oauthConsentService.ts` novo, especializado, seguindo o padrão de outros services que já usam `api.ts` por baixo).
- **Rota:** adicionar em `src/App.tsx`, dentro de uma rota protegida (mesmo padrão de `ProtectedRoute`/`Outlet` já usado — `/oauth/consent` deve exigir login, redirecionando para `/login?next=...` automaticamente se não autenticado, exatamente como `ProtectedRoute` já faz para outras rotas).
- **Auth:** usar `useAuth()` (`src/contexts/useAuth.ts`) para obter o token e `isAuthenticated`, do jeito que qualquer outra tela autenticada já faz — não reinventar guarda de rota, reaproveitar `ProtectedRoute`.
- **Estilo visual:** seguir o padrão de telas públicas/autenticadas já documentado na seção 5.1 do `AGENTS.md` deste repo (`glass-card`/`glass-panel`, tokens de `src/styles/global.css`), consistente com `LoginView`/`PasswordLoginView`.
- **JSDoc:** obrigatório em funções novas/alteradas (params e retorno), conforme já exigido no `AGENTS.md`.

## 6. Casos de erro a tratar na UI

- `request_id` ausente na URL → mensagem de erro, sem tentar chamar a API.
- `GET .../requests/<id>` retorna `404` → tela de erro ("link expirado ou inválido"), sem botões de ação.
- `POST .../approve` ou `.../deny` retorna `404` (ex: usuário demorou e a solicitação expirou entre o `GET` e o clique) → mesma tela de erro.
- Qualquer erro de rede → tratamento de erro padrão já usado no resto da aplicação (mensagens consistentes ao usuário, conforme seção 5 do `AGENTS.md`).
- **Nunca** navegar automaticamente para um `redirect_uri` sem o usuário ter clicado em Permitir/Negar — essa navegação final é o único ponto onde a decisão do usuário sai do controle desta aplicação. **Exceção (Fase 9):** quando `consent_required` vier `false`, o `approve` automático descrito na seção 4.1 é esperado — nesse caso a decisão do usuário já foi tomada numa autorização anterior com o mesmo escopo, então não há uma nova decisão pendente de clique.

## 7. O que NÃO faz parte deste trabalho

- Cadastro de aplicações parceiras (isso é uma tela administrativa no backend, `POST/GET/PUT/DELETE /oauth-clients`, fora do escopo do frontend público).
- Nada relacionado a `client_credentials` (isso é 100% server-to-server, nunca passa pelo navegador).
- Emissão de `refresh_token` (adiada para uma fase futura do backend — não afeta esta tela).

## 8. Tela de apps conectados (gerenciar consentimentos existentes) — Fase 9

**Origem:** `biblioweb-api`, Fase 9 do trabalho de integração OAuth2/OIDC (consentimento passou a ser persistido, o que torna possível listar e revogar apps já conectados).

Diferente da tela de consentimento (seções 1–6, que só aparece durante o fluxo de autorização de um app parceiro), esta é uma tela de gerenciamento, pensada para viver na área logada do BiblioWeb (ex: dentro de configurações/perfil do usuário), onde ele pode ver quais apps parceiros têm acesso à conta dele e revogar esse acesso quando quiser. A localização exata dentro da navegação/menu fica a critério de quem for implementar aqui — este handoff cobre o contrato dos endpoints e o comportamento esperado da tela, seguindo o mesmo padrão de código descrito na seção 5 (view em `src/view`, chamada HTTP via `src/service/api.ts` ou um service especializado, `useAuth()` para o token, estilo `glass-card`/`glass-panel` da seção 5.1 do `AGENTS.md`, JSDoc obrigatório).

### `GET /oauth/consents`

Mesmo Bearer token de login normal (`Authorization: Bearer <token>`, via `AuthContext`/`api.ts` como qualquer outra chamada autenticada).

Resposta `200`:
```json
{
  "items": [
    {
      "client_id": "uuid-do-client",
      "client_name": "Nome do App Parceiro",
      "scopes": ["openid", "biblioweb.profile.read", "biblioweb.libraries.read"],
      "granted_at": "2026-07-15T12:00:00",
      "updated_at": "2026-07-20T09:30:00"
    }
  ]
}
```

- `scopes` já vem como **lista** de strings (diferente do `scope`/`already_granted_scopes`/`new_scopes` das seções 3 e 4, que são strings separadas por espaço) — reaproveitar a mesma tabela de tradução da seção 4 para exibir cada item de forma amigável.
- `granted_at`: quando o consentimento foi concedido pela primeira vez para este app.
- `updated_at`: quando foi atualizado pela última vez (ex: numa ampliação de escopo, seção 4.1). Pode ser usado para algo como "Conectado desde X" / "Atualizado em Y", se fizer sentido no design.
- **Atenção ao fuso horário:** `granted_at`/`updated_at` vêm **sem** indicador de fuso (`%Y-%m-%dT%H:%M:%S`, sem `Z` nem offset) — é UTC "cru". `new Date("2026-07-15T12:00:00Z")` e `new Date("2026-07-15T12:00:00")` são interpretados de formas diferentes em JS (o primeiro como UTC, o segundo como hora local), então **não** tratar esses valores como se já tivessem `Z`; ao formatar para exibição, montar a data manualmente como UTC (ex: acrescentar `Z` antes de passar para `Date`, ou usar um parse explícito) para evitar deslocamento de horário.
- `items` vazio (`[]`) é uma resposta `200` válida — significa que o usuário não tem nenhum app conectado no momento, não é erro.

Resposta `401`: usuário não está logado — mesmo `@validate_jwt_token` das rotas da seção 3; trate como "volta pro login" por segurança.

### `DELETE /oauth/consents/<client_id>`

Mesmo Bearer token. Sem corpo na requisição.

- `204` sem corpo: revogado com sucesso.
- `404`: não havia consentimento ativo para esse `client_id` (ex: já havia sido revogado antes, ou o usuário nunca chegou a autorizar esse app). Tratar como sucesso idempotente na UI — o resultado desejado ("esse app não tem mais acesso") já vale — sem exibir um erro alarmante ao usuário.
- `401`: usuário não está logado — mesmo tratamento acima ("volta pro login").

### Comportamento esperado da tela

- Listar os apps retornados por `GET /oauth/consents`, mostrando `client_name` e os escopos concedidos (`scopes`, traduzidos pela tabela da seção 4).
- Cada item deve ter uma ação de "Desconectar" (ou "Revogar acesso") que chama `DELETE /oauth/consents/<client_id>`.
- **Antes de revogar, avisar claramente que a ação desconecta o app**: o acesso é removido imediatamente e, se o usuário quiser voltar a usar aquele app depois, vai precisar passar de novo pelo fluxo de autorização completo (tela de consentimento das seções 1–6). Uma confirmação (modal/dialog) antes de disparar o `DELETE` é o padrão recomendado, para evitar revogação acidental.
- Após revogar com sucesso (`204`, ou `404` tratado como sucesso idempotente conforme acima), remover o item da lista sem precisar recarregar a página inteira.
- Erro de rede na listagem ou na revogação: mesmo tratamento padrão já usado no resto da aplicação (seção 5 do `AGENTS.md`).

## 9. Validação manual sugerida

1. No `biblioweb-api`, seguir a Task 10 do plano da Fase 3 até o passo de gerar a URL de `GET /oauth/authorize` com um `client` de teste cadastrado.
2. Abrir essa URL num navegador — deve cair em `/oauth/consent?request_id=...` deste frontend.
3. Se não estiver logado, confirmar que cai no login normal e volta pra tela de consentimento depois.
4. Confirmar que a tela mostra o nome do app e os escopos pedidos.
5. Clicar em Permitir e confirmar que o navegador é redirecionado pro `redirect_uri` do client de teste, com `code` e `state` na URL.
6. Repetir negando, e confirmar o redirecionamento com `error=access_denied`.
7. **(Fase 9)** Repetir o fluxo de autorização para o mesmo client, com o mesmo escopo, já estando logado: confirmar que a tela de consentimento é pulada (estado "Conectando…") e o navegador já cai direto no `redirect_uri` com `code`/`state`.
8. **(Fase 9)** Repetir o fluxo pedindo um escopo adicional em relação ao já concedido: confirmar que a tela aparece, mas destacando só o(s) escopo(s) novo(s) como pendente(s) de aprovação.
9. **(Fase 9)** Abrir a tela de apps conectados e confirmar que o app de teste aparece com os escopos concedidos e as datas corretas.
10. **(Fase 9)** Revogar o app pela tela e confirmar que ele some da lista e que uma nova tentativa de autorização volta a exigir consentimento completo (`consent_required: true`, `already_granted_scopes` vazio).
