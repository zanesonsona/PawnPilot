# PawnPilot

Multi-tenant pawnshop management SaaS for the Philippine market.

**Current status:** Phase 0 (Discovery), Phase 1 (Foundation), and Phase 2 (Authentication and
tenancy) are complete locally. Phase 2 was explicitly approved on 2026-10-29. It is awaiting review
before Phase 3; do not start Phase 3 without explicit approval. The Guard role has been removed from
the portal scope.

The authoritative architecture, data model, API plan, role matrix, unresolved business rules,
security plan, testing strategy, decisions, phase checklist, and verification results are in:

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)
- [`docs/adr/0001-foundation-stack.md`](./docs/adr/0001-foundation-stack.md)
- [`docs/adr/0002-staff-login-identity.md`](./docs/adr/0002-staff-login-identity.md)
- [`docs/adr/0003-tenant-rls-decision.md`](./docs/adr/0003-tenant-rls-decision.md)

## What Phase 2 delivered

- Separate platform and tenant authentication realms with server-side role and branch checks.
- Hybrid staff login: email for Platform Administrators, Company Owners, and Head Office
  Administrators; company-scoped username plus company slug for branch operators.
- Opaque, database-backed sessions with immediate revocation; CSRF double-submit tokens plus an
  `Origin` allowlist.
- Argon2id password hashing, login throttling, audit events, invitation acceptance, password reset,
  and forced password changes for temporary branch credentials.
- TOTP MFA with encrypted secrets and one-time, hashed recovery codes. Platform-administrator MFA is
  mandatory; tenant MFA is available and recommended for owners.
- Company provisioning, owner invitations, Head Office Administrator invitations, branch-user
  creation, branch assignment, deactivation/reactivation, and password resets through `/api/v1`.
- Web login, MFA challenge and enrollment, invitation acceptance, forgot/reset password, forced
  password change, authenticated dashboard, login redirects, and logout.
- RLS spike and an accepted decision to defer full RLS while keeping application scoping and
  composite foreign keys; see ADR 0003.
- Generated OpenAPI TypeScript types in `packages/api-client`.

No customers, pawn tickets, payments, financial calculations, reports, or production deployment
exist yet. Phase 4 remains blocked on confirmed financial rules.

## Stack

- **Frontend:** Next.js 16.4.3 App Router, React 19, TypeScript 5.9, Tailwind CSS 4
- **Backend:** NestJS 12 modular monolith, TypeScript 6, ESM
- **Database:** PostgreSQL 17 with Prisma 6.19.3
- **API:** Versioned REST under `/api/v1`, OpenAPI at `/api/openapi.json`
- **Tests:** Vitest for API and web; Supertest for API end-to-end checks
- **Auth:** Hybrid login, opaque server-side sessions, Argon2id, TOTP MFA, separate tenant/platform
  authorization

## Repository layout

```text
pawnpilot/
├── apps/
│   ├── api/                 # NestJS API, Prisma schema, migrations, tests
│   └── web/                 # Next.js authentication experience and dashboard
├── packages/
│   └── api-client/          # generated OpenAPI types
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

# 5. Seed a development platform administrator
npm run db:seed

# 6. Start web and API together
npm run dev
```

The web app runs at `http://localhost:3000`. The API runs at `http://localhost:3001`.
The OpenAPI document is available at `http://localhost:3001/api/openapi.json` in development.

If the Docker Compose plugin is unavailable, run PostgreSQL directly with the same development
credentials from `apps/api/.env.example`, or install the Compose plugin. The repository includes
`infra/docker-compose.yml` for environments that have it.

`apps/api/.env` is ignored. It must contain `DATABASE_URL`, `MFA_ENCRYPTION_KEY` (a base64-encoded
32-byte key), and optionally the development platform administrator seed values. The first platform
administrator login must enroll TOTP MFA before a session is issued.

`apps/web/.env.local` is ignored and should contain `API_INTERNAL_URL=http://localhost:3001` for the
server-side session check and same-origin proxy.

## Authentication behavior

- Platform administrators sign in at `/login` with the platform tab, or call
  `POST /api/v1/auth/platform/login`. The platform realm cannot call tenant endpoints.
- Company Owners and Head Office Administrators sign in with email at `POST /api/v1/auth/login`.
- Branch operators sign in with their company-scoped username and company slug.
- A first platform login returns a setup challenge rather than a session. Complete TOTP enrollment
  with `/api/v1/auth/mfa/enroll` and `/api/v1/auth/mfa/enroll/confirm`; save the one-time recovery
  codes shown once.
- Invitation links and password-reset links are generated by the API email outbox. In local
  development the link is printed in the API log.
- Sessions are cookie-backed (`pp_session`) with a readable double-submit CSRF cookie (`pp_csrf`).
  State-changing requests require the `x-csrf-token` header and an allowed `Origin`.
- Branch operators cannot self-service a password reset; an owner or Head Office Administrator
  resets the account and issues a temporary password.

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
| `npm run test:rls` | Run the disposable RLS isolation spike |
| `npm run format` / `npm run format:check` | Format or check formatting |
| `npm run db:up` / `npm run db:down` | Start or stop local PostgreSQL via Compose |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Seed a development platform administrator |
| `npm run openapi:generate` | Generate API types while the API is running |

## Verification recorded for Phase 2

Run inside WSL on 2026-10-29 against PostgreSQL 17:

```text
npm run format:check                        → passed
npm run lint                                → passed
npm run typecheck                           → passed
npm run test                                → 7 tests passed (3 API, 4 web)
npm run test:e2e                            → 20 tests passed (3 health, 17 auth/tenancy)
npm run test:rls                            → passed
npm run build                               → passed (NestJS + Next.js)
npm run openapi:generate                    → passed; generated 1,229-line schema
```

A web smoke check also passed against the running web and API processes: platform login, mandatory
MFA enrollment, authenticated dashboard render, authenticated login-page redirect, logout, and
signed-out dashboard redirect.

The GitHub Actions workflow has not executed on a remote repository. Local checks are the recorded
evidence for this phase. Browser automation (Playwright/axe) is not implemented yet.

## Security and data boundaries

- Tenant identity comes from the authenticated session, never from a client-supplied `companyId`.
- Platform administrators use a separate realm and cannot call tenant endpoints or read tenant
  financial records.
- Head Office Administrators manage branch users and assignments but have no financial reporting
  access by default.
- Cross-tenant and unassigned-branch access is denied server-side and covered by end-to-end tests.
- Deactivation revokes active sessions and invalidates outstanding password-reset tokens and MFA challenges; every session check also rejects disabled accounts.
- Phase 2 contains no customer, identification, or financial data.
- No production deployment, real-data migration, or production record change happens without
  explicit authorization.
- Financial rules, interest, fees, maturity, penalties, and regulatory disclosures must be confirmed
  before Phase 4.

## Open decisions

- Deployment target and region.
- Number of Head Office Administrators per tenant and owner continuity/backup.
- Shared-device rules for branch operators and final username convention.
- Support-access policy.
- Actual Jerome's Pawnshop company/branch structure and branch count.
- Cash-session scope before Phase 5.
- Git author identity for future commits (the local repository currently uses a placeholder).
- All financial rules in `PROJECT_PLAN.md` section 7.1 before Phase 4.
