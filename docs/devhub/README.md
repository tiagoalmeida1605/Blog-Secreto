# NEXUS Dev Hub API

A API privada centraliza estado técnico dos projetos, da Rádio Geração Ativa, do GitHub e da Vercel dentro de Vercel Functions. O frontend React/Vite está na raiz do repositório; as rotas da API permanecem em `api/devhub/v1/`.

## Runtime Vercel

O projeto declara Node.js `24.x` em `package.json` e no workflow de CI. Confirme a versão efetivamente selecionada no painel da Vercel; este repositório não configura nem altera o runtime remoto.

## Arquitetura

- `src/` contém o frontend React/Vite e as páginas autenticadas.
- `api/devhub/v1/` contém handlers HTTP versionados.
- `lib/devhub/` contém configuração, autenticação, logging, clientes e persistência/agregação.
- Integrações externas usam requisições server-side com timeout e limites de resultados.
- Nenhum segredo, token ou resposta privada é enviado ao navegador.

## Autenticação

O Firebase Authentication Client SDK fornece um Firebase ID Token, enviado ao backend:

```http
Authorization: Bearer <Firebase ID Token>
```

A API verifica o token com Firebase Admin, confere revogação e compara o UID com `DEVHUB_OWNER_UID`. A proteção de rotas no React é somente visual; cada rota privada valida novamente a autorização. Se a configuração do Firebase estiver ausente ou incompleta, as rotas privadas falham de forma fechada com HTTP 503.

## Endpoints

Todos os endpoints abaixo, exceto `health`, exigem autenticação do proprietário.

| Método e rota | Ação |
| --- | --- |
| `GET /api/devhub/v1/health` | Liveness pública, sem consultar dependências. |
| `GET /api/devhub/v1/services` | Estado dos serviços RGA. |
| `GET /api/devhub/v1/github` | Atividade e repositórios GitHub configurados. |
| `GET /api/devhub/v1/deployments` | Deployments Vercel dos projetos configurados. |
| `GET /api/devhub/v1/overview` | Estado agregado das fontes. |
| `GET /api/devhub/v1/projects` | Lista projetos. |
| `POST /api/devhub/v1/projects` | Cria projeto validado. |
| `PATCH /api/devhub/v1/projects/{projectId}` | Atualiza campos permitidos; arquivamento é não destrutivo. |
| `GET /api/devhub/v1/settings` | Lê preferências de widgets e integrações. |
| `PUT /api/devhub/v1/settings` | Atualiza essas preferências. |
| `GET /api/devhub/v1/analytics?period=30d` | Lê snapshots (`7d`, `30d`, `90d` ou `all`). |
| `POST /api/devhub/v1/analytics` | Coleta métricas atuais no servidor; não aceita dados fornecidos pelo navegador. |
| `GET /api/devhub/v1/rga-feed` | Consulta e normaliza o feed público da RGA. |

As respostas privadas usam `Cache-Control: private, no-store`. Erros públicos são genéricos e não incluem detalhes internos.

## Variáveis de ambiente

Configure os nomes listados em [`.env.example`](../../.env.example) como Secrets ou variáveis de ambiente. `FIREBASE_SERVICE_ACCOUNT_JSON` recebe o JSON completo da conta de serviço; quebras de linha da chave privada são normalizadas. Não coloque credenciais administrativas em variáveis `VITE_*`.

- Firebase Admin: `DEVHUB_OWNER_UID`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`.
- GitHub: `GITHUB_USERNAME`, `GITHUB_REPOSITORIES` e, opcionalmente, `GITHUB_TOKEN`.
- Vercel: `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID_BLOG_SECRETO`, `VERCEL_PROJECT_ID_RGA`.
- RGA: `RGA_BASE_URL`.

GitHub pode usar endpoints públicos sem token, mas precisa de repositórios válidos. Vercel requer token e IDs de projeto. RGA requer `RGA_BASE_URL`.

## Executar localmente

Requer Node.js 24.x:

```bash
npm install
npm run dev
```

Para executar as Vercel Functions junto do frontend, use Vercel CLI:

```bash
npx vercel dev
```

Defina variáveis locais em `.env.local`; nunca copie secrets de produção nem confirme arquivos de ambiente. Servir apenas os arquivos estáticos não executa as Functions.

## Dados e limitações

- Projects e preferências são persistidos pelo Firebase Admin no Firestore; exclusão de projetos é não destrutiva.
- Analytics grava snapshots reais e idempotentes em `devhub_analytics_snapshots`. A coleta é manual e autenticada; não há Cron Job configurado.
- As regras Firestore restringem as coleções do Dev Hub ao proprietário e negam acesso direto do cliente aos snapshots.
- GitHub e Vercel são consultados em modo somente leitura.
- Não há deploy, rollback, promoção, cache persistente ou rate limiting global.
- A liveness pública não verifica Firebase ou integrações.
- O assistente NEXUS AI antigo permanece pausado e não é carregado pelo frontend novo.

## Testes

```bash
npm test
npm run check
```

Testes Node usam `node:test`; a suíte frontend usa Vitest e Testing Library. Os testes usam mocks e não acessam credenciais ou serviços reais.
