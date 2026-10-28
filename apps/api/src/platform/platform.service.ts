import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { CompanyStatus, Prisma, UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service.js";
import { AuthService } from "../auth/auth.service.js";
import type { AuthActor } from "../auth/auth.types.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateCompanyDto } from "./platform.dto.js";

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async listCompanies() {
    const companies = await this.prisma.company.findMany({
      include: {
        _count: {
          select: {
            branches: true,
            users: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      timezone: company.timezone,
      currency: company.currency,
      branchCount: company._count.branches,
      userCount: company._count.users,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    }));
  }

  async createCompany(
    actor: AuthActor,
    dto: CreateCompanyDto,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const slug = dto.slug.trim().toLowerCase();
    const ownerEmail = dto.ownerEmail.trim().toLowerCase();

    if ((dto.branchName && !dto.branchCode) || (!dto.branchName && dto.branchCode)) {
      throw new BadRequestException({
        code: "BRANCH_INPUT_INCOMPLETE",
        message: "Provide both branchName and branchCode, or neither.",
      });
    }

    const existingAccount = await this.prisma.account.findUnique({
      where: { email: ownerEmail },
    });

    if (existingAccount) {
      throw new ConflictException({
        code: "ACCOUNT_EXISTS",
        message: "An account with this email already exists.",
      });
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: dto.name.trim(),
            slug,
          },
        });
        const branch =
          dto.branchName && dto.branchCode
            ? await tx.branch.create({
                data: {
                  companyId: company.id,
                  code: dto.branchCode.trim().toUpperCase(),
                  name: dto.branchName.trim(),
                },
              })
            : null;

        await this.audit.record(
          {
            companyId: company.id,
            actorAccountId: actor.accountId,
            action: "platform.company.created",
            entityType: "company",
            entityId: company.id,
            metadata: { slug, ownerEmail },
            ipAddress,
            userAgent,
          },
          tx,
        );

        return { company, branch };
      });

      const invitation = await this.auth.createInvitation({
        companyId: result.company.id,
        email: ownerEmail,
        role: UserRole.COMPANY_OWNER,
        createdByAccountId: actor.accountId,
        ipAddress,
        userAgent,
      });

      return {
        company: {
          id: result.company.id,
          name: result.company.name,
          slug: result.company.slug,
          status: result.company.status,
        },
        branch: result.branch
          ? {
              id: result.branch.id,
              code: result.branch.code,
              name: result.branch.name,
            }
          : null,
        invitation,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "COMPANY_OR_BRANCH_EXISTS",
          message: "That company slug or branch code is already in use.",
        });
      }

      throw error;
    }
  }

  async createOwnerInvitation(
    actor: AuthActor,
    companyId: string,
    email: string,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, status: CompanyStatus.ACTIVE },
    });

    if (!company) {
      throw new BadRequestException({
        code: "COMPANY_NOT_FOUND",
        message: "Active company not found.",
      });
    }

    return this.auth.createInvitation({
      companyId: company.id,
      email,
      role: UserRole.COMPANY_OWNER,
      createdByAccountId: actor.accountId,
      ipAddress,
      userAgent,
    });
  }
}
