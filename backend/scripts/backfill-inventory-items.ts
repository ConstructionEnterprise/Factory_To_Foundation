/**
 * Real, one-time backfill for Phase 2 of the 2026-08-15 Inventory rollout
 * (docs/decisions/2026-08-15-inventory-fleet-analytics-reports-plan.md).
 * Links every existing real Asset and GenealogyNode row to a new real
 * InventoryItem row -- never invents data, never touches any other field
 * on either table. Idempotent: only processes rows where
 * inventoryItemId is still null, so a re-run after a partial failure
 * picks up exactly where it left off rather than creating duplicates.
 *
 * Snapshot-count discipline, same as promote-pilot-dataset.ts: prints
 * real before/after counts and refuses to claim success unless every
 * expected row was actually linked.
 *
 *   npx tsx --env-file=.env scripts/backfill-inventory-items.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });

  console.log("=== BEFORE ===");
  const beforeAssetTotal = await prisma.asset.count();
  const beforeAssetUnlinked = await prisma.asset.count({ where: { inventoryItemId: null } });
  const beforeNodeTotal = await prisma.genealogyNode.count();
  const beforeNodeUnlinked = await prisma.genealogyNode.count({ where: { inventoryItemId: null } });
  const beforeItemTotal = await prisma.inventoryItem.count();
  console.log(
    `asset: ${beforeAssetTotal} total, ${beforeAssetUnlinked} unlinked | genealogy_node: ${beforeNodeTotal} total, ${beforeNodeUnlinked} unlinked | inventory_item: ${beforeItemTotal} existing`
  );

  const unlinkedAssets = await prisma.asset.findMany({
    where: { inventoryItemId: null },
    select: { id: true, title: true, location: true },
  });
  for (const asset of unlinkedAssets) {
    const item = await prisma.inventoryItem.create({
      data: { title: asset.title, kind: "asset", location: asset.location },
    });
    await prisma.asset.update({ where: { id: asset.id }, data: { inventoryItemId: item.id } });
  }
  console.log(`Linked ${unlinkedAssets.length} real Asset rows to new real InventoryItem rows.`);

  const unlinkedNodes = await prisma.genealogyNode.findMany({
    where: { inventoryItemId: null },
    select: { id: true, title: true },
  });
  for (const node of unlinkedNodes) {
    const item = await prisma.inventoryItem.create({
      data: { title: node.title, kind: "genealogy_node", location: null },
    });
    await prisma.genealogyNode.update({ where: { id: node.id }, data: { inventoryItemId: item.id } });
  }
  console.log(`Linked ${unlinkedNodes.length} real GenealogyNode rows to new real InventoryItem rows.`);

  console.log("=== AFTER ===");
  const afterAssetUnlinked = await prisma.asset.count({ where: { inventoryItemId: null } });
  const afterNodeUnlinked = await prisma.genealogyNode.count({ where: { inventoryItemId: null } });
  const afterItemTotal = await prisma.inventoryItem.count();
  const afterAssetKind = await prisma.inventoryItem.count({ where: { kind: "asset" } });
  const afterNodeKind = await prisma.inventoryItem.count({ where: { kind: "genealogy_node" } });
  console.log(
    `asset: ${afterAssetUnlinked} still unlinked | genealogy_node: ${afterNodeUnlinked} still unlinked | inventory_item: ${afterItemTotal} total (${afterAssetKind} asset, ${afterNodeKind} genealogy_node)`
  );

  if (afterAssetUnlinked !== 0 || afterNodeUnlinked !== 0) {
    throw new Error("Backfill incomplete: some rows are still unlinked after the run. STOP -- do not proceed to Phase 2.3.");
  }
  if (afterItemTotal !== beforeAssetTotal + beforeNodeTotal) {
    throw new Error(
      `Real count mismatch: expected ${beforeAssetTotal + beforeNodeTotal} InventoryItem rows, found ${afterItemTotal}. STOP.`
    );
  }

  console.log("DONE. Every real Asset/GenealogyNode row now has a real InventoryItem link, counts verified exact.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
