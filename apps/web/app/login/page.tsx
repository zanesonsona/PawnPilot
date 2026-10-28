import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { LoginForm } from "@/components/login-form";
import { getCurrentActor } from "@/lib/api-server";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const actor = await getCurrentActor();

  if (actor) {
    redirect(actor.mustChangePassword ? "/change-password" : "/");
  }

  const params = await searchParams;

  return (
    <AuthFrame
      title="Sign in to the counter"
      description="Use your company email, or the username issued by your head office."
      footer={
        <p className="text-xs leading-5 text-muted">
          New company owners and head office administrators join through the invitation link sent to
          their email. Need help? Ask your company owner or platform administrator.
        </p>
      }
    >
      {params.reset ? (
        <p
          role="status"
          className="mb-5 rounded-sm border border-brand/20 bg-brand-soft px-3 py-2 text-sm text-brand-strong"
        >
          Your password has been reset. Sign in with the new password.
        </p>
      ) : null}
      <LoginForm />
    </AuthFrame>
  );
}
