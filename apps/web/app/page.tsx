import { AppShell } from "@/components/app-shell";
import { StatusCard } from "@/components/status-card";
import { SystemStatus } from "@/components/system-status";

const readyItems = [
  {
    title: "Monorepo foundation",
    description: "Next.js, NestJS, shared packages, and workspace scripts live in one repository.",
  },
  {
    title: "API and database wiring",
    description:
      "Prisma migrations, PostgreSQL configuration, health checks, and OpenAPI are set up.",
  },
  {
    title: "Quality gates",
    description:
      "Linting, strict type checking, unit tests, and a CI workflow run before features land.",
  },
];

const nextItems = [
  "Authentication with separate tenant and platform realms",
  "Company provisioning and branch access",
  "Roles, permissions, sessions, and audit events",
];

export default function Home() {
  return (
    <AppShell>
      <div className="space-y-8">
        <section className="overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.4fr_0.6fr] lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                Phase 1 · Foundation
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                A clean base for the pawnshop counter.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
                The application shell, API, database migration, and test pipeline are in place.
                Authentication and business workflows begin in Phase 2. No customer or financial
                records are stored yet.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
                Foundation mode
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-canvas p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Stack</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Frontend</dt>
                  <dd className="font-medium text-ink">Next.js 16</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Backend</dt>
                  <dd className="font-medium text-ink">NestJS 12</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Database</dt>
                  <dd className="font-medium text-ink">PostgreSQL 17</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">ORM</dt>
                  <dd className="font-medium text-ink">Prisma 6</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="system-status-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2
                id="system-status-heading"
                className="text-lg font-semibold tracking-tight text-ink"
              >
                System status
              </h2>
              <p className="mt-1 text-sm text-muted">
                Live checks through the same-origin web proxy.
              </p>
            </div>
            <p className="hidden text-xs text-muted sm:block">Auto-checked on page load</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard label="Current phase" value="Phase 1" note="Foundation · 1 of 9 phases" />
            <StatusCard
              label="API"
              value={<SystemStatus endpoint="/health/live" label="API" />}
              note="NestJS · /health/live"
            />
            <StatusCard
              label="Database"
              value={<SystemStatus endpoint="/health/ready" label="Database" />}
              note="PostgreSQL · readiness check"
            />
            <StatusCard label="Test suite" value="Pending" note="Run npm test to verify" />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-ink">What is ready</h2>
            <ul className="mt-5 space-y-4">
              {readyItems.map((item, index) => (
                <li key={item.title} className="flex gap-4">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-[#10251c] p-6 text-white sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d8a24a]">
              Next up
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">Phase 2</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-white/75">
              {nextItems.map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[#d8a24a]"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-white/50">
              Phase 2 begins only after the Phase 1 review and the open project decisions are
              confirmed.
            </p>
          </section>
        </div>

        <section className="rounded-2xl border border-dashed border-line bg-white/40 p-6">
          <h2 className="text-sm font-semibold text-ink">Implementation note</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            This screen intentionally shows no financial totals. Every future dashboard number must
            come from an authoritative, tested backend query. Placeholder metrics are not used.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
