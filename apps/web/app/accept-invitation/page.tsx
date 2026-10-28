import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth-frame";
import { AcceptInvitationForm } from "@/components/accept-invitation-form";

export const metadata: Metadata = {
  title: "Accept invitation",
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AuthFrame
      title="Join the company"
      description="Finish setting up your PawnPilot account. Your role and company access are attached to this invitation."
      footer={
        <p className="text-xs leading-5 text-muted">
          This link is single-use and expires. If it no longer works, ask the company owner or
          platform administrator for a new invitation.
        </p>
      }
    >
      {token ? null : (
        <p
          role="alert"
          className="mb-5 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          No invitation token was found in this link. Paste the token from your invitation email.
        </p>
      )}
      <AcceptInvitationForm initialToken={token} />
    </AuthFrame>
  );
}
