"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiErrorMessage, postJson } from "@/lib/api-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");

    try {
      const result = await postJson<unknown>("/api/v1/auth/logout", {}, { csrf: true });

      if (!result.ok && result.status !== 401) {
        setError(apiErrorMessage(result.data, "Sign-out did not complete."));
        return;
      }

      router.replace("/login");
    } catch {
      setError("Sign-out did not complete. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="rounded-sm border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? (
        <p role="alert" className="mt-1 max-w-48 text-[11px] leading-4 text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
