"use client";

import { useEffect, useState } from "react";
import { getStatusLabel, type ServiceStatus } from "@/lib/status";

type SystemStatusProps = {
  endpoint: string;
  label: string;
};

const dotClasses: Record<ServiceStatus, string> = {
  checking: "bg-amber-400",
  ready: "bg-emerald-500",
  degraded: "bg-amber-500",
  unavailable: "bg-rose-500",
};

const textClasses: Record<ServiceStatus, string> = {
  checking: "text-muted",
  ready: "text-emerald-700",
  degraded: "text-amber-700",
  unavailable: "text-rose-700",
};

export function SystemStatus({ endpoint, label }: SystemStatusProps) {
  const [status, setStatus] = useState<ServiceStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function check() {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setStatus("unavailable");
          return;
        }

        const payload = (await response.json()) as { status?: string };
        setStatus(payload.status === "ok" ? "ready" : "degraded");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setStatus("unavailable");
      }
    }

    void check();

    return () => controller.abort();
  }, [endpoint]);

  return (
    <span
      aria-label={`${label} status: ${getStatusLabel(status)}`}
      aria-live="polite"
      className="inline-flex items-center gap-2"
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${dotClasses[status]}`} />
      <span className={`text-base font-semibold ${textClasses[status]}`}>
        {getStatusLabel(status)}
      </span>
    </span>
  );
}
