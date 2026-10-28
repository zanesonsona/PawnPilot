import type { AccountType, UserRole } from "@prisma/client";
import type { Request } from "express";

export type PrincipalType = "PLATFORM" | "TENANT";

export type AuthActor = {
  accountId: string;
  sessionId: string;
  type: AccountType;
  displayName: string;
  email: string | null;
  companyId: string | null;
  companySlug: string | null;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthActor;
};

export type SessionTokens = {
  sessionToken: string;
  csrfToken: string;
};

export type PublicBranch = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type PublicActor = {
  accountId: string;
  type: AccountType;
  displayName: string;
  email: string | null;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  branches: PublicBranch[];
  mustChangePassword: boolean;
  mfaEnabled: boolean;
};

export type LoginResult =
  | {
      kind: "session";
      tokens: SessionTokens;
      actor: PublicActor;
      recoveryCodes?: string[];
    }
  | {
      kind: "mfa";
      challengeToken: string;
      expiresAt: string;
      mfaSetupRequired?: boolean;
    };

export type CreateSessionResult = SessionTokens & {
  sessionId: string;
  expiresAt: Date;
};
