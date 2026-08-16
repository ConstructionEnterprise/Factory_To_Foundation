/**
 * Real, one-time backfill for Phase 3.3 of the 2026-08-15 Inventory/Fleet
 * rollout. Depends on backfill-vehicle-fleet.ts having already run (every
 * LogisticsTruck must have a real vehicleId first). Populates
 * LogisticsDispatch.vehicleId from its truck's already-real
 * vehicleId -- never invents a link, never touches truckId or any other
 * dispatch field. Idempotent: only processes dispatches where vehicleId
 * is still null.
 *
 *   npx tsx --env-file=.env scripts/backfill-dispatch-vehicle.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });

  console.log("=== BEFORE ===");
  const beforeTotal = await prisma.logisticsDispatch.count();
  const beforeUnlinked = await prisma.logisticsDispatch.count({ where: { vehicleId: null } });
  console.log(`logistics_dispatch: ${beforeTotal} total, ${beforeUnlinked} unlinked`);

  const unlinked = await prisma.logisticsDispatch.findMany({
    where: { vehicleId: null },
    select: { id: true, truck: { select: { vehicleId: true, identifier: true } } },
  });

  let linked = 0;
  for (const dispatch of unlinked) {
    if (!dispatch.truck.vehicleId) {
      throw new Error(
        `Dispatch ${dispatch.id}'s truck "${dispatch.truck.identifier}" has no vehicleId -- run backfill-vehicle-fleet.ts first. STOP.`
      );
    }
    await prisma.logisticsDispatch.update({ where: { id: dispatch.id }, data: { vehicleId: dispatch.truck.vehicleId } });
    linked += 1;
  }
  console.log(`Linked ${linked} real LogisticsDispatch rows to their real truck's Vehicle.`);

  console.log("=== AFTER ===");
  const afterUnlinked = await prisma.logisticsDispatch.count({ where: { vehicleId: null } });
  console.log(`logistics_dispatch: ${afterUnlinked} still unlinked`);

  if (afterUnlinked !== 0) {
    throw new Error("Backfill incomplete: some dispatches are still unlinked after the run. STOP.");
  }

  console.log("DONE. Every real LogisticsDispatch row now has a real Vehicle link, counts verified exact.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
