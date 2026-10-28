import type { ReactNode } from "react";

type StatusCardProps = {
  label: string;
  value: ReactNode;
  note: string;
};

export function StatusCard({ label, value, note }: StatusCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(20,33,26,0.03)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-3 text-xl font-semibold tracking-tight text-ink">{value}</div>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}
