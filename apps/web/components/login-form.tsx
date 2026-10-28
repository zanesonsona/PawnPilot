"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiErrorMessage, postJson } from "@/lib/api-client";
import type { Actor } from "@/lib/types";

type LoginMode = "tenant" | "platform";
type Stage = "credentials" | "mfa" | "mfa-setup" | "recovery";

type LoginResponse = {
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
  challengeToken?: string;
  expiresAt?: string;
  actor?: Actor;
  csrfToken?: string;
  recoveryCodes?: string[];
};

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("tenant");
  const [stage, setStage] = useState<Stage>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [actor, setActor] = useState<Actor | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isEmailIdentifier = identifier.includes("@");

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (mode === "tenant" && !isEmailIdentifier && !companySlug.trim()) {
      setError("Enter the company slug for a username sign-in.");
      return;
    }

    setBusy(true);

    try {
      const payload =
        mode === "platform"
          ? { email: identifier.trim(), password }
          : {
              identifier: identifier.trim(),
              password,
              ...(isEmailIdentifier ? {} : { companySlug: companySlug.trim().toLowerCase() }),
            };
      const result = await postJson<LoginResponse>(
        mode === "platform" ? "/api/v1/auth/platform/login" : "/api/v1/auth/login",
        payload,
      );

      if (!result.ok || !result.data) {
        setError(apiErrorMessage(result.data, "The email, username, or password is not correct."));
        return;
      }

      if (result.data.mfaRequired && result.data.challengeToken) {
        setChallengeToken(result.data.challengeToken);

        if (result.data.mfaSetupRequired) {
          await beginMfaEnrollment(result.data.challengeToken);
        } else {
          setStage("mfa");
        }

        return;
      }

      completeSession(result.data);
    } catch {
      setError("Sign-in could not be completed. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function beginMfaEnrollment(token: string) {
    const result = await postJson<{ secret: string; otpauthUrl: string }>(
      "/api/v1/auth/mfa/enroll",
      { challengeToken: token },
    );

    if (!result.ok || !result.data) {
      setError(apiErrorMessage(result.data, "MFA setup could not be started. Sign in again."));
      return;
    }

    setSetupSecret(result.data.secret);
    setOtpauthUrl(result.data.otpauthUrl);
    setStage("mfa-setup");
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result = await postJson<LoginResponse>("/api/v1/auth/mfa/verify", {
        challengeToken,
        code: code.trim(),
      });

      if (!result.ok || !result.data) {
        setError(apiErrorMessage(result.data, "That verification code is not valid."));
        return;
      }

      completeSession(result.data);
    } catch {
      setError("Verification could not be completed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMfaSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result = await postJson<LoginResponse>("/api/v1/auth/mfa/enroll/confirm", {
        challengeToken,
        code: code.trim(),
      });

      if (!result.ok || !result.data) {
        setError(apiErrorMessage(result.data, "That verification code is not valid."));
        return;
      }

      completeSession(result.data);
    } catch {
      setError("MFA setup could not be completed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function completeSession(response: LoginResponse) {
    setActor(response.actor ?? null);

    if (response.recoveryCodes?.length) {
      setRecoveryCodes(response.recoveryCodes);
      setStage("recovery");
      return;
    }

    finish(response.actor ?? null);
  }

  function finish(nextActor: Actor | null = actor) {
    router.replace(nextActor?.mustChangePassword ? "/change-password" : "/");
  }

  async function copyRecoveryCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function resetFlow() {
    setStage("credentials");
    setChallengeToken("");
    setSetupSecret("");
    setOtpauthUrl("");
    setRecoveryCodes([]);
    setActor(null);
    setCode("");
    setError("");
  }

  if (stage === "recovery") {
    return (
      <div className="space-y-6">
        <div className="rounded-sm border border-brass/40 bg-brass-soft/40 p-5">
          <h2 className="font-serif text-xl text-ink">Save these recovery codes now</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Each code works once if you lose access to your authenticator app. They will not be
            shown again.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-sm border border-rule bg-white/70 p-3 font-mono text-[13px] tracking-wide text-ink">
            {recoveryCodes.map((recoveryCode) => (
              <span key={recoveryCode}>{recoveryCode}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={copyRecoveryCodes}
            className="mt-3 text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
          >
            {copied ? "Copied" : "Copy codes"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => finish()}
          className="w-full rounded-sm bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          I have saved these codes
        </button>
      </div>
    );
  }

  if (stage === "mfa-setup") {
    return (
      <form onSubmit={confirmMfaSetup} className="space-y-5">
        <div className="rounded-sm border border-rule bg-white/60 p-5">
          <p className="text-sm font-semibold text-ink">Set up your authenticator app</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Add this key manually, then enter the current six-digit code. This step is required for
            platform administrators.
          </p>
          <div className="mt-4 rounded-sm border border-dashed border-rule bg-paper px-3 py-3 font-mono text-sm tracking-[0.12em] break-all">
            {setupSecret}
          </div>
          <a
            href={otpauthUrl}
            className="mt-3 inline-block text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
          >
            Open this account in an authenticator app
          </a>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">Six-digit code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 font-mono text-lg tracking-[0.3em] text-ink outline-none transition focus:border-brand"
          />
        </label>

        {error ? <FormError message={error} /> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-sm bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Confirming…" : "Confirm and sign in"}
        </button>
        <button
          type="button"
          onClick={resetFlow}
          className="w-full text-center text-sm text-muted underline decoration-rule underline-offset-4 hover:text-ink"
        >
          Start over
        </button>
      </form>
    );
  }

  if (stage === "mfa") {
    return (
      <form onSubmit={submitMfa} className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-ink">Verification code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            autoFocus
            required
            className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 font-mono text-lg tracking-[0.18em] text-ink outline-none transition focus:border-brand"
          />
          <span className="mt-2 block text-xs leading-5 text-muted">
            Enter the six-digit code from your authenticator app, or one unused recovery code.
          </span>
        </label>

        {error ? <FormError message={error} /> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-sm bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Verify and sign in"}
        </button>
        <button
          type="button"
          onClick={resetFlow}
          className="w-full text-center text-sm text-muted underline decoration-rule underline-offset-4 hover:text-ink"
        >
          Use a different account
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCredentials} className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-sm border border-rule bg-white/55 p-1">
        <ModeButton
          active={mode === "tenant"}
          onClick={() => {
            setMode("tenant");
            setError("");
          }}
        >
          Business account
        </ModeButton>
        <ModeButton
          active={mode === "platform"}
          onClick={() => {
            setMode("platform");
            setError("");
          }}
        >
          Platform admin
        </ModeButton>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">
          {mode === "platform" ? "Email address" : "Email or username"}
        </span>
        <input
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          type={mode === "platform" ? "email" : "text"}
          autoComplete={mode === "platform" || isEmailIdentifier ? "username" : "username"}
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
        />
        {mode === "tenant" ? (
          <span className="mt-2 block text-xs leading-5 text-muted">
            Branch operators sign in with the username issued by their head office.
          </span>
        ) : null}
      </label>

      {mode === "tenant" && !isEmailIdentifier && identifier.length > 0 ? (
        <label className="block">
          <span className="text-sm font-medium text-ink">Company slug</span>
          <input
            value={companySlug}
            onChange={(event) => setCompanySlug(event.target.value)}
            autoComplete="organization"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="jeromes-pawnshop"
            className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
          />
          <span className="mt-2 block text-xs leading-5 text-muted">
            Usernames are scoped to one company. The slug keeps them unambiguous.
          </span>
        </label>
      ) : null}

      <label className="block">
        <span className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
          Password
          {mode === "tenant" ? (
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
            >
              Forgot password?
            </Link>
          ) : null}
        </span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-brand"
        />
      </label>

      {error ? <FormError message={error} /> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-sm bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-xs leading-5 text-muted">
        Branch operators who cannot sign in should ask their head office administrator to reset
        their password. Platform access is limited to platform administrators.
      </p>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-sm px-3 py-2 text-sm font-medium transition ${
        active ? "bg-forest text-white" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </p>
  );
}
