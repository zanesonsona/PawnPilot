import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getPlatformCompanies, requireActor } from "@/lib/api-server";
import { roleLabels, type Actor, type PlatformCompany } from "@/lib/types";

export default async function Home() {
  const actor = await requireActor();

  if (actor.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <AppShell actor={actor}>
      {actor.type === "PLATFORM_ADMIN" ? (
        <PlatformRegister actor={actor} />
      ) : (
        <TenantOverview actor={actor} />
      )}
    </AppShell>
  );
}

function TenantOverview({ actor }: { actor: Actor }) {
  const role = actor.user ? roleLabels[actor.user.role] : "Staff";
  const branchScope =
    actor.user?.role === "BRANCH_OPERATOR" ? "Assigned branches only" : "All active branches";

  return (
    <div className="space-y-8">
      <section className="overflow-hidden border border-rule bg-surface">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
          <div>
            <p className="text-sm font-medium text-brand">Counter overview</p>
            <h1 className="mt-3 max-w-2xl font-serif text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
              Welcome back, {actor.user?.firstName ?? actor.displayName}.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted sm:text-base">
              Your session is tied to {actor.company?.name}. Branch access follows your role and
              assignment, and is checked again by the API on every request.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="rounded-sm border border-brand/20 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-strong">
                {role}
              </span>
              <span className="rounded-sm border border-rule bg-paper px-3 py-1.5 text-xs font-medium text-muted">
                {branchScope}
              </span>
              <span className="rounded-sm border border-rule bg-paper px-3 py-1.5 text-xs font-medium text-muted">
                MFA {actor.mfaEnabled ? "enabled" : "not enabled"}
              </span>
            </div>
          </div>

          <div className="ledger-lines border-l-0 border-rule pl-0 lg:border-l lg:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Signed-in record
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <RecordRow label="Account" value={actor.email ?? "Company username"} />
              <RecordRow label="Company" value={actor.company?.name ?? "—"} />
              <RecordRow label="Slug" value={actor.company?.slug ?? "—"} mono />
              <RecordRow label="Branches" value={String(actor.branches.length)} />
            </dl>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section aria-labelledby="branch-access-heading">
          <div className="flex items-end justify-between gap-4 border-b border-rule pb-3">
            <div>
              <h2 id="branch-access-heading" className="font-serif text-2xl text-ink">
                Branch access
              </h2>
              <p className="mt-1 text-sm text-muted">
                {actor.user?.role === "BRANCH_OPERATOR"
                  ? "Only the branches assigned to this account are listed."
                  : "Active branches in this company."}
              </p>
            </div>
            <span className="font-mono text-xs text-muted">{actor.branches.length}</span>
          </div>

          {actor.branches.length ? (
            <ul className="divide-y divide-rule">
              {actor.branches.map((branch) => (
                <li key={branch.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{branch.name}</p>
                    <p className="mt-0.5 text-xs text-muted">Branch {branch.code}</p>
                  </div>
                  <span className="rounded-sm border border-brand/20 bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-strong">
                    {branch.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-b border-rule py-8">
              <p className="text-sm font-medium text-ink">No branch access is assigned.</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted">
                Ask the company owner or head office administrator to assign a branch before
                starting counter work.
              </p>
            </div>
          )}
        </section>

        <section aria-labelledby="role-scope-heading">
          <div className="border-b border-rule pb-3">
            <h2 id="role-scope-heading" className="font-serif text-2xl text-ink">
              Role boundary
            </h2>
            <p className="mt-1 text-sm text-muted">What this account may manage.</p>
          </div>
          <ul className="mt-4 space-y-4">
            {roleScope(actor).map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-muted">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brass" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="border border-dashed border-rule bg-paper px-5 py-5">
        <h2 className="text-sm font-semibold text-ink">No financial records yet</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Customer intake, pawn tickets, payments, and reports are not implemented. This screen
          intentionally shows no financial totals; every future number must come from a tested,
          authoritative backend query.
        </p>
      </section>
    </div>
  );
}

function PlatformRegister({ actor }: { actor: Actor }) {
  return <PlatformRegisterContent actor={actor} />;
}

async function PlatformRegisterContent({ actor }: { actor: Actor }) {
  const { companies, error } = await getPlatformCompanies();

  return (
    <div className="space-y-8">
      <section className="border border-rule bg-surface px-6 py-8 sm:px-8 lg:px-10">
        <p className="text-sm font-medium text-brand">Platform control</p>
        <h1 className="mt-3 max-w-2xl font-serif text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
          The tenant register, without the tenant ledger.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Platform administrators provision companies and owner invitations. They cannot enter
          tenant financial records or use tenant endpoints.
        </p>
        <dl className="mt-7 grid gap-5 border-t border-rule pt-5 sm:grid-cols-3">
          <RecordRow label="Operating companies" value={String(companies.length)} />
          <RecordRow label="Session scope" value="Cross-tenant" />
          <RecordRow label="MFA" value={actor.mfaEnabled ? "Enabled" : "Not enabled"} />
        </dl>
      </section>

      <section aria-labelledby="company-register-heading">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-3">
          <div>
            <h2 id="company-register-heading" className="font-serif text-2xl text-ink">
              Company register
            </h2>
            <p className="mt-1 text-sm text-muted">
              Tenant status and access counts. No financial data is shown here.
            </p>
          </div>
          <span className="font-mono text-xs text-muted">{companies.length} companies</span>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}

        {companies.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-[11px] uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Company
                  </th>
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Branches
                  </th>
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Users
                  </th>
                  <th scope="col" className="py-3 font-medium">
                    Timezone
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {companies.map((company) => (
                  <CompanyRow key={company.id} company={company} />
                ))}
              </tbody>
            </table>
          </div>
        ) : !error ? (
          <div className="border-b border-rule py-8">
            <p className="text-sm font-medium text-ink">No companies have been provisioned.</p>
            <p className="mt-1 text-sm text-muted">
              Company provisioning uses the platform API in this phase; the web form follows.
            </p>
          </div>
        ) : null}
      </section>

      <section className="border border-dashed border-rule bg-paper px-5 py-5">
        <h2 className="text-sm font-semibold text-ink">Tenant data boundary</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Platform accounts and tenant accounts use separate login endpoints and separate
          authorization checks. A platform session receives a tenant-access error when it reaches a
          tenant endpoint.
        </p>
      </section>
    </div>
  );
}

function CompanyRow({ company }: { company: PlatformCompany }) {
  return (
    <tr>
      <td className="py-4 pr-4">
        <p className="font-semibold text-ink">{company.name}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted">{company.slug}</p>
      </td>
      <td className="py-4 pr-4">
        <span className="rounded-sm border border-brand/20 bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-strong">
          {company.status.toLowerCase()}
        </span>
      </td>
      <td className="py-4 pr-4 font-mono text-xs text-muted">{company.branchCount}</td>
      <td className="py-4 pr-4 font-mono text-xs text-muted">{company.userCount}</td>
      <td className="py-4 text-xs text-muted">{company.timezone}</td>
    </tr>
  );
}

function RecordRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-right text-sm font-medium text-ink ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function roleScope(actor: Actor): string[] {
  switch (actor.user?.role) {
    case "COMPANY_OWNER":
      return [
        "Manages head office administrators and branch users.",
        "Owns consolidated reporting and company continuity.",
        "Can reset staff access and deactivate accounts.",
      ];
    case "HEAD_OFFICE_ADMIN":
      return [
        "Manages branch users and branch assignments.",
        "Does not have financial reporting access by default.",
        "Cannot manage the company owner or other head office administrators.",
      ];
    case "BRANCH_OPERATOR":
      return [
        "Works only inside the branches assigned to this account.",
        "Cannot manage users, branches, or company settings.",
        "Sees no consolidated company reporting.",
      ];
    default:
      return ["Role details are not available for this account."];
  }
}
