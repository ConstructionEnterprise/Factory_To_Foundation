/**
 * Real, one-time backfill for Phase 3 of the 2026-08-17 Inventory Command
 * Ribbon rollout. Links every existing real LogisticsMaterial row to a new
 * real InventoryItem row -- same exact pattern as
 * backfill-inventory-items.ts (Asset/GenealogyNode) and
 * backfill-logistics-module-identity.ts (LogisticsModule): never invents
 * data, never touches any other field, idempotent (only processes rows
 * where inventoryItemId is still null).
 *
 *   npx tsx --env-file=.env scripts/backfill-material-inventory-items.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The generated Prisma types now reflect the POST-tightening schema
// (inventoryItemId: String, not String?) because this repo's schema.prisma
// already has the follow-up migration applied locally -- but this script
// must stay runnable against a pre-tightening DB state too (e.g. a future
// production deploy before that second migration lands there). Same
// documented cast as backfill-logistics-flow.ts's NULL_FLOW_ID.
const NULL_INVENTORY_ITEM_ID = null as unknown as string;

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });

  console.log("=== BEFORE ===");
  const beforeMaterialTotal = await prisma.logisticsMaterial.count();
  const beforeMaterialUnlinked = await prisma.logisticsMaterial.count({ where: { inventoryItemId: NULL_INVENTORY_ITEM_ID } });
  const beforeItemKindTotal = await prisma.inventoryItem.count({ where: { kind: "material" } });
  console.log(
    `logistics_material: ${beforeMaterialTotal} total, ${beforeMaterialUnlinked} unlinked | inventory_item(kind=material): ${beforeItemKindTotal} existing`
  );

  const unlinkedMaterials = await prisma.logisticsMaterial.findMany({
    where: { inventoryItemId: NULL_INVENTORY_ITEM_ID },
    select: { id: true, name: true, location: true },
  });

  for (const material of unlinkedMaterials) {
    const item = await prisma.inventoryItem.create({
      data: { title: material.name, kind: "material", location: material.location },
    });
    await prisma.logisticsMaterial.update({ where: { id: material.id }, data: { inventoryItemId: item.id } });
  }
  console.log(`Linked ${unlinkedMaterials.length} real LogisticsMaterial rows to new real InventoryItem rows.`);

  console.log("=== AFTER ===");
  const afterMaterialUnlinked = await prisma.logisticsMaterial.count({ where: { inventoryItemId: NULL_INVENTORY_ITEM_ID } });
  const afterItemKindTotal = await prisma.inventoryItem.count({ where: { kind: "material" } });
  console.log(`logistics_material: ${afterMaterialUnlinked} still unlinked | inventory_item(kind=material): ${afterItemKindTotal} total`);

  if (afterMaterialUnlinked !== 0) {
    throw new Error("Backfill incomplete: some LogisticsMaterial rows are still unlinked after the run. STOP.");
  }
  if (afterItemKindTotal !== beforeItemKindTotal + unlinkedMaterials.length) {
    throw new Error(
      `Real count mismatch: expected ${beforeItemKindTotal + unlinkedMaterials.length} InventoryItem(kind=material) rows, found ${afterItemKindTotal}. STOP.`
    );
  }

  console.log("DONE. Every real LogisticsMaterial row now has a real InventoryItem link, counts verified exact.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
