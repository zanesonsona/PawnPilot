# PawnPilot

Multi-tenant pawnshop management SaaS for the Philippine market.

**Current status:** Phase 0 (Discovery) is complete. Phase 1 (Foundation) has **not** started.

The full architecture, data model, API plan, role matrix, unresolved business rules, security plan, testing strategy, decisions, and phase checklist are in:

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)

## Planned stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS
- **Backend:** NestJS modular monolith
- **Database:** PostgreSQL with Prisma
- **API:** Versioned REST under `/api/v1`, documented with OpenAPI
- **Auth:** Separate tenant/platform realms; opaque server-side sessions

## Development environment

The repository lives on the WSL filesystem. Run commands inside WSL, not Windows PowerShell on the UNC path.

```bash
wsl -d Debian -- bash -lc "cd /home/zane/Projects/PawnPilot && npm run lint"
```

Current baseline: `npm run lint` passes inside WSL. No test suite or build verification exists yet.

## Important

Do not start Phase 1 until the decisions in `PROJECT_PLAN.md` section 12 are approved. No production deployment or real customer data migration happens without explicit authorization.
