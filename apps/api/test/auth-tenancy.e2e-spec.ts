import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AccountStatus, AccountType, UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PasswordService } from "../src/auth/password.service.js";
import { generateToken, hashToken } from "../src/auth/cookies.js";
import { EmailService } from "../src/email/email.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const runId = randomUUID().slice(0, 8);
const slugPrefix = `pp-e2e-${runId}`;
const platformEmail = `platform-${runId}@example.test`;
const platformPassword = "PlatformPass123!";
const ownerAPassword = "OwnerAPass123!";
const ownerBPassword = "OwnerBPass123!";
const hoPassword = "HeadOfficePass123!";
const branchPasswordFallback = "BranchPass123!";
const mfaPassword = "MfaUserPass123!";

type Agent = ReturnType<typeof request.agent>;
type TenantSession = {
  agent: Agent;
  csrf: string;
  userId: string;
};

describe("Phase 2 authentication and tenancy (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: EmailService;
  let platformAgent: Agent;
  let ownerAAgent: TenantSession;
  let ownerBAgent: TenantSession;
  let hoAgent: Agent;
  let branchAgent: Agent;
  let platformCsrf = "";
  let ownerACsrf = "";
  let ownerBCsrf = "";
  let hoCsrf = "";
  let branchCsrf = "";
  let platformAccountId = "";
  let companyAId = "";
  let companyBId = "";
  let branchA1Id = "";
  let branchA2Id = "";
  let branchB1Id = "";
  let ownerAUserId = "";
  let ownerBUserId = "";
  let hoUserId = "";
  let branchUserId = "";
  let branchUsername = "";
  let branchTemporaryPassword = "";
  let branchResetToken = "";
  let platformMfaSecret = "";
  let platformRecoveryCodes: string[] = [];
  let initialPlatformLogin: Record<string, unknown> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    email = app.get(EmailService);
    const passwords = app.get(PasswordService);
    const passwordHash = await passwords.hash(platformPassword);

    const platformAccount = await prisma.account.create({
      data: {
        type: AccountType.PLATFORM_ADMIN,
        status: AccountStatus.ACTIVE,
        email: platformEmail,
        displayName: "E2E Platform Admin",
        passwordHash,
      },
    });
    platformAccountId = platformAccount.id;

    platformAgent = request.agent(app.getHttpServer());
    const platformLogin = await platformAgent
      .post("/api/v1/auth/platform/login")
      .send({ email: platformEmail, password: platformPassword })
      .expect(200);
    initialPlatformLogin = platformLogin.body;
    const enrollment = await platformAgent
      .post("/api/v1/auth/mfa/enroll")
      .send({ challengeToken: platformLogin.body.challengeToken })
      .expect(200);
    platformMfaSecret = enrollment.body.secret;

    const enrollmentConfirmed = await platformAgent
      .post("/api/v1/auth/mfa/enroll/confirm")
      .send({
        challengeToken: platformLogin.body.challengeToken,
        code: generateTotp(platformMfaSecret),
      })
      .expect(200);
    platformCsrf = enrollmentConfirmed.body.csrfToken;
    platformRecoveryCodes = enrollmentConfirmed.body.recoveryCodes;

    const companyA = await createCompany(platformAgent, platformCsrf, {
      name: "E2E Company A",
      slug: `${slugPrefix}-a`,
      ownerEmail: `owner-a-${runId}@example.test`,
    });
    companyAId = companyA.company.id;

    const companyB = await createCompany(platformAgent, platformCsrf, {
      name: "E2E Company B",
      slug: `${slugPrefix}-b`,
      ownerEmail: `owner-b-${runId}@example.test`,
    });
    companyBId = companyB.company.id;

    ownerAAgent = await acceptOwnerInvitation({
      email: `owner-a-${runId}@example.test`,
      password: ownerAPassword,
      companyName: "E2E Company A",
    });
    ownerACsrf = ownerAAgent.csrf;
    ownerAUserId = ownerAAgent.userId;

    ownerBAgent = await acceptOwnerInvitation({
      email: `owner-b-${runId}@example.test`,
      password: ownerBPassword,
      companyName: "E2E Company B",
    });
    ownerBCsrf = ownerBAgent.csrf;
    ownerBUserId = ownerBAgent.userId;

    branchA1Id = await createBranch(ownerAAgent.agent, ownerACsrf, "A-1", "Company A Branch 1");
    branchA2Id = await createBranch(ownerAAgent.agent, ownerACsrf, "A-2", "Company A Branch 2");
    branchB1Id = await createBranch(ownerBAgent.agent, ownerBCsrf, "B-1", "Company B Branch 1");

    const hoInvite = await ownerAAgent.agent
      .post("/api/v1/users/invitations/head-office")
      .set("x-csrf-token", ownerACsrf)
      .send({ email: `ho-${runId}@example.test` })
      .expect(201);

    const hoToken = findEmailToken(`ho-${runId}@example.test`);
    const hoSession = await acceptTenantInvitation(hoToken, hoPassword, "E2E", "Head Office");
    hoAgent = hoSession.agent;
    hoCsrf = hoSession.csrf;
    hoUserId = hoSession.userId;

    branchUsername = `branch-${runId}`;
    const branchCreate = await ownerAAgent.agent
      .post("/api/v1/users")
      .set("x-csrf-token", ownerACsrf)
      .send({
        username: branchUsername,
        firstName: "E2E",
        lastName: "Branch User",
        branchIds: [branchA1Id],
      })
      .expect(201);

    branchUserId = branchCreate.body.user.id;
    branchTemporaryPassword = branchCreate.body.temporaryPassword;

    branchAgent = request.agent(app.getHttpServer());
    const branchLogin = await branchAgent
      .post("/api/v1/auth/login")
      .send({
        identifier: branchUsername,
        password: branchTemporaryPassword,
        companySlug: `${slugPrefix}-a`,
      })
      .expect(200);
    branchCsrf = branchLogin.body.csrfToken;

    await branchAgent
      .post("/api/v1/auth/change-password")
      .set("x-csrf-token", branchCsrf)
      .send({ currentPassword: branchTemporaryPassword, newPassword: branchPasswordFallback })
      .expect(204);

    // Keep the reference visible so the test data cannot silently drift.
    expect(hoInvite.body.role).toBe(UserRole.HEAD_OFFICE_ADMIN);
  });

  afterAll(async () => {
    if (app && prisma) {
      await cleanup();
      await app.close();
    }
  });

  it("returns actor details for an authenticated tenant user", async () => {
    const response = await ownerAAgent.agent.get("/api/v1/auth/me").expect(200);

    expect(response.body).toMatchObject({
      accountId: expect.any(String),
      type: AccountType.TENANT_USER,
      company: { id: companyAId, slug: `${slugPrefix}-a` },
      user: { id: ownerAUserId, role: UserRole.COMPANY_OWNER },
    });
    expect(response.body.company.id).not.toBe(companyBId);
  });

  it("isolates company A from company B at the tenant boundary", async () => {
    const users = await ownerAAgent.agent
      .get("/api/v1/users")
      .set("x-csrf-token", ownerACsrf)
      .expect(200);

    expect(users.body.some((user: { id: string }) => user.id === ownerBUserId)).toBe(false);
    expect(users.body.some((user: { id: string }) => user.id === ownerAUserId)).toBe(true);

    await ownerAAgent.agent.get(`/api/v1/branches/${branchB1Id}`).expect(404);

    await ownerAAgent.agent
      .get("/api/v1/branches")
      .expect(200)
      .expect((response) => {
        expect(response.body.some((branch: { id: string }) => branch.id === branchB1Id)).toBe(
          false,
        );
      });
  });

  it("limits a branch operator to assigned branches", async () => {
    const response = await branchAgent.get("/api/v1/branches").expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(branchA1Id);

    const denied = await branchAgent.get(`/api/v1/branches/${branchA2Id}`).expect(403);
    expect(denied.body.error.code).toBe("BRANCH_ACCESS_DENIED");
  });

  it("requires CSRF for authenticated state-changing requests", async () => {
    const denied = await ownerAAgent.agent
      .post("/api/v1/branches")
      .send({ code: `X-${runId}`, name: "No CSRF Branch" })
      .expect(403);
    expect(denied.body.error.code).toBe("CSRF_FAILED");
  });

  it("requires platform administrators to enroll MFA before receiving a session", () => {
    expect(initialPlatformLogin).toMatchObject({
      mfaRequired: true,
      mfaSetupRequired: true,
      challengeToken: expect.any(String),
    });
    expect(initialPlatformLogin.csrfToken).toBeUndefined();
    expect(platformRecoveryCodes).toHaveLength(10);
  });

  it("accepts a one-time recovery code and rejects replay", async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post("/api/v1/auth/platform/login")
      .send({ email: platformEmail, password: platformPassword })
      .expect(200);

    expect(login.body.mfaRequired).toBe(true);
    expect(login.body.mfaSetupRequired).toBe(false);

    const recoveryCode = platformRecoveryCodes[0] as string;
    const verified = await agent
      .post("/api/v1/auth/mfa/verify")
      .send({ challengeToken: login.body.challengeToken, code: recoveryCode })
      .expect(200);
    expect(verified.body.actor.type).toBe(AccountType.PLATFORM_ADMIN);

    const secondLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/platform/login")
      .send({ email: platformEmail, password: platformPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/mfa/verify")
      .send({ challengeToken: secondLogin.body.challengeToken, code: recoveryCode })
      .expect(401);
  });

  it("rejects replayed MFA setup challenges", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/mfa/enroll/confirm")
      .send({
        challengeToken: initialPlatformLogin.challengeToken,
        code: generateTotp(platformMfaSecret),
      })
      .expect(401);
  });

  it("allows state-changing requests from the configured web origin", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", "http://localhost:3000")
      .send({ identifier: `unknown-${runId}@example.test`, password: "WrongPass123!" })
      .expect(401);

    expect(response.body.error.code).toBe("LOGIN_FAILED");
  });

  it("rejects state-changing requests from an origin outside the allowlist", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", "https://evil.example")
      .send({ identifier: platformEmail, password: platformPassword })
      .expect(403);

    expect(response.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("keeps platform administrators out of tenant endpoints", async () => {
    const users = await platformAgent.get("/api/v1/users").expect(403);
    expect(users.body.error.code).toBe("TENANT_ACCESS_REQUIRED");

    const branches = await platformAgent.get("/api/v1/branches").expect(403);
    expect(branches.body.error.code).toBe("TENANT_ACCESS_REQUIRED");

    const companies = await platformAgent.get("/api/v1/platform/companies").expect(200);
    expect(companies.body.some((company: { id: string }) => company.id === companyAId)).toBe(true);
  });

  it("prevents a Head Office Administrator from managing tenant administrators", async () => {
    const inviteDenied = await hoAgent
      .post("/api/v1/users/invitations/head-office")
      .set("x-csrf-token", hoCsrf)
      .send({ email: `forbidden-${runId}@example.test` })
      .expect(403);
    expect(inviteDenied.body.error.code).toBe("OWNER_REQUIRED");

    const deactivateDenied = await hoAgent
      .post(`/api/v1/users/${ownerAUserId}/deactivate`)
      .set("x-csrf-token", hoCsrf)
      .expect(403);
    expect(deactivateDenied.body.error.code).toBe("OWNER_PROTECTED");

    const list = await hoAgent.get("/api/v1/users").expect(200);
    expect(list.body.some((user: { id: string }) => user.id === hoUserId)).toBe(true);
  });

  it("revokes access immediately when a branch user is deactivated", async () => {
    const branchUser = await prisma.user.findUniqueOrThrow({
      where: { id: branchUserId },
      select: { accountId: true },
    });
    branchResetToken = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        accountId: branchUser.accountId,
        tokenHash: hashToken(branchResetToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await hoAgent
      .post(`/api/v1/users/${branchUserId}/deactivate`)
      .set("x-csrf-token", hoCsrf)
      .expect(200);

    const existingSession = await branchAgent.get("/api/v1/auth/me").expect(401);
    expect(existingSession.body.error.code).toBe("SESSION_REVOKED");

    const newLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        identifier: branchUsername,
        password: branchPasswordFallback,
        companySlug: `${slugPrefix}-a`,
      })
      .expect(401);
    expect(newLogin.body.error.code).toBe("LOGIN_FAILED");
  });

  it("invalidates outstanding password-reset tokens on deactivation", async () => {
    await hoAgent
      .post(`/api/v1/users/${branchUserId}/reactivate`)
      .set("x-csrf-token", hoCsrf)
      .expect(200);

    const reset = await request(app.getHttpServer())
      .post("/api/v1/auth/password-reset/complete")
      .send({ token: branchResetToken, newPassword: "ResetAfterDeactivate123!" })
      .expect(400);

    expect(reset.body.error.code).toBe("RESET_TOKEN_INVALID");
  });

  it("revokes the current session on logout", async () => {
    await ownerBAgent.agent.post("/api/v1/auth/logout").set("x-csrf-token", ownerBCsrf).expect(204);

    const me = await ownerBAgent.agent.get("/api/v1/auth/me").expect(401);
    expect(me.body.error.code).toBe("UNAUTHORIZED");
  });

  it("does not expose platform login through the tenant login realm", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ identifier: platformEmail, password: platformPassword })
      .expect(401);
  });

  it("scopes a branch username to its company", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        identifier: branchUsername,
        password: branchPasswordFallback,
        companySlug: `${slugPrefix}-b`,
      })
      .expect(401);
  });

  it("supports TOTP enrollment and a second-factor login challenge", async () => {
    const mfaUsername = `mfa-${runId}`;
    const created = await ownerAAgent.agent
      .post("/api/v1/users")
      .set("x-csrf-token", ownerACsrf)
      .send({
        username: mfaUsername,
        firstName: "E2E",
        lastName: "MFA User",
        branchIds: [branchA1Id],
      })
      .expect(201);

    const mfaAgent = request.agent(app.getHttpServer());
    const login = await mfaAgent
      .post("/api/v1/auth/login")
      .send({
        identifier: mfaUsername,
        password: created.body.temporaryPassword,
        companySlug: `${slugPrefix}-a`,
      })
      .expect(200);

    await mfaAgent
      .post("/api/v1/auth/change-password")
      .set("x-csrf-token", login.body.csrfToken)
      .send({ currentPassword: created.body.temporaryPassword, newPassword: mfaPassword })
      .expect(204);

    const setup = await mfaAgent
      .post("/api/v1/auth/mfa/setup")
      .set("x-csrf-token", login.body.csrfToken)
      .expect(201);
    const secret = setup.body.secret as string;

    const confirmed = await mfaAgent
      .post("/api/v1/auth/mfa/confirm")
      .set("x-csrf-token", login.body.csrfToken)
      .send({ code: generateTotp(secret) })
      .expect(200);

    expect(confirmed.body.recoveryCodes).toHaveLength(10);

    await mfaAgent.get("/api/v1/auth/me").expect(200);

    await mfaAgent
      .post("/api/v1/auth/logout")
      .set("x-csrf-token", login.body.csrfToken)
      .expect(204);

    const challenged = await mfaAgent
      .post("/api/v1/auth/login")
      .send({
        identifier: mfaUsername,
        password: mfaPassword,
        companySlug: `${slugPrefix}-a`,
      })
      .expect(200);

    expect(challenged.body.mfaRequired).toBe(true);
    expect(challenged.body.challengeToken).toEqual(expect.any(String));

    const verified = await mfaAgent
      .post("/api/v1/auth/mfa/verify")
      .send({ challengeToken: challenged.body.challengeToken, code: generateTotp(secret) })
      .expect(200);

    expect(verified.body.actor.user.id).toBe(created.body.user.id);
    await mfaAgent.get("/api/v1/auth/me").expect(200);
  });

  async function createCompany(
    agent: Agent,
    csrf: string,
    input: { name: string; slug: string; ownerEmail: string },
  ) {
    return agent
      .post("/api/v1/platform/companies")
      .set("x-csrf-token", csrf)
      .send(input)
      .expect(201)
      .then((response) => response.body);
  }

  async function acceptOwnerInvitation(input: {
    email: string;
    password: string;
    companyName: string;
  }) {
    const invitation = email.outbox
      .filter((message) => message.kind === "invitation" && message.to === input.email)
      .at(-1);

    expect(invitation, `invitation email for ${input.email}`).toBeDefined();

    return acceptTenantInvitation(invitation!.token, input.password, "E2E", "Owner");
  }

  async function acceptTenantInvitation(
    token: string,
    password: string,
    firstName: string,
    lastName: string,
  ) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post("/api/v1/auth/accept-invitation")
      .send({ token, password, firstName, lastName })
      .expect(201);

    return {
      agent,
      csrf: response.body.csrfToken as string,
      userId: response.body.actor.user.id as string,
    };
  }

  async function createBranch(agent: Agent, csrf: string, code: string, name: string) {
    const response = await agent
      .post("/api/v1/branches")
      .set("x-csrf-token", csrf)
      .send({ code: `${code}-${runId}`, name })
      .expect(201);

    return response.body.id as string;
  }

  function findEmailToken(address: string): string {
    const invitation = email.outbox
      .filter((message) => message.kind === "invitation" && message.to === address)
      .at(-1);

    expect(invitation, `invitation email for ${address}`).toBeDefined();
    return invitation!.token;
  }

  async function cleanup() {
    const companies = await prisma.company.findMany({
      where: { slug: { startsWith: slugPrefix } },
      select: { id: true },
    });
    const companyIds = companies.map((company) => company.id);
    const accounts = await prisma.account.findMany({
      where: {
        OR: [{ companyId: { in: companyIds } }, { id: platformAccountId }],
      },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);

    await prisma.$transaction(async (tx) => {
      await tx.auditEvent.deleteMany({
        where: {
          OR: [{ companyId: { in: companyIds } }, { actorAccountId: { in: accountIds } }],
        },
      });
      await tx.passwordResetToken.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await tx.mfaChallenge.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await tx.mfaRecoveryCode.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await tx.session.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await tx.invitation.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.userBranch.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.user.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.account.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.branch.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.company.deleteMany({
        where: { id: { in: companyIds } },
      });
      await tx.account.deleteMany({
        where: { id: platformAccountId },
      });
    });
  }
});

function generateTotp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = secret.toUpperCase().replace(/=+$/u, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = alphabet.indexOf(character);

    if (index === -1) {
      throw new Error("Invalid base32 secret");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }

    value &= (1 << bits) - 1;
  }

  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary =
    (((digest[offset] as number) & 0x7f) << 24) |
    (((digest[offset + 1] as number) & 0xff) << 16) |
    (((digest[offset + 2] as number) & 0xff) << 8) |
    ((digest[offset + 3] as number) & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}
