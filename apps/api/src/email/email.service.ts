import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type SentEmail = {
  kind: "invitation" | "password-reset";
  to: string;
  subject: string;
  token: string;
  actionUrl: string;
  expiresAt: Date;
  createdAt: Date;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly isProduction: boolean;
  private readonly webOrigin: string;
  readonly outbox: SentEmail[] = [];

  constructor(config: ConfigService) {
    this.isProduction = config.get<string>("NODE_ENV") === "production";
    this.webOrigin = (config.get<string>("WEB_ORIGIN") ?? "http://localhost:3000").replace(
      /\/$/u,
      "",
    );
  }

  async sendInvitation(input: {
    to: string;
    companyName: string;
    role: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const email: SentEmail = {
      kind: "invitation",
      to: input.to,
      subject: `You are invited to ${input.companyName} on PawnPilot`,
      token: input.token,
      actionUrl: `${this.webOrigin}/accept-invitation?token=${encodeURIComponent(input.token)}`,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };

    this.record(email);
    this.log(email, input.companyName, input.role);
  }

  async sendPasswordReset(input: { to: string; token: string; expiresAt: Date }): Promise<void> {
    const email: SentEmail = {
      kind: "password-reset",
      to: input.to,
      subject: "Reset your PawnPilot password",
      token: input.token,
      actionUrl: `${this.webOrigin}/reset-password?token=${encodeURIComponent(input.token)}`,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };

    this.record(email);
    this.log(email);
  }

  private record(email: SentEmail): void {
    this.outbox.push(email);

    if (this.outbox.length > 100) {
      this.outbox.shift();
    }
  }

  private log(email: SentEmail, companyName?: string, role?: string): void {
    if (this.isProduction) {
      // A real transactional email provider is not wired yet. Do not print reset or invitation
      // tokens to production logs.
      this.logger.warn(
        `Email delivery is not configured. ${email.kind} email for ${email.to} was not sent.`,
      );
      return;
    }

    this.logger.log(
      `${email.kind} email for ${email.to}${companyName ? ` (${companyName}, ${role})` : ""}. ` +
        `Development link: ${email.actionUrl}`,
    );
  }
}
