# Agent Learnings

Base de memoria incremental para reduzir retrabalho entre agentes e interacoes.

## Modelo de entrada

```md
### YYYY-MM-DD - <contexto/task>
- Descoberta:
- Evidencias:
  - <arquivo/caminho>
- Acao aplicada:
- Impacto esperado:
```

## Entradas

<!-- Adicione entradas novas no topo desta secao. -->

### 2026-09-02 - consentimento OAuth deve ser uma decisão informada, não uma lista de scopes
- Descoberta:
  - Na tela de consentimento do usuário final, todas as novas permissões precisam ficar visíveis antes da decisão, mas agrupadas por área para reduzir carga cognitiva.
  - Permissões que executam ações em nome do usuário devem ser distinguidas de permissões de consulta; códigos OAuth e `openid` continuam fora da linguagem principal da tela.
  - A decisão fica mais clara com `Não permitir` / `Permitir acesso` e com a indicação de que o consentimento pode ser removido depois em Meu perfil → Apps conectados.
- Evidencias:
  - `src/view/OAuthConsentView.tsx`
  - `src/model/OAuthConsentPresentation.ts`
  - `src/styles/OAuthConsentView.css`
- Acao aplicada:
  - O consentimento passou a apresentar identidade do parceiro, contexto de bibliotecas, permissões agrupadas, destaque para ações em nome do usuário e permissões antigas recolhidas no fluxo de ampliação de acesso.
- Impacto esperado:
  - Consentimento mais compreensível e transparente, mantendo o contrato OAuth e o fluxo de aprovação/negação existentes.

### 2026-09-02 - apps conectados no perfil devem usar linguagem de privacidade da conta
- Descoberta:
  - A seção de apps conectados é uma interface do usuário final, não uma extensão do admin OAuth; ela deve responder quem tem acesso, a quais áreas, desde quando e como remover esse acesso.
  - A lista fica mais legível quando scopes são resumidos por áreas e os detalhes ficam expansíveis, mantendo `openid` fora da contagem de permissões exibidas.
- Evidencias:
  - `src/view/ProfileView.tsx`
  - `src/model/OAuthPartnerPresentation.ts`
  - `src/styles/ProfileView.css`
- Acao aplicada:
  - A seção ganhou descrição, resumo por áreas, permissões expansíveis, data simplificada e a ação `Remover acesso`, com adaptação mobile.
- Impacto esperado:
  - Menor carga cognitiva no perfil e revogação de consentimento mais compreensível sem ampliar o escopo da feature para o restante da página.

### 2026-09-02 - auditoria e entrega de segredo em Parceiros OAuth
- Descoberta:
  - O link de revelação pode ser aberto sem consumir o segredo; o uso único só é consumido quando o administrador confirma a revelação na página dedicada. Portanto a listagem de Parceiros não deve duplicar essa confirmação.
  - O histórico por parceiro é melhor tratado como a própria Auditoria filtrada por `client_id`, evitando duas interfaces para o mesmo conceito.
  - Em eventos `RESOURCE_ALLOWED`/`RESOURCE_DENIED`, `user_id` pode representar o OAuth client, então a camada de apresentação não deve rotulá-lo automaticamente como usuário final.
- Evidencias:
  - `src/view/AdminView.tsx`
  - `src/model/OAuthAudit.ts`
  - `src/controller/AdminController.ts`
  - `src/view/OAuthSecretRevealView.tsx`
- Acao aplicada:
  - O aviso de segredo passou a ser compacto, sem expor a URL inteira, com ações de copiar e abrir a página de revelação; a auditoria ganhou traduções, filtros, tabela responsiva, detalhes e reutilização do filtro por parceiro.
- Impacto esperado:
  - Menos ruído na listagem, menor duplicação de fluxo e auditoria mais útil para operação e suporte sem perder dados técnicos.

### 2026-09-02 - administração de OAuth deve usar o modelo mental de parceiros
- Descoberta:
  - Na área administrativa, termos de protocolo como `client`, `grant type` e `scope` aumentam a carga cognitiva; o contrato OAuth pode permanecer técnico internamente, enquanto a UI usa Parceiros, tipo de integração e permissões.
  - Auditoria OAuth pertence ao contexto de Parceiros e não deve competir com Livros/Usuários/Acervos no primeiro nível da navegação.
- Evidencias:
  - `src/view/AdminView.tsx`
  - `src/model/OAuthPartnerPresentation.ts`
  - `src/styles/AdminView.css`
- Acao aplicada:
  - A aba foi renomeada para Parceiros, ganhou busca e filtro de status, resumo de permissões, menu de ações e Auditoria aninhada; o formulário foi reorganizado por intenção administrativa sem alterar o payload OAuth.
- Impacto esperado:
  - Menor carga cognitiva e melhor escalabilidade da gestão de integrações, preservando os contratos existentes com a API.
