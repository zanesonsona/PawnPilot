import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { roleLabels, type Actor } from "@/lib/types";

type AppShellProps = {
  actor: Actor;
  children: ReactNode;
};

type NavigationItem =
  { label: string; href: string; active: true } | { label: string; active: false };

const tenantNavigation: NavigationItem[] = [
  { label: "Overview", href: "/", active: true },
  { label: "Customers", active: false },
  { label: "Pawn tickets", active: false },
  { label: "Payments", active: false },
  { label: "Reports", active: false },
  { label: "Team and branches", active: false },
];

const platformNavigation: NavigationItem[] = [
  { label: "Company register", href: "/", active: true },
  { label: "Provisioning", active: false },
  { label: "Platform audit", active: false },
];

export function AppShell({ actor, children }: AppShellProps) {
  const isPlatform = actor.type === "PLATFORM_ADMIN";
  const navigation = isPlatform ? platformNavigation : tenantNavigation;
  const role = actor.user ? roleLabels[actor.user.role] : "Platform administrator";
  const scope = isPlatform
    ? "Cross-tenant"
    : actor.user?.role === "BRANCH_OPERATOR"
      ? "Assigned branches"
      : "Company-wide";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
      <aside className="hidden border-r border-white/10 bg-forest text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-6 py-6">
          <div
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-sm bg-brass font-serif text-lg font-bold text-forest"
          >
            P
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">PawnPilot</p>
            <p className="text-xs text-white/55">
              {isPlatform ? "Platform control" : (actor.company?.name ?? "Company workspace")}
            </p>
          </div>
        </div>

        <nav aria-label="Primary" className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navigation.map((item) =>
              item.active ? (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current="page"
                    className="flex items-center justify-between rounded-sm border-l-2 border-brass bg-white/10 px-3 py-2.5 text-sm font-medium text-white"
                  >
                    {item.label}
                    <span className="size-1.5 rounded-full bg-brass" />
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    className="flex items-center justify-between rounded-sm px-3 py-2.5 text-sm text-white/50"
                  >
                    {item.label}
                    <span className="rounded-sm border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
                      Later
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="m-3 border-t border-white/15 px-3 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Session scope
          </p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/50">Access</dt>
              <dd className="font-medium text-white/80">{scope}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/50">MFA</dt>
              <dd className="font-medium text-white/80">{actor.mfaEnabled ? "On" : "Off"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/50">Realm</dt>
              <dd className="font-medium text-white/80">{isPlatform ? "Platform" : "Tenant"}</dd>
            </div>
          </dl>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-sm bg-forest font-serif text-sm font-bold text-brass lg:hidden"
              >
                P
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  {isPlatform ? "Platform" : "Workspace"} / Overview
                </p>
                <p className="text-sm font-semibold text-ink">
                  {isPlatform ? "Company register" : (actor.company?.name ?? "PawnPilot")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-ink">{actor.displayName}</p>
                <p className="text-[11px] text-muted">{role}</p>
              </div>
              <span className="hidden rounded-sm border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-muted md:inline-flex">
                {isPlatform ? "Cross-tenant" : (actor.company?.slug ?? "Tenant")}
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
