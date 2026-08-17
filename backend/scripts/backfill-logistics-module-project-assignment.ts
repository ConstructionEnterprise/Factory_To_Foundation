/**
 * Real, standalone project/building resolution for LogisticsModule rows
 * (Phase 9, 2026-08-17) — deliberately separate from
 * backfill-logistics-module-identity.ts, not a broadening of it.
 *
 * Real gap this closes: that script's real trigger condition is
 * `WHERE inventoryItemId: null`, and when it runs it unconditionally
 * CREATES a new InventoryItem for every matched row. A module born from a
 * real ProductionOutput (Phase 9) already has a real, correct
 * inventoryItemId set at creation time (the exact shared identity this
 * whole phase exists to establish) — so it's invisible to that script's
 * filter, and if the filter were broadened instead of kept separate, a
 * second real InventoryItem would get minted for it, silently breaking
 * the one-shared-identity guarantee. Project/building resolution from a
 * module's own real `name` field and InventoryItem linkage are genuinely
 * independent concerns; this script does only the former, never touches
 * inventoryItemId, and is safe to run against ANY module regardless of
 * how its InventoryItem link came to exist.
 *
 * Same real parsing rule as the sibling script: `"... (ProjectFragment,
 * NodeTitle)"`, Building tier tried first, Floor tier as fallback.
 * Best-effort, never guessed — a module whose name doesn't parse, or
 * already has a real assignment, is left untouched.
 *
 *   npx tsx --env-file=.env scripts/backfill-logistics-module-project-assignment.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const NAME_PATTERN = /\(([^,]+),\s*([^)]+)\)\s*$/;

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });

  console.log("=== BEFORE ===");
  const beforeUnassigned = await prisma.logisticsModule.count({ where: { constructionProjectId: null } });
  console.log(`logistics_module: ${beforeUnassigned} real rows with no real project assignment yet`);

  const unassignedModules = await prisma.logisticsModule.findMany({
    where: { constructionProjectId: null },
    select: { id: true, name: true },
  });

  const projects = await prisma.constructionProject.findMany({ select: { id: true, title: true } });

  let resolvedProjectCount = 0;
  let resolvedBuildingCount = 0;

  for (const module of unassignedModules) {
    const match = module.name.match(NAME_PATTERN);
    if (!match) continue;

    const projectFragment = match[1].trim().toLowerCase();
    const buildingTitle = match[2].trim();

    const project = projects.find((p) => p.title.toLowerCase().startsWith(projectFragment));
    if (!project) continue;
    resolvedProjectCount += 1;

    const buildingNode =
      (await prisma.constructionTreeNode.findFirst({
        where: { projectId: project.id, objectType: "Building", title: buildingTitle },
        select: { id: true },
      })) ??
      (await prisma.constructionTreeNode.findFirst({
        where: { projectId: project.id, objectType: "Floor", title: buildingTitle },
        select: { id: true },
      }));
    if (buildingNode) resolvedBuildingCount += 1;

    await prisma.logisticsModule.update({
      where: { id: module.id },
      data: { constructionProjectId: project.id, buildingTreeNodeId: buildingNode?.id ?? null },
    });
  }

  console.log(
    `Resolved real project for ${resolvedProjectCount} of ${unassignedModules.length} unassigned modules, ` +
      `real building for ${resolvedBuildingCount} of those -- from each module's own real name field, never guessed.`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
