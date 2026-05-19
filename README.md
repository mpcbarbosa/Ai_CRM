# Ai CRM

Lead-qualification CRM that ingests buying signals from a fleet of Gobii AI
agents (SAP S/4HANA LeadScanner, ExpansionScanner, CLevelScanner, RFPScanner,
SectorInvestmentScanner, LeadScoring, Lorena Lee ERP prospector, ERP
Replacement Scorer) and feeds them into a sales pipeline.

In production at:
- **Web (CRM UI)**: <https://ai-crm-web-pcdn.onrender.com>
- **API**: <https://ai-crm-api-pcdn.onrender.com> (closed; requires Bearer
  `${API_SECRET_KEY}` except `/health` and `/api/ingest/gobii`)

## Stack

| Piece | Tech |
|---|---|
| API | Fastify 4 + TypeScript + Prisma 5 |
| Web | Next.js 14 (App Router) + React 18 + TypeScript |
| DB | PostgreSQL 18 (Render Basic-1gb) |
| Observability | Sentry (api + web), pino structured logs |
| Hosting | Render (Frankfurt region) |

## Architecture

```
                       ┌────────────────┐
   Gobii agents ──────▶│  POST /api/    │
   (webhooks)          │  ingest/gobii  │  ── validates GOBII_WEBHOOK_TOKEN
                       │                │
                       │  Fastify api   │  ◀──── Bearer ${API_SECRET_KEY}
                       │  (apps/api)    │             on /api/*
                       └───────┬────────┘
                               │ Prisma
                               ▼
                       ┌────────────────┐
                       │   PostgreSQL   │
                       │   ai-crm-db    │
                       └────────────────┘
                               ▲
                               │ no direct browser access
                               │
   Browser ──fetch /api/proxy/api/leads──▶  Next.js web
                                            (apps/web)
                                            ├─ server-side proxy adds
                                            │  Authorization: Bearer
                                            │  + x-user-name from JWT
                                            └─ JWT session cookie
                                               signed with SESSION_SECRET
```

## Repo layout

```
apps/
  api/        Fastify backend (routes, scoring, ingest, prisma client)
  web/        Next.js frontend (Dashboard, lead detail, login, proxy)
prisma/
  schema.prisma
  migrations/
docs/
  revisao-geral.md    Phase-1 audit + status of every finding
render.yaml           Render Blueprint (services + DB declarations)
```

## Local setup

Prerequisites: Node 20+, Docker (for Postgres) or a local Postgres 16+.

```bash
# 1. Get a database running. Either:
docker run -d --name ai-crm-pg -p 5433:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ai_crm \
  postgres:16-alpine
# OR point DATABASE_URL at an existing instance.

# 2. Install monorepo deps (api + web use separate node_modules).
npm install                      # root + apps/api (workspace)
cd apps/web && npm install       # web is standalone
cd ../..

# 3. Apply schema.
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_crm \
  npx prisma migrate deploy --schema=./prisma/schema.prisma

# 4. Run api (port 10000 by default).
cd apps/api
DATABASE_URL=... API_SECRET_KEY=local-dev-token npm run dev

# 5. Run web (port 3001 by default). New terminal.
cd apps/web
NEXT_PUBLIC_API_URL=http://localhost:10000 \
  API_SECRET_KEY=local-dev-token \
  CRM_PASSWORD=dev-pw \
  SESSION_SECRET=any-random-string-32-chars-or-more \
  npm run dev
# → http://localhost:3001
```

### Env vars (required)

| Service | Var | Purpose |
|---|---|---|
| api | `DATABASE_URL` | Postgres connection string |
| api | `API_SECRET_KEY` | Bearer token required on every `/api/*` |
| api | `GOBII_WEBHOOK_TOKEN` | Token validated by `/api/ingest/gobii` |
| api | `MQL_THRESHOLD`, `SQL_THRESHOLD` | Score thresholds for auto-qualification |
| api | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | for `/api/leads/:id/send-email` |
| api | `APOLLO_API_KEY` | for `/api/leads/:id/enrich` |
| api | `RESET_SECRET` | optional, gates `/api/admin/reset` |
| api | `SENTRY_DSN` | optional, error reporting |
| web | `NEXT_PUBLIC_API_URL` | full URL to api (e.g. `https://ai-crm-api-pcdn.onrender.com`) |
| web | `API_SECRET_KEY` | same value as on api, used by server-side proxy |
| web | `CRM_PASSWORD` | shared login password |
| web | `SESSION_SECRET` | signs the JWT session cookie |
| web | `NEXT_PUBLIC_SENTRY_DSN` | optional, browser-side error reporting |

See `render.yaml` for the production binding (all secrets are `sync: false`
i.e. managed manually in the dashboard).

## Auth model (current)

- **Web UI login**: shared `CRM_PASSWORD` + a self-declared user name.
  Successful login signs a 30-day JWT (HMAC-SHA256, secret `SESSION_SECRET`)
  carrying the name; the JWT is the value of cookie `crm_session`.
- **API**: every `/api/*` route demands `Authorization: Bearer ${API_SECRET_KEY}`.
  The browser never sees this token; the Next.js server-side proxy at
  `apps/web/src/app/api/proxy/[[...path]]/route.ts` injects it. The same proxy
  extracts the userName from the JWT and forwards it as `x-user-name`, which
  the api uses for audit-log attribution.
- **Webhook (`/api/ingest/gobii`)**: bypasses the Bearer check; validates its
  own `GOBII_WEBHOOK_TOKEN` per request (header `x-gobii-token`, also accepted
  in body for legacy reasons — see audit finding A5 for the planned tightening).
- **`/health`**: open, no auth.

Real per-user passwords (multi-user auth) are not yet implemented — the
shared-password model is acceptable while there are 1–2 operators.

## Production operations

### Inspect the DB directly

```bash
# From the Render dashboard, ai-crm-db → Connect → External Database URL.
# Then:
psql "<external db url>"
\dt                                  # tables
SELECT COUNT(*) FROM "Lead";         # counts
SELECT migration_name, finished_at, rolled_back_at
  FROM _prisma_migrations
  ORDER BY started_at DESC LIMIT 5;
```

### If a Prisma migration gets stuck

The `prisma migrate deploy` in the api's startCommand will refuse to start
when a migration is in a failed state. Recovery (do not commit this anywhere):

```sql
UPDATE "_prisma_migrations"
SET rolled_back_at = NOW(), finished_at = NULL
WHERE migration_name = '<the failed one>' AND rolled_back_at IS NULL;
```

Then trigger a manual deploy from the Render dashboard.

### Remove duplicate leads

Same company sometimes gets two `Lead` rows when agents disagree on the
domain. Cleanup endpoint (requires Bearer):

```bash
curl -X POST https://ai-crm-api-pcdn.onrender.com/api/admin/dedup-leads \
  -H "Authorization: Bearer $API_SECRET_KEY"
```

Or run the script directly: `apps/api/scripts/dedup-leads.ts`.

## Audit + improvement history

See [docs/revisao-geral.md](docs/revisao-geral.md) for the running list of
findings, severity, and resolution status. Each PR that closed an item
updated the doc accordingly.
