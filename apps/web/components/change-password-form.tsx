"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiErrorMessage, postJson } from "@/lib/api-client";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const result = await postJson<unknown>(
        "/api/v1/auth/change-password",
        { currentPassword, newPassword },
        { csrf: true },
      );

      if (!result.ok) {
        setError(apiErrorMessage(result.data, "The password could not be changed."));
        return;
      }

      router.replace("/");
    } catch {
      setError("The password could not be changed. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-ink">Current password</span>
        <input
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">New password</span>
        <input
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
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
        <span className="text-sm font-medium text-ink">Confirm new password</span>
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
        {busy ? "Saving…" : "Save new password"}
      </button>

      <Link
        href="/"
        className="block text-center text-sm text-muted underline decoration-rule underline-offset-4 hover:text-ink"
      >
        Back to dashboard
      </Link>
    </form>
  );
}
