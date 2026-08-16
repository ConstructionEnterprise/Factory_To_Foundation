/**
 * One-time, sandbox-only fix (2026-08-15): the local migration folder
 * 20260816013400_add_inventory_item was renamed to
 * 20260815200000_add_inventory_item to correct filename ordering (it was
 * timestamped after the Vehicle/Fleet migrations even though it was
 * applied first everywhere) -- see the commit renaming the folder.
 * Sandbox's own _prisma_migrations history still has the old name; this
 * brings it in line so future `prisma migrate status`/`deploy` runs don't
 * think this migration was never applied.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });
  const rows: number = await prisma.$executeRawUnsafe(
    `UPDATE _prisma_migrations SET migration_name = '20260815200000_add_inventory_item' WHERE migration_name = '20260816013400_add_inventory_item'`
  );
  console.log("rows updated:", rows);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
