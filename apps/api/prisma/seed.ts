import "dotenv/config";
import { AccountStatus, AccountType, PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const displayName = process.env.PLATFORM_ADMIN_DISPLAY_NAME?.trim() || "Platform Administrator";

  if (email && password) {
    const existing = await prisma.account.findUnique({ where: { email } });

    if (existing && existing.type !== AccountType.PLATFORM_ADMIN) {
      throw new Error(
        "PLATFORM_ADMIN_EMAIL is already used by a non-platform account. Refusing to seed.",
      );
    }

    if (!existing) {
      await prisma.account.create({
        data: {
          type: AccountType.PLATFORM_ADMIN,
          status: AccountStatus.ACTIVE,
          email,
          displayName,
          passwordHash: await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1,
          }),
        },
      });
      console.log(`Seeded platform administrator: ${email}`);
    } else {
      console.log(`Platform administrator already exists: ${email}`);
    }
  } else {
    console.log(
      "No platform administrator seeded. Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD to create one.",
    );
  }

  const companies = await prisma.company.count();
  console.log(
    `Phase 2 seed complete. Current company count: ${companies}. No tenant data is created by default.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
