# NEXUS Dev Hub

Ambiente privado de desenvolvimento para administrar projetos e acompanhar integrações, deployments e atividade do ecossistema NEXUS. A aplicação é restrita ao proprietário e usa a identidade visual NEXUS BLUE.

## Funcionalidades atuais

- Autenticação Firebase com persistência de sessão do SDK e rotas React protegidas.
- Dashboard com respostas atuais da API, sem métricas simuladas.
- Projects com cadastro, edição, busca, filtro e arquivamento não destrutivo.
- Estado e atividade consultados no GitHub, Vercel e Rádio Geração Ativa.
- Admin Center com preferências de widgets e módulos, persistidas pelo backend, e tema local.
- System Monitor com estado e latência observada no navegador; não declara uptime ou recursos não coletados.
- Analytics com coleta manual e histórico de snapshots protegidos no Firestore.

O NEXUS AI Assistant permanece pausado. Seus arquivos legados foram preservados, mas não são importados pelo frontend novo. A interface anterior de registros não faz parte da experiência do Dev Hub. Documentos antigos não são apagados nem migrados.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS 4 |
| Navegação e dados | React Router, TanStack Query |
| Gráficos e ícones | Recharts, Lucide React |
| Autenticação do navegador | Firebase Authentication SDK |
| Backend | Vercel Functions, Node.js 24.x, JavaScript ES Modules |
| Dados privados | Firebase Admin SDK / Cloud Firestore |

O frontend entra por `index.html` e `src/`. As Vercel Functions continuam em `api/`, e a autenticação, os clientes e os serviços compartilhados ficam em `lib/devhub/`.

## Instalação e desenvolvimento

Requer Node.js 24.x e npm.

```bash
npm install
npm run dev
```

Para executar também as Vercel Functions localmente, use o Vercel CLI:

```bash
npx vercel dev
```

Configure as variáveis server-side localmente em `.env.local` para as Functions. Não copie secrets de produção, não confirme arquivos de ambiente e não use service account no frontend.

## Comandos

```bash
npm run dev        # Vite local
npm run build      # Typecheck e build em dist/
npm run preview    # Servir o build localmente
npm run typecheck  # TypeScript
npm test           # Testes Node e componentes
npm run check      # Typecheck, sintaxe das Functions e testes
```

## Autenticação e segurança

O Firebase Client SDK usa o mesmo projeto já configurado para o workspace anterior. A persistência de autenticação é configurada pelo SDK. O Dev Hub não grava Firebase ID Tokens em `localStorage` ou `sessionStorage`.

Cada rota privada da API valida criptograficamente o Firebase ID Token, verifica revogação e compara o UID com `DEVHUB_OWNER_UID`. A proteção do React Router é apenas uma barreira de interface, não substitui a autorização no backend. Não há cadastro público.

Service account, `GITHUB_TOKEN` e `VERCEL_API_TOKEN` só são lidos pelas Functions via ambiente server-side. Respostas privadas usam `Cache-Control: private, no-store`; logs e mensagens públicas não devem conter tokens nem segredos.

## Integrações e API

O frontend chama exclusivamente a API do próprio Dev Hub para obter dados privados:

- `GET /api/devhub/v1/health` — liveness pública, sem consultar dependências.
- `GET /api/devhub/v1/overview` — estado agregado de RGA, GitHub e Vercel.
- `GET /api/devhub/v1/services` — verificações de serviço da RGA.
- `GET /api/devhub/v1/github` — repositórios, commits e execuções GitHub Actions configurados.
- `GET /api/devhub/v1/deployments` — deployments dos projetos Vercel configurados.
- `GET|POST /api/devhub/v1/projects` e `PATCH /api/devhub/v1/projects/{projectId}` — projetos persistidos.
- `GET|PUT /api/devhub/v1/settings` — preferências não sensíveis do workspace.
- `GET|POST /api/devhub/v1/analytics` — histórico e coleta manual protegida.
- `GET /api/devhub/v1/rga-feed` — feed público da RGA encaminhado pela API autenticada.

As Functions existentes reutilizam os clientes em `lib/devhub/`. Não são feitas operações de escrita no GitHub ou na Vercel.

## Firestore

- `devhub_projects`: projetos com campos validados; exclusão definitiva não é oferecida, use o estado `archived`.
- `devhub_settings/owner`: widgets do Dashboard e integrações visíveis, sem credenciais.
- `devhub_analytics_snapshots`: snapshots gravados e lidos exclusivamente por Firebase Admin. As regras do cliente negam acesso direto.
- `entries`: regras e documentos legados permanecem; não há migração ou limpeza automática.

As novas coleções têm regras explícitas de proprietário e validação de estrutura; o catch-all continua negando acesso. Dados de snapshots são criados somente pelo backend após uma coleta real.

## Analytics e agendamento

A coleta é manual e autenticada. Cada snapshot agrega métricas reais consultadas no momento, registra estado por fonte e usa um bucket temporal para evitar duplicação. Consultas aceitam `7d`, `30d`, `90d` e `all`. Quando não há dados, a interface informa que o histórico está começando; não cria série histórica artificial.

Não há Cron Job configurado neste repositório. Para ativar coleta periódica futuramente, configure um agendamento da Vercel que invoque um endpoint server-side autenticado, com credencial de job armazenada como Secret e validação própria — nunca reutilize nem exponha tokens do proprietário no navegador. Nenhuma variável remota ou credencial de agendamento foi alterada nesta implementação.

## Variáveis de ambiente

As Functions usam as variáveis listadas em [`.env.example`](./.env.example). Principais grupos:

- Firebase Admin: `DEVHUB_OWNER_UID`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`.
- GitHub: `GITHUB_USERNAME`, `GITHUB_REPOSITORIES` e, opcionalmente, `GITHUB_TOKEN`.
- Vercel: `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID_BLOG_SECRETO`, `VERCEL_PROJECT_ID_RGA`.
- RGA: `RGA_BASE_URL`.

Os campos `VITE_FIREBASE_*`, quando usados para substituir a configuração já existente do Firebase Client SDK, são configurações públicas do cliente; nunca coloque credenciais administrativas em variáveis `VITE_*`.

## Vercel

O `package.json` declara Node.js `24.x`, e as Functions permanecem em `api/`. O build do Vite gera `dist/`; `vercel.json` aplica fallback das rotas do React Router para `index.html`, sem mover as Functions. Confirme no painel da Vercel a configuração de Node.js e o comando/output detectados pelo projeto. Variáveis remotas não são gerenciadas por este repositório.

Esta alteração não executa deploy nem altera configurações remotas da Vercel.

## Documentação da API

Veja [`docs/devhub/README.md`](./docs/devhub/README.md) e o contrato [`docs/devhub/openapi.yaml`](./docs/devhub/openapi.yaml).
