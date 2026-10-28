import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AccountStatus,
  AccountType,
  CompanyStatus,
  InvitationStatus,
  MfaChallengePurpose,
  Prisma,
  UserRole,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service.js";
import { EmailService } from "../email/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { LoginDto, AcceptInvitationDto, PlatformLoginDto } from "./auth.dto.js";
import type { AuthActor, LoginResult, PublicActor } from "./auth.types.js";
import { generateToken, hashToken } from "./cookies.js";
import { PasswordService } from "./password.service.js";
import { SessionService } from "./session.service.js";
import { TotpService } from "./totp.service.js";

type AccountWithRelations = Prisma.AccountGetPayload<{
  include: { user: true; company: true };
}>;

type InvitationSummary = {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
};

const MAX_FAILED_LOGINS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_FAILURES = 20;

@Injectable()
export class AuthService {
  private readonly invitationTtlMs: number;
  private readonly passwordResetTtlMs: number;
  private readonly ipFailures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly totp: TotpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    config: ConfigService,
  ) {
    this.invitationTtlMs = (config.get<number>("INVITATION_TTL_HOURS") ?? 72) * 60 * 60 * 1000;
    this.passwordResetTtlMs = (config.get<number>("PASSWORD_RESET_TTL_MINUTES") ?? 30) * 60 * 1000;
  }

  async loginTenant(
    dto: LoginDto,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<LoginResult> {
    this.assertIpAllowed(ipAddress);
    const identifier = dto.identifier.trim();
    const account = identifier.includes("@")
      ? await this.prisma.account.findUnique({
          where: { email: identifier.toLowerCase() },
          include: { user: true, company: true },
        })
      : await this.findUsernameAccount(identifier, dto.companySlug);

    return this.authenticate(account, dto.password, AccountType.TENANT_USER, ipAddress, userAgent);
  }

  async loginPlatform(
    dto: PlatformLoginDto,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<LoginResult> {
    this.assertIpAllowed(ipAddress);
    const account = await this.prisma.account.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: { user: true, company: true },
    });

    return this.authenticate(
      account,
      dto.password,
      AccountType.PLATFORM_ADMIN,
      ipAddress,
      userAgent,
    );
  }

  async verifyMfa(
    challengeToken: string,
    code: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<LoginResult> {
    this.assertIpAllowed(ipAddress);
    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { tokenHash: hashToken(challengeToken) },
      include: {
        account: {
          include: { user: true, company: true },
        },
      },
    });

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.purpose !== MfaChallengePurpose.LOGIN ||
      challenge.expiresAt.getTime() <= Date.now() ||
      challenge.account.status !== AccountStatus.ACTIVE
    ) {
      throw new UnauthorizedException({
        code: "MFA_CHALLENGE_INVALID",
        message: "That verification request is no longer valid. Sign in again.",
      });
    }

    const secret = this.totp.decryptSecret(challenge.account.mfaSecretEncrypted);
    let recoveryCodeId: string | null = null;

    if (!secret || !this.totp.verify(secret, code)) {
      const recoveryCode = await this.prisma.mfaRecoveryCode.findFirst({
        where: {
          accountId: challenge.accountId,
          codeHash: hashToken(this.normalizeRecoveryCode(code)),
          usedAt: null,
        },
      });

      if (!recoveryCode) {
        await this.recordFailedLogin(challenge.account, ipAddress, userAgent, "mfa_failed");
        throw new UnauthorizedException({
          code: "MFA_INVALID",
          message: "The verification code is incorrect.",
        });
      }

      recoveryCodeId = recoveryCode.id;
    }

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.mfaChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException({
          code: "MFA_CHALLENGE_INVALID",
          message: "That verification request is no longer valid. Sign in again.",
        });
      }

      if (recoveryCodeId) {
        const used = await tx.mfaRecoveryCode.updateMany({
          where: { id: recoveryCodeId, usedAt: null },
          data: { usedAt: new Date() },
        });

        if (used.count !== 1) {
          throw new UnauthorizedException({
            code: "MFA_INVALID",
            message: "The verification code is incorrect.",
          });
        }
      }
    });

    return this.issueSession(challenge.account, ipAddress, userAgent);
  }

  async startPlatformMfaEnrollment(
    challengeToken: string,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const challenge = await this.findMfaChallenge(challengeToken, MfaChallengePurpose.SETUP);

    if (challenge.account.type !== AccountType.PLATFORM_ADMIN) {
      throw new UnauthorizedException({
        code: "MFA_CHALLENGE_INVALID",
        message: "That verification request is no longer valid. Sign in again.",
      });
    }

    if (challenge.account.mfaEnabled) {
      throw new ConflictException({
        code: "MFA_ALREADY_ENABLED",
        message: "MFA is already enabled for this account. Sign in again.",
      });
    }

    const secret = this.totp.generateSecret();
    await this.prisma.account.update({
      where: { id: challenge.accountId },
      data: { mfaPendingSecretEncrypted: this.totp.encryptSecret(secret) },
    });

    return {
      secret,
      otpauthUrl: this.totp.otpauthUrl(
        challenge.account.email ?? challenge.account.displayName,
        secret,
      ),
    };
  }

  async confirmPlatformMfaEnrollment(
    challengeToken: string,
    code: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<LoginResult> {
    const challenge = await this.findMfaChallenge(challengeToken, MfaChallengePurpose.SETUP);

    if (challenge.account.type !== AccountType.PLATFORM_ADMIN) {
      throw new UnauthorizedException({
        code: "MFA_CHALLENGE_INVALID",
        message: "That verification request is no longer valid. Sign in again.",
      });
    }

    const pendingSecret = this.totp.decryptSecret(challenge.account.mfaPendingSecretEncrypted);

    if (!pendingSecret || !this.totp.verify(pendingSecret, code)) {
      await this.recordFailedLogin(challenge.account, ipAddress, userAgent, "mfa_setup_failed");
      throw new BadRequestException({
        code: "MFA_INVALID",
        message: "The verification code is incorrect.",
      });
    }

    const recoveryCodes = await this.enableMfa(
      challenge.account,
      pendingSecret,
      challenge.id,
      ipAddress,
      userAgent,
    );
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: challenge.accountId },
      include: { user: true, company: true },
    });

    return this.issueSession(account, ipAddress, userAgent, recoveryCodes);
  }

  async acceptInvitation(
    dto: AcceptInvitationDto,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<LoginResult> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      include: { company: true },
    });

    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt.getTime() <= Date.now() ||
      invitation.company.status !== CompanyStatus.ACTIVE
    ) {
      throw new BadRequestException({
        code: "INVITATION_INVALID",
        message: "That invitation is invalid or has expired.",
      });
    }

    if (invitation.role === UserRole.BRANCH_OPERATOR) {
      throw new BadRequestException({
        code: "INVITATION_INVALID",
        message: "That invitation cannot be accepted through this flow.",
      });
    }

    this.passwords.validate(dto.password);
    const passwordHash = await this.passwords.hash(dto.password);
    const displayName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;

    let accountId: string;

    try {
      accountId = await this.prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            type: AccountType.TENANT_USER,
            status: AccountStatus.ACTIVE,
            email: invitation.email,
            companyId: invitation.companyId,
            displayName,
            passwordHash,
          },
        });

        await tx.user.create({
          data: {
            companyId: invitation.companyId,
            accountId: account.id,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            role: invitation.role,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
        });

        await this.audit.record(
          {
            companyId: invitation.companyId,
            actorAccountId: account.id,
            action: "invitation.accepted",
            entityType: "invitation",
            entityId: invitation.id,
            metadata: { role: invitation.role },
            ipAddress,
            userAgent,
          },
          tx,
        );

        return account.id;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ACCOUNT_EXISTS",
          message: "An account with this email already exists.",
        });
      }

      throw error;
    }

    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: { user: true, company: true },
    });

    return this.issueSession(account, ipAddress, userAgent);
  }

  async getMe(actor: AuthActor): Promise<PublicActor> {
    return this.getPublicActor(actor.accountId);
  }

  async logout(
    actor: AuthActor,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    await this.sessions.revoke(actor.sessionId);
    await this.audit.record({
      companyId: actor.companyId,
      actorAccountId: actor.accountId,
      action: "auth.logout",
      entityType: "session",
      entityId: actor.sessionId,
      ipAddress,
      userAgent,
    });
  }

  async changePassword(
    actor: AuthActor,
    currentPassword: string,
    newPassword: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    this.passwords.validate(newPassword);
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: actor.accountId } });

    if (!(await this.passwords.verify(account.passwordHash, currentPassword))) {
      throw new BadRequestException({
        code: "CURRENT_PASSWORD_INVALID",
        message: "The current password is incorrect.",
      });
    }

    const passwordHash = await this.passwords.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: account.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { accountId: account.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.mfaChallenge.updateMany({
        where: { accountId: account.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    });
    await this.sessions.revokeAllForAccount(account.id, actor.sessionId);
    await this.audit.record({
      companyId: actor.companyId,
      actorAccountId: actor.accountId,
      action: "auth.password.changed",
      entityType: "account",
      entityId: actor.accountId,
      ipAddress,
      userAgent,
    });
  }

  async setupMfa(actor: AuthActor): Promise<{ secret: string; otpauthUrl: string }> {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: actor.accountId } });

    if (account.mfaEnabled) {
      throw new ConflictException({
        code: "MFA_ALREADY_ENABLED",
        message: "MFA is already enabled for this account.",
      });
    }

    const secret = this.totp.generateSecret();
    await this.prisma.account.update({
      where: { id: account.id },
      data: { mfaPendingSecretEncrypted: this.totp.encryptSecret(secret) },
    });

    return {
      secret,
      otpauthUrl: this.totp.otpauthUrl(account.email ?? account.displayName, secret),
    };
  }

  async confirmMfa(
    actor: AuthActor,
    code: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<{ recoveryCodes: string[] }> {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: actor.accountId } });
    const pendingSecret = this.totp.decryptSecret(account.mfaPendingSecretEncrypted);

    if (!pendingSecret || !this.totp.verify(pendingSecret, code)) {
      throw new BadRequestException({
        code: "MFA_INVALID",
        message: "The verification code is incorrect.",
      });
    }

    const recoveryCodes = await this.enableMfa(account, pendingSecret, null, ipAddress, userAgent);

    return { recoveryCodes };
  }

  async disableMfa(
    actor: AuthActor,
    currentPassword: string,
    code: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: actor.accountId } });

    if (!(await this.passwords.verify(account.passwordHash, currentPassword))) {
      throw new BadRequestException({
        code: "CURRENT_PASSWORD_INVALID",
        message: "The current password is incorrect.",
      });
    }

    const secret = this.totp.decryptSecret(account.mfaSecretEncrypted);

    if (!secret || !this.totp.verify(secret, code)) {
      throw new BadRequestException({
        code: "MFA_INVALID",
        message: "The verification code is incorrect.",
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: account.id },
        data: {
          mfaEnabled: false,
          mfaSecretEncrypted: null,
          mfaPendingSecretEncrypted: null,
        },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { accountId: account.id } });
      await tx.mfaChallenge.updateMany({
        where: { accountId: account.id, purpose: MfaChallengePurpose.LOGIN, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await this.audit.record(
        {
          companyId: actor.companyId,
          actorAccountId: actor.accountId,
          action: "auth.mfa.disabled",
          entityType: "account",
          entityId: actor.accountId,
          ipAddress,
          userAgent,
        },
        tx,
      );
    });
  }

  async requestPasswordReset(
    emailAddress: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    const email = emailAddress.trim().toLowerCase();
    const account = await this.prisma.account.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!account || account.status !== AccountStatus.ACTIVE) {
      return;
    }

    if (
      account.type === AccountType.TENANT_USER &&
      account.company?.status !== CompanyStatus.ACTIVE
    ) {
      return;
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + this.passwordResetTtlMs);

    await this.prisma.passwordResetToken.create({
      data: {
        accountId: account.id,
        tokenHash: hashToken(token),
        expiresAt,
      },
    });
    await this.email.sendPasswordReset({ to: email, token, expiresAt });
    await this.audit.record({
      companyId: account.companyId,
      actorAccountId: account.id,
      action: "auth.password.reset.requested",
      entityType: "account",
      entityId: account.id,
      ipAddress,
      userAgent,
    });
  }

  async completePasswordReset(
    token: string,
    newPassword: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    this.passwords.validate(newPassword);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { account: true },
    });

    if (
      !resetToken ||
      resetToken.consumedAt ||
      resetToken.expiresAt.getTime() <= Date.now() ||
      resetToken.account.status !== AccountStatus.ACTIVE
    ) {
      throw new BadRequestException({
        code: "RESET_TOKEN_INVALID",
        message: "That password reset link is invalid or has expired.",
      });
    }

    const passwordHash = await this.passwords.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: resetToken.accountId },
        data: {
          passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { accountId: resetToken.accountId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.mfaChallenge.updateMany({
        where: { accountId: resetToken.accountId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { accountId: resetToken.accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          companyId: resetToken.account.companyId,
          actorAccountId: resetToken.accountId,
          action: "auth.password.reset.completed",
          entityType: "account",
          entityId: resetToken.accountId,
          ipAddress,
          userAgent,
        },
        tx,
      );
    });
  }

  async createInvitation(input: {
    companyId: string;
    email: string;
    role: UserRole;
    createdByAccountId: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<InvitationSummary> {
    if (input.role === UserRole.BRANCH_OPERATOR) {
      throw new BadRequestException({
        code: "INVITATION_ROLE_INVALID",
        message: "Branch users are created with a username, not an email invitation.",
      });
    }

    const email = input.email.trim().toLowerCase();
    const company = await this.prisma.company.findUnique({ where: { id: input.companyId } });

    if (!company || company.status !== CompanyStatus.ACTIVE) {
      throw new BadRequestException({
        code: "COMPANY_INACTIVE",
        message: "That company is not active.",
      });
    }

    const existingAccount = await this.prisma.account.findUnique({ where: { email } });

    if (existingAccount) {
      throw new ConflictException({
        code: "ACCOUNT_EXISTS",
        message: "An account with this email already exists.",
      });
    }

    const pending = await this.prisma.invitation.findFirst({
      where: {
        companyId: input.companyId,
        email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (pending) {
      throw new ConflictException({
        code: "INVITATION_PENDING",
        message: "An invitation is already pending for this email.",
      });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + this.invitationTtlMs);
    const invitation = await this.prisma.invitation.create({
      data: {
        companyId: input.companyId,
        email,
        role: input.role,
        tokenHash: hashToken(token),
        expiresAt,
        createdByAccountId: input.createdByAccountId,
      },
    });

    await this.email.sendInvitation({
      to: email,
      companyName: company.name,
      role: input.role,
      token,
      expiresAt,
    });
    await this.audit.record({
      companyId: input.companyId,
      actorAccountId: input.createdByAccountId,
      action: "invitation.created",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email, role: input.role },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  private async findUsernameAccount(
    identifier: string,
    companySlug: string | undefined,
  ): Promise<AccountWithRelations | null> {
    if (!companySlug) {
      return null;
    }

    const company = await this.prisma.company.findUnique({
      where: { slug: companySlug.trim().toLowerCase() },
    });

    if (!company) {
      return null;
    }

    return this.prisma.account.findFirst({
      where: {
        companyId: company.id,
        username: identifier.trim().toLowerCase(),
        type: AccountType.TENANT_USER,
      },
      include: { user: true, company: true },
    });
  }

  private async authenticate(
    account: AccountWithRelations | null,
    password: string,
    expectedType: AccountType,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<LoginResult> {
    if (!account || account.type !== expectedType) {
      await this.passwords.verifyDummy(password);
      this.recordIpFailure(ipAddress);
      await this.audit.record({
        action: "auth.login.failed",
        entityType: "account",
        metadata: { reason: "unknown_identifier" },
        ipAddress,
        userAgent,
      });
      throw this.invalidCredentials();
    }

    if (account.status !== AccountStatus.ACTIVE) {
      await this.passwords.verifyDummy(password);
      this.recordIpFailure(ipAddress);
      await this.audit.record({
        companyId: account.companyId,
        action: "auth.login.failed",
        entityType: "account",
        entityId: account.id,
        metadata: { reason: "inactive_account" },
        ipAddress,
        userAgent,
      });
      throw this.invalidCredentials();
    }

    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        {
          code: "ACCOUNT_LOCKED",
          message: "Too many failed attempts. Try again later.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      account.type === AccountType.TENANT_USER &&
      (!account.company || account.company.status !== CompanyStatus.ACTIVE)
    ) {
      throw new ForbiddenException({
        code: "COMPANY_INACTIVE",
        message: "This company is not active.",
      });
    }

    if (!(await this.passwords.verify(account.passwordHash, password))) {
      await this.recordFailedLogin(account, ipAddress, userAgent, "invalid_password");
      throw this.invalidCredentials();
    }

    if (account.mfaEnabled) {
      return this.createMfaChallenge(account, MfaChallengePurpose.LOGIN);
    }

    if (account.type === AccountType.PLATFORM_ADMIN) {
      return this.createMfaChallenge(account, MfaChallengePurpose.SETUP);
    }

    return this.issueSession(account, ipAddress, userAgent);
  }

  private async recordFailedLogin(
    account: AccountWithRelations,
    ipAddress: string | null,
    userAgent: string | null,
    reason: string,
  ): Promise<void> {
    this.recordIpFailure(ipAddress);
    const failedLoginAttempts = account.failedLoginAttempts + 1;
    const lockedUntil =
      failedLoginAttempts >= MAX_FAILED_LOGINS ? new Date(Date.now() + ACCOUNT_LOCK_MS) : null;

    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        failedLoginAttempts,
        ...(lockedUntil ? { lockedUntil } : {}),
      },
    });
    await this.audit.record({
      companyId: account.companyId,
      action: "auth.login.failed",
      entityType: "account",
      entityId: account.id,
      metadata: { reason },
      ipAddress,
      userAgent,
    });
  }

  private async resetLoginFailures(accountId: string): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  private async createMfaChallenge(
    account: AccountWithRelations,
    purpose: MfaChallengePurpose,
  ): Promise<LoginResult> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.mfaChallenge.create({
      data: {
        accountId: account.id,
        purpose,
        tokenHash: hashToken(token),
        expiresAt,
      },
    });

    return {
      kind: "mfa",
      challengeToken: token,
      expiresAt: expiresAt.toISOString(),
      ...(purpose === MfaChallengePurpose.SETUP ? { mfaSetupRequired: true } : {}),
    };
  }

  private async findMfaChallenge(
    challengeToken: string,
    purpose: MfaChallengePurpose,
  ): Promise<
    Prisma.MfaChallengeGetPayload<{
      include: { account: { include: { user: true; company: true } } };
    }>
  > {
    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { tokenHash: hashToken(challengeToken) },
      include: {
        account: {
          include: { user: true, company: true },
        },
      },
    });

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.purpose !== purpose ||
      challenge.expiresAt.getTime() <= Date.now() ||
      challenge.account.status !== AccountStatus.ACTIVE
    ) {
      throw new UnauthorizedException({
        code: "MFA_CHALLENGE_INVALID",
        message: "That verification request is no longer valid. Sign in again.",
      });
    }

    return challenge;
  }

  private async enableMfa(
    account: Pick<AccountWithRelations, "id" | "companyId">,
    secret: string,
    challengeId: string | null,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<string[]> {
    const recoveryCodes = this.generateRecoveryCodes();
    const recoveryCodeRecords = recoveryCodes.map((code) => ({
      accountId: account.id,
      codeHash: hashToken(this.normalizeRecoveryCode(code)),
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: account.id },
        data: {
          mfaEnabled: true,
          mfaSecretEncrypted: this.totp.encryptSecret(secret),
          mfaPendingSecretEncrypted: null,
        },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { accountId: account.id } });
      await tx.mfaRecoveryCode.createMany({ data: recoveryCodeRecords });
      await tx.mfaChallenge.updateMany({
        where: { accountId: account.id, purpose: MfaChallengePurpose.LOGIN, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (challengeId) {
        const consumedSetup = await tx.mfaChallenge.updateMany({
          where: { id: challengeId, consumedAt: null },
          data: { consumedAt: new Date() },
        });

        if (consumedSetup.count !== 1) {
          throw new UnauthorizedException({
            code: "MFA_CHALLENGE_INVALID",
            message: "That verification request is no longer valid. Sign in again.",
          });
        }
      }

      await this.audit.record(
        {
          companyId: account.companyId,
          actorAccountId: account.id,
          action: "auth.mfa.enabled",
          entityType: "account",
          entityId: account.id,
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return recoveryCodes;
  }

  private generateRecoveryCodes(): string[] {
    return Array.from({ length: 10 }, () => {
      const raw = randomBytes(10).toString("hex").toUpperCase();
      return raw.match(/.{1,5}/gu)?.join("-") ?? raw;
    });
  }

  private normalizeRecoveryCode(code: string): string {
    return code.replace(/[\s-]/gu, "").toUpperCase();
  }

  private async issueSession(
    account: AccountWithRelations,
    ipAddress: string | null,
    userAgent: string | null,
    recoveryCodes?: string[],
  ): Promise<LoginResult> {
    const tokens = await this.sessions.create(account.id, ipAddress, userAgent);
    const actor = await this.getPublicActor(account.id);

    await this.resetLoginFailures(account.id);
    this.ipFailures.delete(ipAddress ?? "unknown");

    await this.audit.record({
      companyId: account.companyId,
      actorAccountId: account.id,
      action: "auth.login.succeeded",
      entityType: "session",
      entityId: tokens.sessionId,
      ipAddress,
      userAgent,
    });

    return {
      kind: "session",
      tokens: {
        sessionToken: tokens.sessionToken,
        csrfToken: tokens.csrfToken,
      },
      actor,
      ...(recoveryCodes ? { recoveryCodes } : {}),
    };
  }

  private async getPublicActor(accountId: string): Promise<PublicActor> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        company: true,
        user: {
          include: {
            branchAssignments: {
              include: { branch: true },
            },
          },
        },
      },
    });

    if (!account) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
    }

    let branches: PublicActor["branches"] = [];

    if (account.company && account.user) {
      if (account.user.role === UserRole.BRANCH_OPERATOR) {
        branches = account.user.branchAssignments
          .filter(({ branch }) => branch.status === "ACTIVE")
          .map(({ branch }) => ({
            id: branch.id,
            code: branch.code,
            name: branch.name,
            status: branch.status,
          }));
      } else {
        const companyBranches = await this.prisma.branch.findMany({
          where: { companyId: account.company.id, status: "ACTIVE" },
          orderBy: { name: "asc" },
        });

        branches = companyBranches.map((branch) => ({
          id: branch.id,
          code: branch.code,
          name: branch.name,
          status: branch.status,
        }));
      }
    }

    return {
      accountId: account.id,
      type: account.type,
      displayName: account.displayName,
      email: account.email,
      company: account.company
        ? {
            id: account.company.id,
            name: account.company.name,
            slug: account.company.slug,
          }
        : null,
      user: account.user
        ? {
            id: account.user.id,
            firstName: account.user.firstName,
            lastName: account.user.lastName,
            role: account.user.role,
          }
        : null,
      branches,
      mustChangePassword: account.mustChangePassword,
      mfaEnabled: account.mfaEnabled,
    };
  }

  private assertIpAllowed(ipAddress: string | null): void {
    const key = ipAddress ?? "unknown";
    const entry = this.ipFailures.get(key);

    if (entry && entry.resetAt > Date.now() && entry.count >= IP_MAX_FAILURES) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: "Too many login attempts. Try again later.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordIpFailure(ipAddress: string | null): void {
    const key = ipAddress ?? "unknown";
    const now = Date.now();
    const entry = this.ipFailures.get(key);

    if (!entry || entry.resetAt <= now) {
      this.ipFailures.set(key, { count: 1, resetAt: now + IP_WINDOW_MS });
      return;
    }

    entry.count += 1;
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: "LOGIN_FAILED",
      message: "Invalid credentials.",
    });
  }
}
