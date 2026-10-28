# PawnPilot

Multi-tenant pawnshop management SaaS for the Philippine market.

**Current status:** Phase 0 (Discovery) is complete. Phase 1 (Foundation) is complete locally and
awaiting review. Phase 2 (Authentication and tenancy) has **not** started.

The authoritative architecture, data model, API plan, role matrix, unresolved business rules,
security plan, testing strategy, decisions, phase checklist, and verification results are in:

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)
- [`docs/adr/0001-foundation-stack.md`](./docs/adr/0001-foundation-stack.md)

## What Phase 1 delivered

- Git repository with a baseline commit and a separate Phase 1 commit.
- npm workspaces monorepo: `apps/web`, `apps/api`, and `packages/api-client`.
- Next.js 16 web shell with a responsive foundation dashboard and same-origin API proxy.
- NestJS 12 API with configuration validation, structured request logging, request IDs, security
  headers, a consistent error envelope, health checks, and OpenAPI.
- PostgreSQL 17 local configuration, Prisma schema, initial migration, and a no-tenant seed.
- Vitest unit tests for the API and web, plus API end-to-end health tests.
- ESLint, Prettier, strict TypeScript, production builds, and a GitHub Actions CI workflow.
- Dependency audit clean after overriding Prisma's vulnerable `deepmerge-ts` transitive dependency.

No authentication, tenant records, customers, pawn tickets, payments, financial calculations, or
production deployment exist yet.

## Stack

- **Frontend:** Next.js 16.4.3 App Router, React 19, TypeScript 5.9, Tailwind CSS 4
- **Backend:** NestJS 12 modular monolith, TypeScript 6, ESM
- **Database:** PostgreSQL 17 with Prisma 6.19.3
- **API:** Versioned REST under `/api/v1`, OpenAPI at `/api/openapi.json`
- **Tests:** Vitest for API and web; Supertest for API end-to-end checks
- **Auth:** Planned for Phase 2; separate tenant/platform realms with opaque server-side sessions

## Repository layout

```text
pawnpilot/
├── apps/
│   ├── api/                 # NestJS API, Prisma schema, migrations, tests
│   └── web/                 # Next.js web shell
├── packages/
│   └── api-client/          # generated OpenAPI types (populated in Phase 2)
├── infra/
│   └── docker-compose.yml   # local PostgreSQL 17
├── docs/
│   └── adr/                 # architecture decision records
├── .github/workflows/ci.yml
├── PROJECT_PLAN.md
└── package.json             # npm workspaces and root scripts
```

## Prerequisites

- Node.js 24 and npm 11 (inside WSL recommended)
- Docker with the Compose plugin
- Git

All commands should run inside WSL, not Windows PowerShell on the UNC path.

```powershell
wsl -d Debian -- bash -lc "cd /home/zane/Projects/PawnPilot && npm ci"
```

## Local setup

```bash
# 1. Install dependencies
npm ci

# 2. Create local environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Start PostgreSQL
npm run db:up

# 4. Generate Prisma Client and apply migrations
npm run db:generate
npm run db:migrate

# 5. Start web and API together
npm run dev
```

The web app runs at `http://localhost:3000`. The API runs at `http://localhost:3001`.
The OpenAPI document is available at `http://localhost:3001/api/openapi.json` in development.

If the Docker Compose plugin is unavailable, run PostgreSQL directly with the same development
credentials from `apps/api/.env.example`, or install the Compose plugin. The repository includes
`infra/docker-compose.yml` for environments that have it.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run web and API together |
| `npm run dev:web` / `npm run dev:api` | Run one application |
| `npm run build` | Build the API and web apps |
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Strict TypeScript checks |
| `npm run test` | Unit tests for API and web |
| `npm run test:e2e` | API end-to-end tests against PostgreSQL |
| `npm run format` / `npm run format:check` | Format or check formatting |
| `npm run db:up` / `npm run db:down` | Start or stop local PostgreSQL via Compose |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Run the Phase 1 no-tenant seed |
| `npm run openapi:generate` | Generate API types once the API is running |

## Verification recorded for Phase 1

The following passed inside WSL against PostgreSQL 17:

```text
npm ci                                      → passed, 0 vulnerabilities
npm run format:check                        → passed
npm run lint                                → passed
npm run typecheck                           → passed
npm run test                                → 7 tests passed (3 API, 4 web)
npm run test:e2e                            → 3 tests passed
npm run build                               → passed (NestJS + Next.js)
npm run db:generate                         → passed
npm run prisma:deploy -w @pawnpilot/api     → no pending migrations
npm run db:seed                             → passed; 0 companies created
```

Runtime smoke checks also passed: API liveness and readiness, API metadata, OpenAPI JSON, web home
page, and the web-to-API same-origin proxy.

The GitHub Actions workflow has not been executed on a remote repository yet. Local checks are the
recorded evidence for this phase.

## Security and data boundaries

- Tenant identity must eventually come from the authenticated session, never from a client-supplied
  `companyId`.
- Platform administrators must not casually read tenant financial records.
- Phase 1 contains no customer, identification, or financial data.
- No production deployment, real-data migration, or production record change happens without
  explicit authorization.
- Financial rules, interest, fees, maturity, penalties, and regulatory disclosures must be confirmed
  before Phase 4.

## Open decisions before Phase 2

- Deployment target and region.
- Staff identity model: email versus username/phone.
- Support-access policy.
- Cash-session scope.
- Git author identity for future commits (the local repository currently uses a placeholder).
