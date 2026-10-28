import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

type NavigationItem =
  | { label: string; href: string; active: true }
  | { label: string; href?: undefined; active: false };

const navigation: NavigationItem[] = [
  { label: "Dashboard", href: "/", active: true },
  { label: "Customers", active: false },
  { label: "Pawn tickets", active: false },
  { label: "Payments", active: false },
  { label: "Reports", active: false },
  { label: "Settings", active: false },
];

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden border-r border-white/10 bg-[#10251c] text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-6 py-6">
          <div
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-xl bg-[#d8a24a] font-bold text-[#10251c]"
          >
            P
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">PawnPilot</p>
            <p className="text-xs text-white/55">Foundation build</p>
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
                    className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium text-white"
                  >
                    {item.label}
                    <span className="size-1.5 rounded-full bg-[#d8a24a]" />
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-white/55"
                  >
                    {item.label}
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
                      Soon
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Phase 1</p>
          <p className="mt-2 text-sm leading-6 text-white/75">
            Foundation only. No customer or financial records exist yet.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-lg bg-brand text-sm font-bold text-white lg:hidden"
              >
                P
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  Foundation / Overview
                </p>
                <p className="text-sm font-semibold text-ink">PawnPilot</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted sm:inline-flex">
                Branch access pending
              </span>
              <span className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-strong">
                Setup mode
              </span>
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
