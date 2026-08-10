import { prisma } from "../lib/prisma";

/** Real count, matching LogisticsModule's own schema comment: "Null while staged in the yard with no haul assigned yet." */
export function countModulesStaged(): Promise<number> {
  return prisma.logisticsModule.count({ where: { dispatchId: null } });
}

/** Real count of modules whose assigned dispatch is actively in transit. */
export function countModulesInTransit(): Promise<number> {
  return prisma.logisticsModule.count({ where: { dispatch: { status: "in_transit" } } });
}

/** Real count of real custody-event transitions into `delivered` at or after the given date — a genuine delivery date, not a fixture. */
export function countDeliveriesSince(since: Date): Promise<number> {
  return prisma.logisticsCustodyEvent.count({ where: { toStatus: "delivered", changedAt: { gte: since } } });
}
