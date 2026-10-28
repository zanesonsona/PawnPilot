import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BranchStatus, Prisma, UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service.js";
import type { AuthActor } from "../auth/auth.types.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthActor) {
    const companyId = this.companyId(actor);

    if (actor.user?.role === UserRole.BRANCH_OPERATOR && actor.user) {
      const branches = await this.prisma.branch.findMany({
        where: {
          companyId,
          status: BranchStatus.ACTIVE,
          userBranches: { some: { userId: actor.user.id } },
        },
        orderBy: { name: "asc" },
      });

      return branches.map((branch) => this.toPublic(branch));
    }

    const branches = await this.prisma.branch.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    });

    return branches.map((branch) => this.toPublic(branch));
  }

  async get(actor: AuthActor, branchId: string) {
    return this.toPublic(await this.assertBranchAccess(actor, branchId));
  }

  async create(
    actor: AuthActor,
    input: { code: string; name: string },
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    this.assertOwner(actor);
    const companyId = this.companyId(actor);

    try {
      const branch = await this.prisma.branch.create({
        data: {
          companyId,
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
        },
      });

      await this.audit.record({
        companyId,
        actorAccountId: actor.accountId,
        action: "tenant.branch.created",
        entityType: "branch",
        entityId: branch.id,
        metadata: { code: branch.code },
        ipAddress,
        userAgent,
      });

      return this.toPublic(branch);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "BRANCH_CODE_TAKEN",
          message: "That branch code is already in use.",
        });
      }

      throw error;
    }
  }

  async update(
    actor: AuthActor,
    branchId: string,
    input: { name?: string; status?: BranchStatus },
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    this.assertOwner(actor);
    const branch = await this.assertBranchAccess(actor, branchId);

    if (input.name === undefined && input.status === undefined) {
      throw new BadRequestException({
        code: "BRANCH_UPDATE_EMPTY",
        message: "Provide a name or status to update.",
      });
    }

    const updated = await this.prisma.branch.update({
      where: { id: branch.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    await this.audit.record({
      companyId: branch.companyId,
      actorAccountId: actor.accountId,
      action: "tenant.branch.updated",
      entityType: "branch",
      entityId: branch.id,
      metadata: { name: input.name, status: input.status },
      ipAddress,
      userAgent,
    });

    return this.toPublic(updated);
  }

  async assertBranchAccess(actor: AuthActor, branchId: string) {
    const companyId = this.companyId(actor);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId },
    });

    if (!branch) {
      throw new NotFoundException({
        code: "BRANCH_NOT_FOUND",
        message: "Branch not found.",
      });
    }

    if (branch.status !== BranchStatus.ACTIVE) {
      throw new ForbiddenException({
        code: "BRANCH_INACTIVE",
        message: "That branch is inactive.",
      });
    }

    if (actor.user?.role === UserRole.BRANCH_OPERATOR && actor.user) {
      const assignment = await this.prisma.userBranch.findUnique({
        where: {
          companyId_userId_branchId: {
            companyId,
            userId: actor.user.id,
            branchId: branch.id,
          },
        },
      });

      if (!assignment) {
        throw new ForbiddenException({
          code: "BRANCH_ACCESS_DENIED",
          message: "You are not assigned to that branch.",
        });
      }
    }

    return branch;
  }

  private assertOwner(actor: AuthActor): void {
    if (actor.user?.role !== UserRole.COMPANY_OWNER) {
      throw new ForbiddenException({
        code: "OWNER_REQUIRED",
        message: "Only the Company Owner can manage branches.",
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

  private toPublic(branch: {
    id: string;
    code: string;
    name: string;
    status: BranchStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      status: branch.status,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }
}
