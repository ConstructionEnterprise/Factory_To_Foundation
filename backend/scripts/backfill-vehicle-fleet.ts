/**
 * Real, one-time backfill for Phase 3 of the 2026-08-15 Inventory/Fleet
 * rollout (docs/decisions/2026-08-15-inventory-fleet-analytics-reports-plan.md).
 * For every existing real LogisticsTruck row with no Vehicle link yet,
 * creates a real Vehicle row (vehicleClass="truck", identifier mirrored
 * from the truck) and a real InventoryItem row (kind="vehicle"), then
 * links truck -> vehicle -> inventoryItem. Never touches any existing
 * LogisticsTruck/LogisticsDispatch field or relation. Idempotent: only
 * processes trucks where vehicleId is still null.
 *
 * Snapshot-count discipline, same as backfill-inventory-items.ts: prints
 * real before/after counts and refuses to claim success unless every
 * truck was actually linked.
 *
 *   npx tsx --env-file=.env scripts/backfill-vehicle-fleet.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });

  console.log("=== BEFORE ===");
  const beforeTruckTotal = await prisma.logisticsTruck.count();
  const beforeTruckUnlinked = await prisma.logisticsTruck.count({ where: { vehicleId: null } });
  const beforeVehicleTotal = await prisma.vehicle.count();
  const beforeItemVehicleKind = await prisma.inventoryItem.count({ where: { kind: "vehicle" } });
  console.log(
    `logistics_truck: ${beforeTruckTotal} total, ${beforeTruckUnlinked} unlinked | vehicle: ${beforeVehicleTotal} existing | inventory_item(kind=vehicle): ${beforeItemVehicleKind} existing`
  );

  const unlinkedTrucks = await prisma.logisticsTruck.findMany({
    where: { vehicleId: null },
    select: { id: true, identifier: true },
  });
  for (const truck of unlinkedTrucks) {
    const item = await prisma.inventoryItem.create({
      data: { title: truck.identifier, kind: "vehicle", location: null },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        identifier: truck.identifier,
        vehicleClass: "truck",
        status: "active",
        location: null,
        inventoryItemId: item.id,
      },
    });
    await prisma.logisticsTruck.update({ where: { id: truck.id }, data: { vehicleId: vehicle.id } });
  }
  console.log(`Linked ${unlinkedTrucks.length} real LogisticsTruck rows to new real Vehicle + InventoryItem rows.`);

  console.log("=== AFTER ===");
  const afterTruckUnlinked = await prisma.logisticsTruck.count({ where: { vehicleId: null } });
  const afterVehicleTotal = await prisma.vehicle.count();
  const afterItemVehicleKind = await prisma.inventoryItem.count({ where: { kind: "vehicle" } });
  console.log(
    `logistics_truck: ${afterTruckUnlinked} still unlinked | vehicle: ${afterVehicleTotal} total | inventory_item(kind=vehicle): ${afterItemVehicleKind} total`
  );

  if (afterTruckUnlinked !== 0) {
    throw new Error("Backfill incomplete: some trucks are still unlinked after the run. STOP -- do not proceed to Phase 3.3.");
  }
  if (afterVehicleTotal !== beforeVehicleTotal + unlinkedTrucks.length) {
    throw new Error(
      `Real count mismatch: expected ${beforeVehicleTotal + unlinkedTrucks.length} Vehicle rows, found ${afterVehicleTotal}. STOP.`
    );
  }
  if (afterItemVehicleKind !== beforeItemVehicleKind + unlinkedTrucks.length) {
    throw new Error(
      `Real count mismatch: expected ${beforeItemVehicleKind + unlinkedTrucks.length} InventoryItem(kind=vehicle) rows, found ${afterItemVehicleKind}. STOP.`
    );
  }

  console.log("DONE. Every real LogisticsTruck row now has a real Vehicle + InventoryItem link, counts verified exact.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
