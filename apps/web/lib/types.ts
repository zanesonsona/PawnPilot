export type AccountType = "PLATFORM_ADMIN" | "TENANT_USER";

export type UserRole = "COMPANY_OWNER" | "HEAD_OFFICE_ADMIN" | "BRANCH_OPERATOR";

export type BranchSummary = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type Actor = {
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
  branches: BranchSummary[];
  mustChangePassword: boolean;
  mfaEnabled: boolean;
};

export type PlatformCompany = {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  currency: string;
  branchCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  };
};

export const roleLabels: Record<UserRole, string> = {
  COMPANY_OWNER: "Company owner",
  HEAD_OFFICE_ADMIN: "Head office administrator",
  BRANCH_OPERATOR: "Branch operator",
};
