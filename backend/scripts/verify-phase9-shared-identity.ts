import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });

  const inventoryItemId = "cmsxpuogp000irgpk0ompqp5m";

  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  const output = await prisma.productionOutput.findUnique({ where: { inventoryItemId } });
  const module_ = await prisma.logisticsModule.findUnique({ where: { inventoryItemId } });
  const sequenceEntry = await prisma.moduleSequenceEntry.findUnique({ where: { inventoryItemId } });

  const totalItemsWithThisTitle = await prisma.inventoryItem.count({ where: { title: "CW-WP-B-0001" } });

  console.log("=== Phase 9 shared-identity verification ===");
  console.log(`InventoryItem: ${item ? `${item.id} (kind=${item.kind})` : "MISSING"}`);
  console.log(`ProductionOutput.inventoryItemId match: ${output ? "YES -- " + output.id : "NO REAL ROW FOUND"}`);
  console.log(`LogisticsModule.inventoryItemId match: ${module_ ? "YES -- " + module_.id : "NO REAL ROW FOUND"}`);
  console.log(`ModuleSequenceEntry.inventoryItemId match: ${sequenceEntry ? "YES -- " + sequenceEntry.id : "NO REAL ROW FOUND"}`);
  console.log(`Real InventoryItem rows titled "CW-WP-B-0001" (must be exactly 1, never a duplicate): ${totalItemsWithThisTitle}`);

  if (totalItemsWithThisTitle !== 1) {
    throw new Error(`DUPLICATE IDENTITY BUG: expected exactly 1 InventoryItem, found ${totalItemsWithThisTitle}.`);
  }
  if (!output || !module_ || !sequenceEntry) {
    throw new Error("Shared-identity chain is broken -- one or more domains failed to resolve the same real row.");
  }

  console.log("\nCONFIRMED: one real InventoryItem, three real domains (Manufacturing/Logistics/Sequencing) resolving the exact same shared physical identity. No duplication.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
