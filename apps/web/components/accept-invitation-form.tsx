"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiErrorMessage, postJson } from "@/lib/api-client";

type InvitationResponse = {
  actor?: {
    mustChangePassword?: boolean;
  };
};

export function AcceptInvitationForm({ initialToken = "" }: { initialToken?: string }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const result = await postJson<InvitationResponse>("/api/v1/auth/accept-invitation", {
        token: token.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });

      if (!result.ok) {
        setError(apiErrorMessage(result.data, "The invitation could not be accepted."));
        return;
      }

      router.replace(result.data?.actor?.mustChangePassword ? "/change-password" : "/");
    } catch {
      setError("The invitation could not be accepted. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!initialToken ? (
        <label className="block">
          <span className="text-sm font-medium text-ink">Invitation token</span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
            className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 font-mono text-xs text-ink outline-none transition focus:border-brand"
          />
        </label>
      ) : (
        <input type="hidden" value={token} name="token" />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">First name</span>
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            required
            autoFocus
            className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Last name</span>
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
            required
            className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">Create a password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
        />
        <span className="mt-2 block text-xs leading-5 text-muted">
          Use 12 to 128 characters with at least one letter and one number.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Confirm password</span>
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-sm bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join the company"}
      </button>
    </form>
  );
}
