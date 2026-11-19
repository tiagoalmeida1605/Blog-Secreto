# NEXUS DevHub API

A primeira versão da API privada centraliza estado técnico do Blog-Secreto, da Rádio Geração Ativa, do GitHub e da Vercel dentro de Vercel Functions.

## Runtime Vercel

O projeto requer Node.js `24.x` (também declarado em `package.json` e no workflow de CI). No painel da Vercel, selecione Node.js 24.x como runtime do projeto para as Functions. Essa seleção é uma configuração manual do projeto; este repositório não configura nem altera o runtime remoto.

## Arquitetura

- `api/devhub/v1/` contém os handlers HTTP versionados.
- `lib/devhub/` contém configuração, autenticação, logging, clientes e agregação.
- Os clientes externos usam GET, timeout de 5 segundos e limites pequenos.
- Nenhum segredo ou resposta privada é enviado ao navegador.

## Autenticação

O frontend obtém um Firebase ID Token com o Firebase Authentication existente e envia:

```http
Authorization: Bearer <Firebase ID Token>
```

A API verifica o token criptograficamente com Firebase Admin, verifica revogação e compara o UID com `DEVHUB_OWNER_UID`. Se a configuração Firebase estiver ausente ou incompleta, os endpoints privados falham fechados com HTTP 503.

## Variáveis de ambiente

Configure os nomes definidos em `.env.example` como Secrets ou variáveis de ambiente na Vercel. `FIREBASE_SERVICE_ACCOUNT_JSON` deve receber o JSON completo da conta de serviço; quebras de linha da chave privada são normalizadas.

Integrações sem configuração:

- GitHub continua público quando não existe token, mas exige repositórios válidos.
- Vercel exige token e project IDs.
- RGA exige `RGA_BASE_URL`.

## Executar localmente

Instale e use o Vercel CLI:

```bash
npm install
npm install --global vercel
vercel dev
```

Defina variáveis locais de desenvolvimento no ambiente do CLI ou em `.env.local`; não copie nem confirme secrets de produção. O arquivo estático também pode ser servido pelo Python, mas apenas `vercel dev` executa as Functions.

Exemplo após iniciar `vercel dev`:

```bash
curl http://localhost:3000/api/devhub/v1/health
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/devhub/v1/overview
```

## Testes

```bash
npm test
npm run check
```

Os testes usam `node:test`, mocks e não acessam credenciais ou serviços reais.

## Estados

- `operational`: fonte configurada e respondendo.
- `degraded`: parte das fontes ou verificações falhou.
- `unavailable`: fonte indisponível.
- `partially_configured`: configuração necessária ausente.

O overview usa `Promise.allSettled`, portanto uma falha não impede os resultados das demais fontes.

## Limitações

- Não há deploy, rollback, promoção, escrita ou armazenamento histórico.
- Não há cache persistente nem rate limiting global nesta versão.
- Os resultados externos são limitados aos repositórios e projetos configurados.
- A liveness pública não consulta Firebase ou integrações externas.
