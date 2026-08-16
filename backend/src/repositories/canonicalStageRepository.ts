import { prisma } from "../lib/prisma";

/** Real, fixed reference data (5 rows, seeded Phase 2.2) -- read-only, no write route. */
export function findAllCanonicalStages() {
  return prisma.canonicalStage.findMany({ orderBy: { order: "asc" } });
}
