# ADR 0001: Phase 1 Foundation Stack

- **Status:** Accepted
- **Date:** 2026-10-28
- **Phase:** 1 — Foundation

## Context

PawnPilot needs a production-oriented foundation for a multi-tenant pawnshop SaaS. The existing
repository was a fresh Next.js 16 scaffold with no backend, database, authentication, tests, or
version control.

The foundation must support a modular monolith, strict tenant boundaries, versioned REST APIs,
database migrations, generated API types, and repeatable checks. The local environment is WSL
Debian with Node 24, npm 11, Docker 26, and PostgreSQL 17.

## Decisions

### 1. Use npm workspaces

Use a single npm-workspaces monorepo with `apps/web`, `apps/api`, and `packages/api-client`. npm is
already installed and the repository already had a lockfile. Turborepo and Nx are unnecessary at
this size.

### 2. Use NestJS 12 in native ESM mode

NestJS 12 packages are ESM-only. The API uses `"type": "module"`, TypeScript `nodenext`, explicit
`.js` extensions on relative imports, and Vitest. Do not force CommonJS or add a Jest transform
layer.

### 3. Use Vitest for both applications

Vitest handles the ESM NestJS packages without a CommonJS bridge. The API has separate unit and
end-to-end configurations. The web app uses a small unit test for status-label behavior.

### 4. Pin Prisma 6.19.3 for the foundation

Prisma 6.19.3 is the stable previous major and supports the schema style and generated client used
in Phase 1. Prisma 7 is stable but introduces a new contract/config format, ESM client output, and
driver-adapter requirements. Evaluating that migration is a separate, approved task.

Prisma's CLI depends on `deepmerge-ts@7.1.5`, which has a high-severity stack-exhaustion advisory.
A root npm override pins `deepmerge-ts@8.0.2`. Prisma CLI generation, migration deployment, and seed
commands were re-run successfully with the override. The override must be removed or revised when
Prisma is upgraded.

### 5. Keep environment files per application

`apps/api/.env` is used by the API and Prisma CLI. `apps/web/.env.local` configures the web-to-API
internal URL. Both are ignored. Only `.env.example` files are committed.

### 6. Keep one public origin through a Next.js proxy

The web app proxies `/api/*` and `/health/*` to the API with `API_INTERNAL_URL`. This prepares
first-party cookies and avoids browser CORS in normal operation. Direct API CORS is still
allowlisted by `WEB_ORIGIN` for local or separate-origin development.

### 7. Commit a baseline before restructuring

The original scaffold and Phase 0 plan were committed as `d1b2437` before moving files. The local
repository initially had no Git author identity, so the baseline uses the placeholder identity
`PawnPilot Dev <dev@pawnpilot.local>`. Replace it before publishing or making shared commits.

## Consequences

- API source imports use `.js` extensions even though the files are TypeScript. This is required by
  Node ESM resolution.
- NestJS 12 and Vitest are coupled to Node 20+; the project standardizes on Node 24.
- Prisma 6 remains in use until a deliberate Prisma 7 migration. The `deepmerge-ts` override is
  temporary and security-relevant.
- The same-origin proxy depends on `API_INTERNAL_URL` being available when the web app is built or
  started.
- The Docker Compose file is the documented local database path. This WSL environment lacks the
  Compose plugin, so Phase 1 verification used an equivalent direct `docker run postgres:17-alpine`
  container.

## Verification

Local verification passed for format, lint, strict typecheck, 7 unit tests, 3 API end-to-end tests,
both production builds, Prisma generation, migration deployment, and the seed. The dependency audit
reported zero vulnerabilities after the override. The GitHub Actions workflow has not yet run on a
remote repository.
