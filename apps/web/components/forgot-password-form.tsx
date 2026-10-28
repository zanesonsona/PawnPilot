"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiErrorMessage, postJson } from "@/lib/api-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      const result = await postJson<unknown>("/api/v1/auth/password-reset/request", {
        email: email.trim(),
      });

      if (!result.ok) {
        setError(apiErrorMessage(result.data, "The reset request could not be sent."));
        return;
      }

      setMessage("If an account exists for that email, a reset link has been sent.");
    } catch {
      setError("The reset request could not be sent. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-ink">Email address</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          required
          autoFocus
          className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
        />
        <span className="mt-2 block text-xs leading-5 text-muted">
          Use the email on the owner or head office account. Branch operators should ask their head
          office administrator for a reset.
        </span>
      </label>

      {message ? (
        <p
          role="status"
          className="rounded-sm border border-brand/20 bg-brand-soft px-3 py-2 text-sm text-brand-strong"
        >
          {message}
        </p>
      ) : null}
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
        {busy ? "Sending…" : "Send reset link"}
      </button>

      <Link
        href="/login"
        className="block text-center text-sm text-muted underline decoration-rule underline-offset-4 hover:text-ink"
      >
        Back to sign in
      </Link>
    </form>
  );
}
