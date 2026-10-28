import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccountStatus, CompanyStatus } from "@prisma/client";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthActor, CreateSessionResult } from "./auth.types.js";
import { CSRF_COOKIE, SESSION_COOKIE, generateToken, hashToken } from "./cookies.js";

@Injectable()
export class SessionService {
  private readonly ttlMs: number;
  private readonly secureCookies: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlMs = (config.get<number>("SESSION_TTL_HOURS") ?? 12) * 60 * 60 * 1000;
    this.secureCookies = config.get<string>("NODE_ENV") === "production";
  }

  async create(
    accountId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<CreateSessionResult> {
    const sessionToken = generateToken();
    const csrfToken = generateToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const session = await this.prisma.session.create({
      data: {
        accountId,
        tokenHash: hashToken(sessionToken),
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      sessionId: session.id,
      sessionToken,
      csrfToken,
      expiresAt,
    };
  }

  attachCookies(response: Response, tokens: { sessionToken: string; csrfToken: string }): void {
    response.cookie(SESSION_COOKIE, tokens.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secureCookies,
      path: "/",
      maxAge: this.ttlMs,
    });
    response.cookie(CSRF_COOKIE, tokens.csrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: this.secureCookies,
      path: "/",
      maxAge: this.ttlMs,
    });
  }

  clearCookies(response: Response): void {
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    response.clearCookie(CSRF_COOKIE, { path: "/" });
  }

  async resolve(sessionToken: string): Promise<AuthActor | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
      include: {
        account: {
          include: {
            user: true,
            company: true,
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const { account } = session;

    if (account.status !== AccountStatus.ACTIVE) {
      return null;
    }

    if (account.type === "TENANT_USER") {
      if (!account.user || !account.company || account.company.status !== CompanyStatus.ACTIVE) {
        return null;
      }
    }

    if (account.type === "PLATFORM_ADMIN" && account.user) {
      return null;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      accountId: account.id,
      sessionId: session.id,
      type: account.type,
      displayName: account.displayName,
      email: account.email,
      companyId: account.companyId,
      companySlug: account.company?.slug ?? null,
      mustChangePassword: account.mustChangePassword,
      mfaEnabled: account.mfaEnabled,
      user: account.user
        ? {
            id: account.user.id,
            firstName: account.user.firstName,
            lastName: account.user.lastName,
            role: account.user.role,
          }
        : null,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForAccount(accountId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        accountId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }
}
