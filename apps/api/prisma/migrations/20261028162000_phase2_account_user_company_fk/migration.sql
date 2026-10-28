-- Enforce account identity shape and tenant/account company consistency.
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_identity_check" CHECK (
  (
    "type" = 'PLATFORM_ADMIN'
    AND "companyId" IS NULL
    AND "email" IS NOT NULL
    AND "username" IS NULL
  )
  OR (
    "type" = 'TENANT_USER'
    AND "companyId" IS NOT NULL
    AND (
      ("email" IS NOT NULL AND "username" IS NULL)
      OR ("email" IS NULL AND "username" IS NOT NULL)
    )
  )
);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_username_format_check" CHECK (
  "username" IS NULL OR "username" ~ '^[a-z0-9][a-z0-9._-]{2,63}$'
);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_mfa_secret_check" CHECK (
  NOT "mfaEnabled" OR "mfaSecretEncrypted" IS NOT NULL
);

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_check" CHECK (
  "role" IN ('COMPANY_OWNER', 'HEAD_OFFICE_ADMIN')
);

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_accountId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "accounts_companyId_id_key" ON "accounts"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_companyId_accountId_key" ON "users"("companyId", "accountId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_accountId_fkey" FOREIGN KEY ("companyId", "accountId") REFERENCES "accounts"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
