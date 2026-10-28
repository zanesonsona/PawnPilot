import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { ChangePasswordForm } from "@/components/change-password-form";
import { requireActor } from "@/lib/api-server";
import { roleLabels } from "@/lib/types";

export const metadata: Metadata = {
  title: "Change password",
};

export default async function ChangePasswordPage() {
  const actor = await requireActor();

  if (!actor) {
    redirect("/login");
  }

  return (
    <AuthFrame
      title={actor.mustChangePassword ? "Set a permanent password" : "Change your password"}
      description={
        actor.mustChangePassword
          ? "Your account was created with a temporary password. Replace it before continuing."
          : "Choose a new password for your PawnPilot account."
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>{actor.displayName}</span>
          <span>
            {actor.company?.name ?? "Platform administration"}
            {actor.user ? ` · ${roleLabels[actor.user.role]}` : ""}
          </span>
        </div>
      }
    >
      <ChangePasswordForm />
    </AuthFrame>
  );
}
