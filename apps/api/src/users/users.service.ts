import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccountStatus, Prisma, UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service.js";
import { AuthService } from "../auth/auth.service.js";
import type { AuthActor } from "../auth/auth.types.js";
import { PasswordService } from "../auth/password.service.js";
import { SessionService } from "../auth/session.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateBranchUserDto } from "./users.dto.js";

type ManagedUser = Prisma.UserGetPayload<{
  include: { account: true; branchAssignments: { include: { branch: true } } };
}>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthActor) {
    this.assertTenantAdmin(actor);
    const users = await this.prisma.user.findMany({
      where: { companyId: actor.companyId as string },
      include: {
        account: true,
        branchAssignments: { include: { branch: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return users.map((user) => this.toPublicUser(user));
  }

  async createBranchUser(
    actor: AuthActor,
    dto: CreateBranchUserDto,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    this.assertTenantAdmin(actor);
    const companyId = this.companyId(actor);
    const username = dto.username.trim().toLowerCase();

    const existing = await this.prisma.account.findFirst({
      where: { companyId, username },
    });

    if (existing) {
      throw new ConflictException({
        code: "USERNAME_TAKEN",
        message: "That username is already in use in this company.",
      });
    }

    const branches = await this.validateBranches(companyId, dto.branchIds);
    const temporaryPassword = this.passwords.generateTemporaryPassword();
    const passwordHash = await this.passwords.hash(temporaryPassword);
    const displayName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    const created = await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          type: "TENANT_USER",
          status: AccountStatus.ACTIVE,
          companyId,
          username,
          displayName,
          passwordHash,
          mustChangePassword: true,
        },
      });
      const user = await tx.user.create({
        data: {
          companyId,
          accountId: account.id,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: UserRole.BRANCH_OPERATOR,
        },
      });

      await tx.userBranch.createMany({
        data: branches.map((branch) => ({
          companyId,
          userId: user.id,
          branchId: branch.id,
        })),
      });
      await this.audit.record(
        {
          companyId,
          actorAccountId: actor.accountId,
          action: "tenant.user.created",
          entityType: "user",
          entityId: user.id,
          metadata: { role: UserRole.BRANCH_OPERATOR, username },
          ipAddress,
          userAgent,
        },
        tx,
      );

      return user;
    });

    const user = await this.getTarget(companyId, created.id);

    return {
      user: this.toPublicUser(user),
      temporaryPassword,
    };
  }

  async inviteHeadOffice(
    actor: AuthActor,
    email: string,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    this.assertOwner(actor);

    return this.auth.createInvitation({
      companyId: this.companyId(actor),
      email,
      role: UserRole.HEAD_OFFICE_ADMIN,
      createdByAccountId: actor.accountId,
      ipAddress,
      userAgent,
    });
  }

  async deactivate(
    actor: AuthActor,
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const target = await this.getManageableTarget(actor, userId);

    if (target.account.status === AccountStatus.DISABLED) {
      return this.toPublicUser(target);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: target.accountId },
        data: { status: AccountStatus.DISABLED },
      });
      await tx.passwordResetToken.updateMany({
        where: { accountId: target.accountId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.mfaChallenge.updateMany({
        where: { accountId: target.accountId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    });
    await this.sessions.revokeAllForAccount(target.accountId);
    await this.audit.record({
      companyId: target.companyId,
      actorAccountId: actor.accountId,
      action: "tenant.user.deactivated",
      entityType: "user",
      entityId: target.id,
      ipAddress,
      userAgent,
    });

    return this.toPublicUser(await this.getTarget(target.companyId, target.id));
  }

  async reactivate(
    actor: AuthActor,
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const target = await this.getManageableTarget(actor, userId);

    await this.prisma.account.update({
      where: { id: target.accountId },
      data: {
        status: AccountStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: true,
      },
    });
    await this.audit.record({
      companyId: target.companyId,
      actorAccountId: actor.accountId,
      action: "tenant.user.reactivated",
      entityType: "user",
      entityId: target.id,
      ipAddress,
      userAgent,
    });

    return this.toPublicUser(await this.getTarget(target.companyId, target.id));
  }

  async resetPassword(
    actor: AuthActor,
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const target = await this.getManageableTarget(actor, userId);
    const temporaryPassword = this.passwords.generateTemporaryPassword();
    const passwordHash = await this.passwords.hash(temporaryPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: target.accountId },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { accountId: target.accountId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.mfaChallenge.updateMany({
        where: { accountId: target.accountId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    });
    await this.sessions.revokeAllForAccount(target.accountId);
    await this.audit.record({
      companyId: target.companyId,
      actorAccountId: actor.accountId,
      action: "tenant.user.password_reset",
      entityType: "user",
      entityId: target.id,
      ipAddress,
      userAgent,
    });

    return { temporaryPassword };
  }

  async updateBranches(
    actor: AuthActor,
    userId: string,
    branchIds: string[],
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const target = await this.getManageableTarget(actor, userId);

    if (target.role !== UserRole.BRANCH_OPERATOR) {
      throw new BadRequestException({
        code: "BRANCH_ASSIGNMENT_INVALID",
        message: "Branch assignments apply only to branch operators.",
      });
    }

    const branches = await this.validateBranches(target.companyId, branchIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.userBranch.deleteMany({
        where: { companyId: target.companyId, userId: target.id },
      });
      await tx.userBranch.createMany({
        data: branches.map((branch) => ({
          companyId: target.companyId,
          userId: target.id,
          branchId: branch.id,
        })),
      });
      await this.audit.record(
        {
          companyId: target.companyId,
          actorAccountId: actor.accountId,
          action: "tenant.user.branches.updated",
          entityType: "user",
          entityId: target.id,
          metadata: { branchIds: branches.map((branch) => branch.id) },
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return this.toPublicUser(await this.getTarget(target.companyId, target.id));
  }

  async updateRole(
    actor: AuthActor,
    userId: string,
    role: UserRole,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    this.assertOwner(actor);

    if (role === UserRole.COMPANY_OWNER) {
      throw new BadRequestException({
        code: "ROLE_CHANGE_INVALID",
        message: "Ownership transfer is not part of Phase 2.",
      });
    }

    const target = await this.getTarget(this.companyId(actor), userId);

    if (target.role === UserRole.COMPANY_OWNER) {
      throw new ForbiddenException({
        code: "OWNER_PROTECTED",
        message: "Owner accounts cannot be changed through this endpoint.",
      });
    }

    if (role === UserRole.BRANCH_OPERATOR && target.branchAssignments.length === 0) {
      throw new BadRequestException({
        code: "BRANCH_ASSIGNMENT_REQUIRED",
        message: "Assign at least one branch before changing this user to a branch operator.",
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { role },
      });

      if (role === UserRole.HEAD_OFFICE_ADMIN) {
        await tx.userBranch.deleteMany({
          where: { companyId: target.companyId, userId: target.id },
        });
      }

      await this.audit.record(
        {
          companyId: target.companyId,
          actorAccountId: actor.accountId,
          action: "tenant.user.role.updated",
          entityType: "user",
          entityId: target.id,
          metadata: { from: target.role, to: role },
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return this.toPublicUser(await this.getTarget(target.companyId, target.id));
  }

  private async getManageableTarget(actor: AuthActor, userId: string): Promise<ManagedUser> {
    const target = await this.getTarget(this.companyId(actor), userId);

    if (target.role === UserRole.COMPANY_OWNER) {
      throw new ForbiddenException({
        code: "OWNER_PROTECTED",
        message: "Owner accounts cannot be managed through this endpoint.",
      });
    }

    if (
      actor.user?.role === UserRole.HEAD_OFFICE_ADMIN &&
      target.role !== UserRole.BRANCH_OPERATOR
    ) {
      throw new ForbiddenException({
        code: "ROLE_REQUIRED",
        message: "Head Office Administrators can manage branch users only.",
      });
    }

    return target;
  }

  private async getTarget(companyId: string, userId: string): Promise<ManagedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      include: {
        account: true,
        branchAssignments: { include: { branch: true } },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "User not found.",
      });
    }

    return user;
  }

  private async validateBranches(companyId: string, branchIds: string[]) {
    const uniqueIds = [...new Set(branchIds)];
    const branches = await this.prisma.branch.findMany({
      where: { companyId, id: { in: uniqueIds }, status: "ACTIVE" },
    });

    if (branches.length !== uniqueIds.length) {
      throw new BadRequestException({
        code: "BRANCH_INVALID",
        message: "One or more selected branches are invalid or inactive.",
      });
    }

    return branches;
  }

  private assertTenantAdmin(actor: AuthActor): void {
    if (
      !actor.user ||
      (actor.user.role !== UserRole.COMPANY_OWNER && actor.user.role !== UserRole.HEAD_OFFICE_ADMIN)
    ) {
      throw new ForbiddenException({
        code: "ROLE_REQUIRED",
        message: "Tenant administrator access is required.",
      });
    }
  }

  private assertOwner(actor: AuthActor): void {
    if (actor.user?.role !== UserRole.COMPANY_OWNER) {
      throw new ForbiddenException({
        code: "OWNER_REQUIRED",
        message: "Only the Company Owner can perform this action.",
      });
    }
  }

  private companyId(actor: AuthActor): string {
    if (!actor.companyId) {
      throw new ForbiddenException({
        code: "TENANT_ACCESS_REQUIRED",
        message: "Tenant access is required.",
      });
    }

    return actor.companyId;
  }

  private toPublicUser(user: ManagedUser) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.account.status,
      username: user.account.username,
      email: user.account.email,
      mustChangePassword: user.account.mustChangePassword,
      mfaEnabled: user.account.mfaEnabled,
      branches: user.branchAssignments.map(({ branch }) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        status: branch.status,
      })),
    };
  }
}
