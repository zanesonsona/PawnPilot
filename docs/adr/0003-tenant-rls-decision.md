# ADR 0003: Row-Level Security Decision for Tenant Isolation

- **Status:** Accepted
- **Date:** 2026-10-29
- **Phase:** 2 — Authentication and tenancy

## Context

PawnPilot is a shared multi-tenant database. Tenant and branch isolation must be enforced
server-side, not only in the web client. The Phase 2 plan proposed application-level authorization
with composite foreign keys first, and an RLS spike as a possible defense-in-depth backstop.

The open question was whether PostgreSQL row-level security (RLS) can be adopted now without making
routine Prisma access fragile. RLS is only a backstop if every tenant-scoped read and write runs
under the intended database role and a transaction-local tenant context. A policy that silently
returns no rows when context is missing can also turn a programming mistake into a confusing
application failure rather than a clear authorization error.

## Spike

A disposable RLS spike was added at `apps/api/prisma/rls-spike.ts` and runs with:

```bash
npm run test:rls
```

It creates a throwaway schema, table, policy, and role, then checks:

1. A transaction with `app.company_id` set to company A can read and write company A rows.
2. The same transaction cannot insert a company B row.
3. A transaction with company B context sees only company B rows.
4. A transaction with no tenant context returns zero rows.
5. The tenant context does not leak across Prisma pool checkouts.

The policy uses:

```sql
company_id = NULLIF(current_setting('app.company_id', true), '')::uuid
```

The `NULLIF` is required because `current_setting(..., true)` returns an empty string after a
transaction-local setting is reset, not SQL `NULL`.

The spike passed locally. The CI workflow also runs it after applying migrations.

## Decision

**Do not enable RLS on tenant tables in Phase 2.**

Phase 2 keeps:

- server-side tenant and branch scope checks in the API services and guards;
- composite company/account and company/branch constraints in PostgreSQL;
- cross-tenant end-to-end tests; and
- audit records for privileged tenant actions.

RLS remains a candidate backstop for a later phase, after the following prerequisites are designed
and reviewed:

1. A Prisma access layer that sets the tenant context and database role for **every**
   tenant-scoped transaction, including background jobs, scripts, and migrations.
2. A non-owner, non-superuser application role. Table owners and superusers can bypass RLS;
   `FORCE ROW LEVEL SECURITY` only covers the table owner, not a superuser.
3. Explicit handling for missing or invalid tenant context so failures are authorization errors,
   not empty result sets.
4. A migration and operational runbook, plus performance tests for the resulting policies and
   indexes.
5. An audit of every raw SQL and Prisma query path to prove none escapes the transaction wrapper.

## Consequences

- Phase 2 relies on application-level scoping and composite foreign keys for tenant isolation.
  Missing a scope check remains a real risk, so cross-tenant tests are mandatory.
- The spike proves RLS behavior is viable, but not that Prisma integration is safe enough for this
  phase.
- If RLS is adopted later, it must be introduced as a tested, transaction-scoped backstop, not as a
  replacement for server-side authorization.
- The spike is intentionally disposable and is not part of the application schema.
