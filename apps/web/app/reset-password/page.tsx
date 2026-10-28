import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth-frame";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AuthFrame
      title="Choose a new password"
      description="Set a new password for your PawnPilot account. Existing sessions will be signed out."
      footer={
        <p className="text-xs leading-5 text-muted">
          If the reset link has expired, request a new one from the sign-in screen.
        </p>
      }
    >
      {token ? null : (
        <p
          role="alert"
          className="mb-5 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          No reset token was found in this link. Paste the token from your reset email.
        </p>
      )}
      <ResetPasswordForm initialToken={token} />
    </AuthFrame>
  );
}
