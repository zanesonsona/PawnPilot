import Link from "next/link";
import type { ReactNode } from "react";

type AuthFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthFrame({ title, description, children, footer }: AuthFrameProps) {
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[minmax(22rem,0.85fr)_minmax(0,1.15fr)]">
      <aside className="auth-rail relative overflow-hidden px-6 py-8 text-white sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-12 lg:py-12">
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-sm bg-brass font-serif text-xl font-bold text-forest"
            >
              P
            </span>
            <span>
              <span className="block text-base font-semibold tracking-wide">PawnPilot</span>
              <span className="block text-xs text-white/55">Staff portal</span>
            </span>
          </Link>

          <div className="mt-16 max-w-md lg:mt-24">
            <p className="text-sm font-medium text-brass">A clean record is the real collateral.</p>
            <h2 className="mt-5 font-serif text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl">
              The counter moves fast. The ledger should not.
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-white/65">
              PawnPilot keeps every branch inside its own record, with staff access that follows the
              role and the assignment.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-12 max-w-md lg:mt-0">
          <div className="border-t border-white/15 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Counter sequence
            </p>
            <ol className="mt-4 grid grid-cols-3 gap-4">
              <CounterStep number="01" label="Intake" />
              <CounterStep number="02" label="Pledge" />
              <CounterStep number="03" label="Redeem" />
            </ol>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/45">
            <span>Phase 2</span>
            <span aria-hidden="true" className="size-1 rounded-full bg-brass/70" />
            <span>Authentication and tenancy</span>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-forest"
            >
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-sm bg-forest font-serif text-sm font-bold text-brass"
              >
                P
              </span>
              PawnPilot
            </Link>
          </div>

          <header>
            <h1 className="font-serif text-3xl tracking-[-0.02em] text-ink sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{description}</p>
          </header>

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-8 border-t border-rule pt-5">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

function CounterStep({ number, label }: { number: string; label: string }) {
  return (
    <li>
      <span className="block font-mono text-[11px] text-brass/80">{number}</span>
      <span className="mt-1 block text-sm font-medium text-white/85">{label}</span>
    </li>
  );
}
