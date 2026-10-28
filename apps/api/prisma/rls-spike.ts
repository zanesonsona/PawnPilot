import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const schema = "rls_spike";
const table = `${schema}.items`;
const role = "pawnpilot_rls_spike";

type Row = { company_id: string };

async function main(): Promise<void> {
  await cleanup();

  try {
    await prisma.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${table} (
        id uuid PRIMARY KEY,
        company_id uuid NOT NULL,
        label text NOT NULL
      )`,
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    await prisma.$executeRawUnsafe(
      `CREATE POLICY tenant_isolation ON ${table}
        FOR ALL
        USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid)
        WITH CHECK (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid)`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${role}`);

    const companyA = randomUUID();
    const companyB = randomUUID();

    await prisma.$transaction(async (tx) => {
      await setTenantContext(tx, companyA);
      await tx.$executeRawUnsafe(
        `INSERT INTO ${table} (id, company_id, label) VALUES ($1::uuid, $2::uuid, $3)`,
        randomUUID(),
        companyA,
        "company-a",
      );

      const rows = await tx.$queryRawUnsafe<Row[]>(`SELECT company_id::text FROM ${table}`);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.company_id, companyA);

      let blocked = false;

      try {
        await tx.$executeRawUnsafe(
          `INSERT INTO ${table} (id, company_id, label) VALUES ($1::uuid, $2::uuid, $3)`,
          randomUUID(),
          companyB,
          "company-b",
        );
      } catch {
        blocked = true;
      }

      assert.equal(blocked, true, "RLS must reject an insert for another tenant");
    });

    await prisma.$transaction(async (tx) => {
      await setTenantContext(tx, companyB);
      await tx.$executeRawUnsafe(
        `INSERT INTO ${table} (id, company_id, label) VALUES ($1::uuid, $2::uuid, $3)`,
        randomUUID(),
        companyB,
        "company-b",
      );

      const rows = await tx.$queryRawUnsafe<Row[]>(`SELECT company_id::text FROM ${table}`);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.company_id, companyB);
    });

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      const rows = await tx.$queryRawUnsafe<Row[]>(`SELECT company_id::text FROM ${table}`);
      assert.equal(rows.length, 0, "A missing tenant context must not expose rows");
    });

    const leakedContext = await prisma.$queryRawUnsafe<{ value: string | null }[]>(
      "SELECT current_setting('app.company_id', true) AS value",
    );
    assert.ok(
      !leakedContext[0]?.value,
      "Transaction local context must not leak a tenant id across pool checkouts",
    );

    console.log(
      "RLS spike passed: transaction-local tenant context isolates reads and writes, " +
        "missing context returns no rows, and context does not leak across pool checkouts.",
    );
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

async function setTenantContext(
  tx: Pick<PrismaClient, "$executeRawUnsafe" | "$queryRawUnsafe">,
  companyId: string,
): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
  await tx.$queryRawUnsafe("SELECT set_config('app.company_id', $1, true)", companyId);
}

async function cleanup(): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${role}`);
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
