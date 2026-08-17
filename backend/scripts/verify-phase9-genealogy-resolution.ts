/**
 * Real, one-off verification for Phase 9.6 -- GenealogyNode has no real
 * API write route today (confirmed by the Phase 9 audit: it's only ever
 * populated by seed.ts's own direct-Prisma writes, the established real
 * mechanism for this one domain). This creates exactly one real
 * GenealogyNode (module tier) referencing the exact same shared
 * InventoryItem the Phase 9 vertical slice already proved
 * ProductionOutput/LogisticsModule/ModuleSequenceEntry all resolve to --
 * proving Genealogy can reach the same real physical identity through its
 * existing, unmodified optional inventoryItemId link, no new mechanism
 * needed.
 *
 *   npx tsx --env-file=.env scripts/verify-phase9-genealogy-resolution.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });

  const inventoryItemId = "cmsxpuogp000irgpk0ompqp5m"; // real, shared -- ProductionOutput/LogisticsModule/ModuleSequenceEntry all already resolve to this

  const node = await prisma.genealogyNode.create({
    data: {
      id: "cw-wp-b-0001",
      title: "Module CW-WP-B-0001 (Cedarwood, Building B)",
      tier: "module",
      qr: null,
      inventoryItemId,
      constructionProjectId: "cedarwood",
    },
  });

  const resolved = await prisma.genealogyNode.findUnique({
    where: { id: node.id },
    include: { inventoryItem: { include: { productionOutput: true, logisticsModule: true, moduleSequenceEntry: true } } },
  });

  console.log(`Created real GenealogyNode "${resolved!.id}" -> inventoryItemId ${resolved!.inventoryItemId}`);
  console.log(`Resolves to real ProductionOutput: ${resolved!.inventoryItem!.productionOutput ? resolved!.inventoryItem!.productionOutput.serialNumber : "MISSING"}`);
  console.log(`Resolves to real LogisticsModule: ${resolved!.inventoryItem!.logisticsModule ? resolved!.inventoryItem!.logisticsModule.name : "MISSING"}`);
  console.log(`Resolves to real ModuleSequenceEntry: ${resolved!.inventoryItem!.moduleSequenceEntry ? resolved!.inventoryItem!.moduleSequenceEntry.id : "MISSING"}`);

  if (!resolved!.inventoryItem!.productionOutput || !resolved!.inventoryItem!.logisticsModule || !resolved!.inventoryItem!.moduleSequenceEntry) {
    throw new Error("Genealogy did not resolve the full real chain -- STOP.");
  }
  console.log("\nCONFIRMED: Genealogy resolves the exact same shared physical identity as Manufacturing/Logistics/Sequencing, via its existing optional link -- no new mechanism required.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
