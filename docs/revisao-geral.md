# Ai CRM — Revisão Geral (Auditoria de Phase 1)

**Branch:** `improvements/phase-1` · **Data:** 2026-05-15 · **Autor:** auditoria automatizada (Claude) · **Stack auditada:** monorepo `apps/api` (Fastify 4 + Prisma 5) + `apps/web` (Next.js 14.2.5) + PostgreSQL no Render.

---

## Sumário executivo

O Ai CRM cumpre o seu propósito funcional — ingestão de signals dos agentes Gobii, qualificação por scoring e gestão manual de leads — mas tem **três problemas críticos que devem bloquear qualquer trabalho de melhorias funcionais até serem resolvidos**: (1) a API Fastify está totalmente sem autenticação, exposta na internet, com endpoints destrutivos (`POST /api/admin/reset` apaga toda a BD e tem o gating partido por uma condição mal escrita); (2) a sessão do frontend é apenas o valor literal de `SESSION_SECRET` num cookie, o que torna a auth uma constante partilhada em vez de um token de sessão real; (3) há sinais fortes (ficheiro `apps/api/fix-migration.js`, endpoint `/api/admin/resolve-migration`, várias tentativas de fix no histórico do `/migrate`) de que o estado do `_prisma_migrations` em produção está desalinhado com o `schema.prisma`, o que é a hipótese mais provável para o HTTP 500 no botão "Migrate to Pipeline" e um risco contínuo para todos os deploys. Ao mesmo tempo o repo não tem **nenhum teste**, **nenhuma observabilidade** (sem Sentry, sem structured logging fora de `pino`), validação de input por casts em vez de Zod, e várias bugs funcionais silenciosos (envio de email partido por inconsistência de chave `email_recipients` vs `emailRecipients`, dead code em `routes/ingest.ts`, etc.). Recomendação: três correções críticas em sessões dedicadas e curtas (auth da API, gating do reset, resolução das migrations), depois um quick-win batch de 3-4 horas, depois trabalho de fundo (testes, observabilidade, refactor do `Dashboard.tsx` de 866 linhas).

**Estado dos builds locais (validação baseline neste branch):** `apps/api` `npm run build` exit 0 sem warnings; `apps/web` `npm run build` exit 0 com 1 warning não-bloqueante (`outputFileTracingRoot` precisa sair de `experimental` no Next 14+).

---

## Convenções

- **Severidade:** Crítico (incidente em curso ou risco de perda de dados / breach), Alto (bug funcional confirmado ou risco material), Médio (tech debt / fragilidade), Baixo (cosmético / nice-to-have).
- **Esforço:** XS (< 30min), S (30min-2h), M (2-8h), L (1-3 dias), XL (> 3 dias).
- **Evidência:** ficheiro:linha relativos à raiz do repo `Ai_CRM`.

---

## Achados

### A. Segurança

#### A1. API Fastify sem qualquer autenticação — `[CRÍTICO][S]`
A API está em `https://ai-crm-api-pcdn.onrender.com` totalmente exposta. O middleware do Next.js ([apps/web/src/middleware.ts](apps/web/src/middleware.ts)) só protege as **páginas** do `apps/web` — todas as chamadas reais ao backend (`fetch(API + '/api/leads/...')` em [apps/web/src/app/Dashboard.tsx:5](apps/web/src/app/Dashboard.tsx:5) e [LeadPageV2.tsx:5](apps/web/src/app/LeadPageV2.tsx:5)) vão diretamente para o serviço Render do API, **sem passar pela auth do web**. O único endpoint da API com autenticação é `POST /api/ingest/gobii` ([apps/api/src/routes/ingest.ts:401-425](apps/api/src/routes/ingest.ts:401)).

Isto significa que qualquer pessoa com a URL pode listar leads, alterar status, criar utilizadores ADMIN (`POST /api/users` em [apps/api/src/routes/leads.ts:241](apps/api/src/routes/leads.ts:241)), apagar contactos, alterar empresas, enviar emails via Gmail, gastar a quota da Apollo API, etc. Em particular `app.register(cors, { origin: true })` em [apps/api/src/index.ts:9](apps/api/src/index.ts:9) ainda agrava — aceita qualquer origin com credentials, sem allowlist.

**Mitigação:** Adicionar um hook global `preHandler` que valide um header `Authorization: Bearer ${API_SECRET_KEY}` (já existe `API_SECRET_KEY: generateValue: true` em [render.yaml:21](render.yaml:21)) ou um cookie HMAC. O frontend fica encarregado de injetar o token (env var `NEXT_PUBLIC_API_TOKEN` é mau porque vai para o bundle — preferível um proxy server-side em `apps/web/src/app/api/[...path]/route.ts` que faz o forward com a chave guardada server-side).

#### A2. `POST /api/admin/reset` com gating partido — `[CRÍTICO][XS]`
[apps/api/src/routes/leads.ts:635-651](apps/api/src/routes/leads.ts:635) tem:
```ts
const secret = process.env.RESET_SECRET;
const { confirm } = req.body as { confirm?: string };
if (secret && confirm !== secret) { return reply.code(401).send(...); }
await prisma.auditLog.deleteMany();
// ...apaga tudo: scoreHistory, activity, opportunity, leadSignal, lead, contact, company
```
Se a env var `RESET_SECRET` **não estiver definida** no Render (estado provável — não está no `render.yaml`), `secret` é `undefined` e a condição `secret && ...` é sempre `false` → o reset prossegue sem qualquer verificação. Combinado com A1, qualquer POST a este endpoint apaga 100% da BD em produção.

**Mitigação imediata:** inverter a lógica para `if (!secret || confirm !== secret) return 401`. Idealmente remover o endpoint de produção e mover para um script CLI separado (igual ao `dedup-leads.ts` em [apps/api/scripts/](apps/api/scripts/dedup-leads.ts)).

#### A3. Cookie de sessão = literal `SESSION_SECRET` — `[CRÍTICO][S]`
[apps/web/src/app/api/auth/login/route.ts:12](apps/web/src/app/api/auth/login/route.ts:12):
```ts
response.cookies.set('crm_session', process.env.SESSION_SECRET!, {...});
```
e [apps/web/src/middleware.ts:14](apps/web/src/middleware.ts:14):
```ts
if (!session || session.value !== process.env.SESSION_SECRET) ...
```
O cookie **é** o secret. Se vazar (XSS, log indevido, screenshot, browser comprometido) o atacante tem para sempre. Não há expiração server-side, não há revogação, não há per-user identity (o que também explica por que `userName: 'Utilizador'` em audit logs em [LeadPageV2.tsx:881](apps/web/src/app/LeadPageV2.tsx:881) — o backend não sabe quem está a fazer a request). A comparação `session.value !== process.env.SESSION_SECRET` também não é constant-time.

**Mitigação:** gerar um token aleatório por sessão (`crypto.randomBytes(32).toString('base64url')`), guardá-lo num registo `Session` na BD com `userId` + `expiresAt`, e validar o cookie contra esse registo. Como bónus, o `x-user-name` enviado para o backend passa a ser confiável (vem do servidor, não do client em [LeadPageV2.tsx:181](apps/web/src/app/LeadPageV2.tsx:181) onde está hardcoded como `'Utilizador'`).

#### A4. Endpoints de debug e admin sem autenticação no API — `[CRÍTICO][S]`
Todos sem auth e expostos em produção (mais grave dado A1):
- `GET /api/leads/erp-prospects/:signalId/debug` — [routes/leads.ts:46-52](apps/api/src/routes/leads.ts:46) (vazamento de IDs internos)
- `GET /api/debug/email` — [routes/leads.ts:613-622](apps/api/src/routes/leads.ts:613) (revela presença/valor de `GMAIL_USER`)
- `POST /api/admin/resolve-migration` — [routes/leads.ts:624-633](apps/api/src/routes/leads.ts:624) (executa `$executeRawUnsafe` em `_prisma_migrations`; permite a qualquer um forçar re-aplicação ou rollback de migrations)
- `POST /api/admin/dedup-leads` — [routes/leads.ts:834-855](apps/api/src/routes/leads.ts:834) (apaga leads em prod)
- `POST /api/admin/reset` — ver A2
- `POST /api/users` — [routes/leads.ts:241](apps/api/src/routes/leads.ts:241) (cria utilizadores ADMIN)
- `POST /api/leads/:id/enrich` — [routes/leads.ts:654](apps/api/src/routes/leads.ts:654) (sem rate limit, gasta quota Apollo paga)
- `POST /api/leads/:id/send-email` — [routes/leads.ts:503](apps/api/src/routes/leads.ts:503) (envia emails via Gmail SMTP)

**Mitigação:** depois de A1 estar feito, todos ficam protegidos. Os de `/api/admin/*` devem além disso exigir um segundo header (ex: `X-Admin-Token` distinto), e os endpoints `/debug/*` devem ser removidos (já estão a poluir o repo com `console.log` em [routes/leads.ts:69-105](apps/api/src/routes/leads.ts:69)).

#### A5. Webhook token aceito via query string e body — `[ALTO][S]`
[apps/api/src/routes/ingest.ts:404-416](apps/api/src/routes/ingest.ts:404) aceita o token de `qry.secret`, `qry.token`, `qry.key` e `body.webhookSecret`, `body.secret`, `body.token`, `body.key`. Tokens em query string ficam em logs de proxy, logs de access do Render, no histórico do browser de quem fizer debug, etc. Aceitar via body é OK; via query string é leak vector.

**Mitigação:** aceitar apenas via `Authorization: Bearer` ou `X-Gobii-Token` headers. Se um agente da Gobii precisa de outra forma, configura-se nesse agente (não aqui).

---

### B. Bug do botão "Migrate to Pipeline" (HTTP 500)

#### B1. Hipótese principal: drift entre `_prisma_migrations` e `schema.prisma` — `[CRÍTICO][M]`
**Evidências:**
- `apps/api/fix-migration.js` ([apps/api/fix-migration.js](apps/api/fix-migration.js)) é um script à parte que faz `UPDATE _prisma_migrations SET rolled_back_at = NOW() WHERE migration_name = '20260221000002_update_lead_status'` — só existe se a migração ficou em estado falhado.
- Endpoint `POST /api/admin/resolve-migration` em [routes/leads.ts:624](apps/api/src/routes/leads.ts:624) faz exatamente o mesmo via API.
- Histórico do `/migrate` mostra 4 commits seguidos a tentar arranjar (`a91646a`, `5eef927`, `c4ea11a`, `56b0154`).
- A migração em causa ([prisma/migrations/20260221000002_update_lead_status/migration.sql](prisma/migrations/20260221000002_update_lead_status/migration.sql)) faz `ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'UNDER_QUALIFICATION'` + `'DISCARDED'` na **mesma transação**. O Postgres rejeita usar um valor de enum acabado de adicionar dentro da mesma transação, e Prisma envolve cada ficheiro de migration numa transação. Mesmo com `IF NOT EXISTS`, se a transação implicitamente fizer SELECT/check usando o valor novo numa ferramenta tipo `prisma migrate deploy` na fase de validação, falha. A migração 000003 (`migrate_lost_to_discarded`) está separada precisamente por causa disto.

**Mecanismo do 500:** se a migration `000002` ou `000004_add_nurturing` ficou em estado falhado, o `prisma migrate deploy` no `startCommand` ([render.yaml:9](render.yaml:9)) fica a tentar reaplicar em todos os deploys e bloqueia até ser resolvido. Resultado: schema em prod fica numa de duas situações:
  - **(a)** colunas/valores novos não existem (ex: `Lead.nurtureReason`/`nurtureNotes`/`nextContactDate`, ou valor `NURTURING` no enum) mas o cliente Prisma gerado **sabe** delas e pode emitir SELECTs com `RETURNING` que tocam em colunas inexistentes → exception "column X does not exist" → o endpoint `/migrate` apanha-a no catch genérico ([routes/leads.ts:107-110](apps/api/src/routes/leads.ts:107)) e devolve 500;
  - **(b)** colunas existem mas o `_prisma_migrations` continua a marcar como pendente, o que não bloqueia runtime mas mantém o sistema num estado em que cada deploy é uma roleta russa.

**Próximo passo de diagnóstico (sessão de fix dedicada):** correr `SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM _prisma_migrations ORDER BY started_at DESC` em produção e colar o resultado. Em paralelo, alterar temporariamente o catch do `/migrate` para devolver `err.code` + `err.meta` do Prisma (não só `err.message`) e capturar uma reprodução em Render logs. Não fazer nada disto agora — esta é a sessão de auditoria.

#### B2. Causa secundária possível: race condition no AuditLog — `[ALTO][XS]`
[apps/api/src/routes/leads.ts:91-102](apps/api/src/routes/leads.ts:91) cria o `AuditLog` num `try/catch` separado e marca como non-fatal — bom. **Mas** a versão anterior do código provavelmente não tinha este try/catch (o commit `a91646a` chama-se "fix: migrate endpoint com logs detalhados e audit log não-fatal"), então **se prod ainda estiver a correr essa versão antiga** o AuditLog pode estar a falhar (ex: `userName` NOT NULL com valor undefined) e deitar abaixo a request inteira. Vale a pena confirmar a build atualmente em prod (Render Dashboard → Events).

#### B3. Causa secundária possível: connection pool exhaustion — `[ALTO][XS]`
[apps/api/src/routes/settings.ts:4](apps/api/src/routes/settings.ts:4) instancia uma **segunda** `new PrismaClient()` em vez de reutilizar a singleton em [apps/api/src/lib/prisma.ts](apps/api/src/lib/prisma.ts). Cada chamada a `/api/settings` ou `/api/settings/:key` cria um novo pool de connections. No Render free tier (Postgres com pool default de ~10 connections), isto esgota o pool e queries subsequentes (incluindo o `/migrate`) podem falhar com `Can't reach database server` ou `Connection pool timeout` → catch genérico → 500.

**Mitigação:** uma linha — substituir `import { PrismaClient }` + instanciação por `import { prisma } from '../lib/prisma'` em [routes/settings.ts](apps/api/src/routes/settings.ts).

---

### C. Integridade de dados / migrations

#### C1. Migrations Prisma sem estratégia para enums em produção — `[ALTO][M]`
Confirmar B1. Convenção segura para `ALTER TYPE ADD VALUE` em Postgres + Prisma:
1. Migração N: só `ALTER TYPE ADD VALUE IF NOT EXISTS 'X';` (sem usar X em mais lado nenhum)
2. Migração N+1: UPDATEs / código que usa X.
3. Cada migração num ficheiro próprio.

Já é o que [000002](prisma/migrations/20260221000002_update_lead_status/migration.sql) e [000003](prisma/migrations/20260221000003_migrate_lost_to_discarded/migration.sql) tentam. Mas pelos vistos a 000002 falhou em prod uma vez e ficou em estado pendente → arquivar processo (CHANGELOG ou script `scripts/migration-recovery.md`) para resolver futuros casos.

#### C2. `_prisma_migrations` manipulado por endpoint HTTP — `[ALTO][S]`
`POST /api/admin/resolve-migration` ([routes/leads.ts:624](apps/api/src/routes/leads.ts:624)) faz `$executeRawUnsafe` na tabela de migrations. É um patch para o problema acima mas é um vector de ataque sério (ver A4) e um anti-padrão (a tabela não devia ser modificada via API). Apagar este endpoint depois de resolver C1.

#### C3. `apps/api/scripts/dedup-leads.ts` indica histórico de duplicação em prod — `[MÉDIO][M]`
A existência de [dedup-leads.ts](apps/api/scripts/dedup-leads.ts) e do endpoint gémeo [routes/leads.ts:834](apps/api/src/routes/leads.ts:834) indica que dois leads para a mesma empresa são criados acidentalmente — provavelmente porque `Company.domain @unique` mas `normalizeDomain()` ([routes/ingest.ts:22](apps/api/src/routes/ingest.ts:22)) gera domínios sintéticos do tipo `<slug>.unknown`/`<slug>.rfp.pt` quando o agente não envia domínio, e dois agentes diferentes podem gerar slugs diferentes para a mesma empresa. Resultado: duas Companies, dois Leads. O `reclassify` em [routes/leads.ts:799-810](apps/api/src/routes/leads.ts:799) já tem um workaround que verifica também por nome insensível, mas o `/migrate` ([routes/leads.ts:79](apps/api/src/routes/leads.ts:79)) não tem.

**Mitigação:** quando `signal.domain` é sintético (`endsWith('.unknown')`), usar nome normalizado como chave de dedupe na fase de upsert. Avaliar mudar `Company.domain @unique` para um índice composto `(name, country)` ou ter uma coluna `normalizedKey` separada.

#### C4. `prisma.sectorData` referenciado mas não existe no schema — `[ALTO][XS]`
[routes/ingest.ts:453-461](apps/api/src/routes/ingest.ts:453) faz `(prisma as any).sectorData.upsert(...)` com `.catch(() => { logger.info(...) })`. A model `sectorData` **não existe** em [prisma/schema.prisma](prisma/schema.prisma). Resultado: **todos os signals do `SectorInvestmentScanner` são silenciosamente perdidos** (a linha de log diz "Sector signal stored" mas nada foi armazenado). Isto bate certo com o comentário do brief de que sector investment é "intencionalmente excluído do pipeline principal", mas se esse era o comportamento desejado o código devia simplesmente não tentar armazenar — o `.catch(() => {})` esconde uma intenção que não acontece.

**Mitigação:** ou criar o model `SectorData` no schema (e sair do `.catch(() => {})`), ou remover o bloco e ficar só com o `continue` que já filtra estes signals em `isValidSignal`.

#### C5. `AuditLog.userName` NOT NULL sem default + frontend não envia identidade — `[MÉDIO][S]`
Schema em [prisma/schema.prisma:220](prisma/schema.prisma:220) tem `userName String` sem default. Frontend em [LeadPageV2.tsx:181](apps/web/src/app/LeadPageV2.tsx:181) hardcoded `'Utilizador'`; backend tem fallback `'System_GobiiAgent'` espalhado por várias rotas. Resultado: histórico de quem fez o quê é inútil (toda a gente é `'Utilizador'`). Será resolvido naturalmente quando A3 (sessões reais) for feito.

---

### D. Bugs funcionais

#### D1. Envio de email partido por inconsistência camelCase vs snake_case — `[ALTO][XS]`
- Frontend [SettingsClient.tsx:18,41](apps/web/src/app/settings/SettingsClient.tsx:18) usa key `email_recipients` (snake_case) e guarda como JSON array (`saveSetting` envia o valor; backend faz `JSON.stringify(value)` em [settings.ts:31](apps/api/src/routes/settings.ts:31)).
- Backend [routes/leads.ts:520-523](apps/api/src/routes/leads.ts:520) procura `setting.findUnique({ where: { key: 'emailRecipients' } })` (camelCase) e faz `value.split(',').map(...)`.

Resultado em produção: o `findUnique` devolve sempre `null` → `defaultRecipients = []` → o utilizador recebe "Nenhum destinatário configurado" mesmo depois de configurar emails na UI. **O envio automático de email para a equipa nunca funcionou pela UI.**

**Fix:** unificar a key (recomendo `emailRecipients`, camelCase, e migrar o valor existente). Em paralelo, decidir formato (CSV string ou JSON array) — atualmente o save guarda como JSON `["a@b.com"]` mas o read espera `"a@b.com,c@d.com"`.

#### D2. Email HTML usa campos errados de `LeadSignal` — `[MÉDIO][XS]`
[routes/leads.ts:531-533](apps/api/src/routes/leads.ts:531):
```ts
const signals = (c?.signals || []).map((s: any) =>
  `<li><strong>[${s.type}]</strong> ${s.title || s.type} — score: ${s.score || 0}</li>`
).join('');
```
`LeadSignal` não tem `type`, `title` nem `score` — tem `triggerType`, `summary`, `score_final`. O email enviado mostra `[undefined] undefined — score: 0` para cada signal. Mesmo problema em [LeadPageV2.tsx:97-99](apps/web/src/app/LeadPageV2.tsx:97) (rascunho de `buildEmailContent` que não chega a ser usado porque o `sendEmail` agora chama o backend, mas confunde).

#### D3. Dead code em `routes/ingest.ts` (parsing CLevel/ERPReplacement) — `[MÉDIO][S]`
[routes/ingest.ts:174-207](apps/api/src/routes/ingest.ts:174) tem uma estrutura sintática quebrada: o bloco `if (agentName === 'SAP_S4HANA_CLevelScanner_Daily') {` abre, e dentro dele há **outro** `if (['ERP_ReplacementScorer', ...].includes(agentName))` que é matematicamente impossível (`agentName` não pode ser ambos). O `return extractArray(...)` que se segue está dentro do bloco do CLevel, então **o handler de CLevel devolve sempre o ramo "genérico"** em vez de um normalizer dedicado. O código real do `ERP_ReplacementScorer` aparece duplicado mais abaixo em [routes/ingest.ts:360-376](apps/api/src/routes/ingest.ts:360) e essa cópia funciona; a primeira é dead code que confunde a leitura e foi a principal causa de eu demorar a perceber o normalizer.

**Fix:** apagar as linhas 174-191 e renumerar a estrutura para `if (CLevelScanner) { ... } if (ERPReplacementScorer) { ... }` paralelos.

#### D4. URL da API hardcoded no frontend — `[MÉDIO][XS]`
[Dashboard.tsx:5](apps/web/src/app/Dashboard.tsx:5) e [LeadPageV2.tsx:5](apps/web/src/app/LeadPageV2.tsx:5):
```ts
const API = 'https://ai-crm-api-pcdn.onrender.com';
```
Ignora `NEXT_PUBLIC_API_URL` que está definido em [next.config.js:7](apps/web/next.config.js:7) e usado corretamente em [SettingsClient.tsx:4](apps/web/src/app/settings/SettingsClient.tsx:4). Quebra ambientes de dev/staging.

**Fix:** `const API = process.env.NEXT_PUBLIC_API_URL || 'https://ai-crm-api-pcdn.onrender.com';` em todos os sítios. Confirmar que `NEXT_PUBLIC_API_URL` está set em ambos os Render services.

#### D5. `Dashboard.tsx` chama `?limit=200` em rotas que ignoram o parâmetro — `[BAIXO][XS]`
[Dashboard.tsx:91](apps/web/src/app/Dashboard.tsx:91) faz `fetch(API + '/api/leads?limit=200')` mas a rota [routes/leads.ts:9](apps/api/src/routes/leads.ts:9) não lê `req.query.limit`. Mesma coisa para `/api/signals?limit=200` — a rota lê com `take: 1000` fixo ([routes/leads.ts:430](apps/api/src/routes/leads.ts:430)). Assumir paginação não implementada.

#### D6. `apps/api/src/routes/leads.ts:175` — variável `req.params.id` sombra `req.params.activityId` — `[BAIXO][XS]`
Linha [routes/leads.ts:364](apps/api/src/routes/leads.ts:364):
```ts
const { activityId } = req.params as { id: string; activityId: string };
```
A tipificação `{ id: string; activityId: string }` está correta, mas o destructuring pega só em `activityId` — o `id` declarado no tipo nunca é usado (não é bug, só ruído).

---

### E. Tech debt e código morto

#### E1. `apps/web/src/app/TabDashboard.tsx` é dead code — `[MÉDIO][XS]`
[TabDashboard.tsx](apps/web/src/app/TabDashboard.tsx) (217 linhas) implementa um dashboard antigo (refere `lead.totalScore` direto sem ScoreBar custom, sem nurturing, sem hot prospects). Não é importado por nenhum lugar — o `app/page.tsx` carrega `Dashboard.tsx` (a versão V2). Apagar.

#### E2. `LeadPageV2.tsx` — o "V2" implica que existiu V1 que foi removido pela metade — `[MÉDIO][S]`
Boa nomenclatura para refactor in-progress, mas se o V1 já foi descartado então convém renomear para `LeadPage.tsx` (ou `LeadDetailPage.tsx`). Manter "V2" eternamente é fonte de confusão.

#### E3. `Dashboard.tsx` com 866 linhas e múltiplas responsabilidades — `[ALTO][L]`
Tem: 10 tabs (`pipeline`, `clevels`, `rfp`, `expansion`, `lorena`, `employment`, `nurturing`, `hot_prospects`, `scoring`, `sectors`), filtros, sort, kanban com drag, search, KPIs, modais (nurture, prospect detail), persistência local de scroll/read state. O encoding é tudo inline-style sem componentização. Refactor em fases: extrair um componente por tab (`PipelineTab`, `LorenaTab`, etc.) para ficheiros separados; extrair `useFilters` hook; mover styles para CSS modules.

#### E4. `console.log` em rota de produção — `[MÉDIO][XS]`
[routes/leads.ts:69-105](apps/api/src/routes/leads.ts:69) tem 6 `console.log('[migrate] ...')` (que escrevem para stdout do Render mas não passam pelo `pino` logger). Substituir por `logger.info({ signalId, companyId }, '[migrate] start')` para terem timestamp/JSON estruturado.

#### E5. Casts `as any` espalhados em vez de tipos Prisma — `[MÉDIO][M]`
`(prisma as any).note`, `(prisma as any).task`, `(prisma as any).sectorData`, `(opp as any).contact`, `(req.body as any)`, etc. — em [routes/leads.ts](apps/api/src/routes/leads.ts) há ~30 ocorrências. A maioria desnecessária se o Prisma client estiver bem regenerado. Risco: TypeScript não apanha bugs de schema (D2 é exemplo).

#### E6. `nodemailer` listado tanto em `dependencies` como `devDependencies` — `[BAIXO][XS]`
[apps/api/package.json:17,21](apps/api/package.json:17) — não causa bug, polui o `npm ls`. Manter só em `dependencies`.

#### E7. `apps/web` package.json mistura `@types/*` e `typescript` em `dependencies` em vez de `devDependencies` — `[BAIXO][XS]`
[apps/web/package.json:14-17](apps/web/package.json:14). Em Next.js o build precisa de TS no Render mesmo em produção, então funciona, mas é convenção invertida.

#### E8. `apps/api/fix-migration.js` ao lado do código — `[BAIXO][XS]`
Mover para `apps/api/scripts/` (já há um `scripts/` lá) ou apagar quando C1/C2 estiver feito.

---

### F. Performance / queries

#### F1. `GET /api/leads` carrega tudo + dedupe em memória — `[MÉDIO][S]`
[routes/leads.ts:9-43](apps/api/src/routes/leads.ts:9) faz `findMany` sem `take`, depois itera, faz `Set` de nomes para deduplicar, filtra triggers de pipeline. Cresce O(n) com o tamanho da tabela. Para 100 leads é trivial; para 10000 começa a doer. Adicionar paginação real (parâmetros `?limit=N&cursor=...` com cursor-based) e índice em `Lead.createdAt`.

#### F2. `GET /api/signals/employment` faz full-scan + filtro JS — `[MÉDIO][S]`
[routes/leads.ts:776-788](apps/api/src/routes/leads.ts:776) carrega TODOS os `LeadSignal` sem `where` e filtra em JS por keywords. Mover keywords para SQL com `OR` em `summary ILIKE '%recrut%' OR ...` ou criar índice GIN com tsvector se a lista crescer.

#### F3. Sem índices explícitos no schema — `[MÉDIO][S]`
[prisma/schema.prisma](prisma/schema.prisma) só tem `@id` e `@unique`. Queries comuns:
- `LeadSignal` por `triggerType` (várias rotas) → adicionar `@@index([triggerType])`
- `LeadSignal` por `companyId, createdAt DESC` → adicionar `@@index([companyId, createdAt(sort: Desc)])`
- `Lead` por `status` → `@@index([status])`
- `Lead` por `nextContactDate` (usado em `/api/leads/nurturing`) → `@@index([nextContactDate])`
- `AuditLog` por `leadId, createdAt DESC` → `@@index([leadId, createdAt(sort: Desc)])`

#### F4. `dedup-leads` apaga em loop sem transação — `[ALTO][S]`
[routes/leads.ts:847-853](apps/api/src/routes/leads.ts:847) faz 5 `deleteMany`/`delete` sequenciais por lead duplicado. Se o processo crashar a meio, fica BD num estado inconsistente. Envolver em `prisma.$transaction([...])`.

#### F5. `Prisma log: ['query', 'info', 'warn', 'error']` em produção — `[BAIXO][XS]`
[apps/api/src/lib/prisma.ts:9](apps/api/src/lib/prisma.ts:9). `'query'` log em prod imprime cada query SQL no stdout do Render. Volume alto + cobertura limitada do plan free do Render = logs perdidos / overhead. Limitar a `['warn', 'error']` em produção.

---

### G. Observabilidade e testes

#### G1. Zero testes — `[ALTO][L]`
Não há um único `*.test.ts`/`*.spec.ts` no `apps/`. Para um sistema que ingere webhooks externos e mexe em dados de produção isto é um risco material. Recomendação mínima: testes de integração (Vitest + supertest contra Fastify) para `/api/ingest/gobii` (testa cada agente com payload realista) e para `/api/leads/erp-prospects/:id/migrate` (testa o lead criado, audit log, signal atualizado). Aceitar a inversão de prioridade: começar pelos endpoints com mais bugs já reportados.

#### G2. Sem Sentry / sem error tracking — `[ALTO][S]`
Erros em produção só aparecem nos logs do Render se chegarem a `console.error` ou `logger.error`. O `/migrate` já tem `console.error('[migrate] FATAL:', err.message)` mas perdem-se `err.stack`, `err.code` (do Prisma), `err.meta`, contexto da request. Adicionar `@sentry/node` no API (1h) e `@sentry/nextjs` no web (1h) com `tracesSampleRate: 0.1` no plan grátis dá visibilidade imediata.

#### G3. Logging não estruturado misturado com `pino` — `[MÉDIO][S]`
`console.log` (E4), `console.error`, `logger.info`, `logger.warn`, `logger.error` coexistem. Pino está configurado mas só metade do código o usa. Padronizar em `logger`.

#### G4. README é uma única frase — `[BAIXO][S]`
[README.md](README.md):
```
# Ai_CRM
Intelligent CRM for Gobii agent lead ingestion and qualification.
```
Devia ter pelo menos: como correr local, env vars necessárias, links para os serviços Render, lista de agentes Gobii suportados, comando de migration recovery (ver C1).

---

### H. UX (utilizador não-técnico)

#### H1. Erros mostrados via `alert()` — `[MÉDIO][S]`
[Dashboard.tsx:166,170,185](apps/web/src/app/Dashboard.tsx:166), [LeadPageV2.tsx:130,148](apps/web/src/app/LeadPageV2.tsx:130) e várias outras: 12 ocorrências de `alert(...)`. Bloqueia, é feio, e o utilizador não consegue copiar a mensagem. Substituir por toast (sonner ou react-hot-toast — ambos zero-config) ou um banner inline com `useState`.

#### H2. `confirm()` para deletes — `[BAIXO][S]`
[LeadPageV2.tsx:218,243,263](apps/web/src/app/LeadPageV2.tsx:218): `if (!confirm('Apagar nota?')) return`. Mesmo problema mas menos crítico. Modal customizado seria melhor.

#### H3. "A migrar..." sem feedback de erro acionável — `[ALTO][S]`
Quando o migrate falha (B1), o utilizador vê só `alert('Erro ao migrar: ' + err.error)` ([Dashboard.tsx:185](apps/web/src/app/Dashboard.tsx:185)) com o `err.message` cru do Prisma (em inglês, técnico, sem ID de correlação). Para um utilizador não-técnico isto é inutilizável. Mostrar erro amigável + botão "Reportar erro" que copia para clipboard `signalId + timestamp + erro` para colar a si.

#### H4. Migrate sem confirmação dupla — `[BAIXO][XS]`
Click direto em "Migrar →" cria o Lead. Se o utilizador clicar por engano em vez de "Descartar", há um Lead extra a poluir o pipeline (que ele depois resolve manualmente mudando para `DISCARDED`). Considerar uma confirmação leve (segundo click no mesmo botão num timeout curto).

#### H5. Sem indicação do utilizador atualmente logado — `[BAIXO][S]`
Header em [Dashboard.tsx:233](apps/web/src/app/Dashboard.tsx:233) mostra só "Ai CRM" + "Sair". Como a auth é password partilhada, faz sentido — mas quando A3 (sessões per-user) for feito, mostrar `nome do user @ Sair`.

---

### I. Drift entre IaC e produção

#### I1. `render.yaml` desatualizado vs serviços reais — `[MÉDIO][S]`
- `render.yaml` define serviços `ai-crm-api` e `ai-crm-web`; o brief (e [SettingsClient.tsx:157-158](apps/web/src/app/settings/SettingsClient.tsx:157)) referem `ai-crm-api-pcdn` e `ai-crm-web-pcdn` (nomes diferentes — o `-pcdn` foi adicionado quando o serviço foi recriado manualmente).
- `render.yaml` lista env vars: `NODE_ENV`, `DATABASE_URL`, `MQL_THRESHOLD`, `SQL_THRESHOLD`, `API_SECRET_KEY`, `NEXT_PUBLIC_API_URL`. Faltam (precisam de ser confirmadas no dashboard): `CRM_PASSWORD`, `SESSION_SECRET`, `GOBII_WEBHOOK_TOKEN`, `GOBII_WEBHOOK_TOKEN_SHORT`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `APOLLO_API_KEY`, `RESET_SECRET`. Estão no Render dashboard mas não no IaC — qualquer "redeploy from yaml" partia o sistema.
- `apps/web` **não está** no array `workspaces` do root [package.json:5](package.json:5). O Render trata `rootDir: apps/web` independentemente, OK em prod, mas `npm install` da raiz não toca no web → developers podem confundir-se.

**Mitigação:** atualizar o `render.yaml` para refletir os nomes reais (`-pcdn`) e adicionar todas as env vars com `sync: false` (o Render preenche manualmente sem expor o valor). Adicionar `apps/web` aos workspaces se possível.

#### I2. `.env.example` ausente ou desatualizado — `[BAIXO][XS]`
Existe um `.env.example` na raiz do projeto irmão `gobii-results-manager_clean` mas **não verifiquei o conteúdo do equivalente no `Ai_CRM`** (existe segundo o glob, mas o build local correu sem ele — provavelmente está esqueleto). Garantir que lista todas as vars de I1.

---

## Plano recomendado por fases

Cada fase deve vir numa sessão separada com confirmação explícita sua antes de começar e um PR pequeno por fase. Os bugs críticos de segurança e do migrate **devem ser tratados antes de qualquer melhoria funcional**.

### Fase 1 — Stop the bleeding (sessões 1-4, ~1 dia distribuído)
Ordem rígida; cada uma é uma sessão individual.

| # | Achado | Esforço | Bloqueia |
|---|---|---|---|
| 1 | A2 — inverter gating de `/api/admin/reset` (uma linha) + B3 — corrigir singleton Prisma em `settings.ts` (uma linha) + remover `'query'` do log Prisma em prod (F5). Sessão de "tiny fixes" agrupada porque são todos one-liners de risco baixo e impacto alto. | XS+XS+XS | — |
| 2 | A1 + A4 — adicionar autenticação à API Fastify, com proxy server-side no Next para não expor token ao bundle. | M | — |
| 3 | B1 + C1 + C2 — diagnosticar estado de `_prisma_migrations` em prod, marcar migration falhada como rolled_back, redeploy, validar que `/migrate` deixa de dar 500. Remover `/api/admin/resolve-migration` e `fix-migration.js`. | M | (3) |
| 4 | A3 — substituir `crm_session = SESSION_SECRET` por sessões reais (token random + tabela `Session` ou JWT assinado). Frontend passa a enviar `x-user-name` real do servidor. | M | (1)(2) |

### Fase 2 — Quick wins (1 sessão, ~3-4 horas)
Tudo agrupado num PR só porque são fixes isolados, baixo risco:

- D1 — unificar `email_recipients` ↔ `emailRecipients` (XS)
- D2 — corrigir campos de signals no email HTML (XS)
- D3 — apagar dead code em `routes/ingest.ts` (S)
- D4 — `NEXT_PUBLIC_API_URL` no Dashboard e LeadPageV2 (XS)
- C4 — decidir destino dos sector signals (criar model ou apagar bloco) (XS)
- E1 — apagar `TabDashboard.tsx` (XS)
- E4 — substituir `console.log` por `logger` no migrate (XS)
- E6/E7 — limpar `package.json` (XS)
- I1 — atualizar `render.yaml` com nomes reais e env vars completas (S)

### Fase 3 — Performance e robustez (1-2 sessões)

- G2 — adicionar Sentry (S)
- F3 — índices no Prisma schema + migration (S)
- F1 + F2 — paginação real e index/SQL para employment (M)
- F4 — `dedup-leads` em transação (S)
- C3 — dedupe robusta com fallback por nome no `/migrate` (S)

### Fase 4 — Qualidade de código (várias sessões)

- E3 — refactor `Dashboard.tsx` em componentes por tab (L)
- E5 — eliminar `as any` (M)
- G3 — padronizar logging (S)
- E2 — renomear `LeadPageV2` (S)

### Fase 5 — Testes e documentação (várias sessões)

- G1 — testes de integração Fastify para os 6 agentes + migrate + status changes (L)
- G4 — README completo + runbook de migration recovery (S)

### Fase 6 — UX (1-2 sessões)

- H1 — substituir `alert()` por toast (S)
- H2 — substituir `confirm()` por modal (S)
- H3 — erros amigáveis no migrate (S)
- H4 + H5 — refinamentos (XS+XS)

---

## Quick wins (alto impacto, baixo esforço)

Estes são candidatos para serem feitos primeiro mesmo dentro da Fase 1, isolados em commits dedicados — cada um é XS e tem impacto desproporcional:

1. **A2** — inverter `if (secret && ...)` para `if (!secret || ...)` em `/api/admin/reset`. **Uma linha. Fecha o vector destrutivo mais perigoso da auditoria.**
2. **B3** — substituir `new PrismaClient()` em `settings.ts` por `import { prisma } from '../lib/prisma'`. **Uma linha. Provável causa direta do 500 do migrate em horas de pico.**
3. **D1** — uniformizar `email_recipients` → `emailRecipients` (frontend) ou vice-versa (backend) + decidir se valor é JSON array ou CSV. **Funcionalidade de email passa a funcionar.**
4. **D4** — `const API = process.env.NEXT_PUBLIC_API_URL || ...` em `Dashboard.tsx` e `LeadPageV2.tsx`. **Desbloqueia ambientes de dev/staging.**
5. **C4** — apagar o `try/catch` que esconde a falha do `sectorData.upsert`. **Mostra a verdade: ou implementar, ou remover.**
6. **F5** — `log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'info', 'warn', 'error']` no `prisma.ts`. **Reduz volume de logs em prod.**
7. **E1** — apagar `apps/web/src/app/TabDashboard.tsx`. **217 linhas de dead code que aparecem em buscas.**

Total estimado: ~2 horas para os 7 fixes acima, todos com risco muito baixo se feitos com cuidado e validação por build local.

---

## Notas finais

- Esta auditoria não tocou em código. Todas as correções devem vir em sessões separadas com a tua confirmação (regra da memória `feedback_estilo_audit`).
- O documento foi escrito na branch `improvements/phase-1` que foi criada a partir de `main` para esse efeito. O branch só contém este documento — não há código alterado.
- Builds locais validados ambos com `exit 0` antes de qualquer afirmação sobre o estado do repo.
- Hipótese sobre o bug do migrate (B1) é a mais sólida com a evidência disponível; confirmação requer acesso a `_prisma_migrations` em prod (sessão de fix dedicada). Se eventualmente vires que não bate, B2 e B3 são as alternativas mais prováveis.
