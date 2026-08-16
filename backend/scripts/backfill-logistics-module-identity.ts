/**
 * Real, one-time backfill for Phase 2.1 of the 2026-08-16 Modular
 * Sequencing rollout (docs/decisions/2026-08-16-modular-sequencing-plan.md
 * §0.2/§0.3). Links every existing real LogisticsModule row to a new real
 * InventoryItem row (mandatory, exact-count-asserted -- same discipline
 * as every prior InventoryItem backfill this rollout), and resolves a
 * real project/building assignment where the module's own free-text
 * `name` field states one clearly enough to parse honestly (best-effort,
 * NOT asserted -- a module whose name doesn't parse stays unassigned,
 * never guessed).
 *
 * Parsing rule: LogisticsModule.name matching `"... (ProjectFragment,
 * BuildingTitle)"` is resolved by finding a real ConstructionProject
 * whose title starts with ProjectFragment (case-insensitive) and a real
 * ConstructionTreeNode (objectType="Building", same project) whose title
 * exactly matches BuildingTitle. This is reading what the real field
 * already says, not inventing a new cross-reference -- unlike the
 * CWF-B-089/M24-089 case (two independently-named entities with no
 * shared field to read), this is one real field's own stated content.
 *
 *   npx tsx --env-file=.env scripts/backfill-logistics-module-identity.ts
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
  const beforeModuleTotal = await prisma.logisticsModule.count();
  const beforeModuleUnlinked = await prisma.logisticsModule.count({ where: { inventoryItemId: null } });
  const beforeItemKindTotal = await prisma.inventoryItem.count({ where: { kind: "logistics_module" } });
  console.log(
    `logistics_module: ${beforeModuleTotal} total, ${beforeModuleUnlinked} unlinked | inventory_item(kind=logistics_module): ${beforeItemKindTotal} existing`
  );

  const unlinkedModules = await prisma.logisticsModule.findMany({
    where: { inventoryItemId: null },
    select: { id: true, name: true, location: true },
  });

  const projects = await prisma.constructionProject.findMany({ select: { id: true, title: true } });

  let resolvedProjectCount = 0;
  let resolvedBuildingCount = 0;

  for (const module of unlinkedModules) {
    const item = await prisma.inventoryItem.create({
      data: { title: module.name, kind: "logistics_module", location: module.location },
    });

    let constructionProjectId: string | null = null;
    let buildingTreeNodeId: string | null = null;

    const match = module.name.match(NAME_PATTERN);
    if (match) {
      const projectFragment = match[1].trim().toLowerCase();
      const buildingTitle = match[2].trim();

      const project = projects.find((p) => p.title.toLowerCase().startsWith(projectFragment));
      if (project) {
        constructionProjectId = project.id;
        resolvedProjectCount += 1;

        const buildingNode = await prisma.constructionTreeNode.findFirst({
          where: { projectId: project.id, objectType: "Building", title: buildingTitle },
          select: { id: true },
        });
        if (buildingNode) {
          buildingTreeNodeId = buildingNode.id;
          resolvedBuildingCount += 1;
        }
      }
    }

    await prisma.logisticsModule.update({
      where: { id: module.id },
      data: { inventoryItemId: item.id, constructionProjectId, buildingTreeNodeId },
    });
  }

  console.log(
    `Linked ${unlinkedModules.length} real LogisticsModule rows to new real InventoryItem rows. ` +
      `Resolved project for ${resolvedProjectCount}, building for ${resolvedBuildingCount} (best-effort, from each module's own real name field -- unresolved stays honestly null, never guessed).`
  );

  console.log("=== AFTER ===");
  const afterModuleUnlinked = await prisma.logisticsModule.count({ where: { inventoryItemId: null } });
  const afterItemKindTotal = await prisma.inventoryItem.count({ where: { kind: "logistics_module" } });
  console.log(`logistics_module: ${afterModuleUnlinked} still unlinked | inventory_item(kind=logistics_module): ${afterItemKindTotal} total`);

  if (afterModuleUnlinked !== 0) {
    throw new Error("Backfill incomplete: some LogisticsModule rows are still unlinked after the run. STOP.");
  }
  if (afterItemKindTotal !== beforeItemKindTotal + unlinkedModules.length) {
    throw new Error(
      `Real count mismatch: expected ${beforeItemKindTotal + unlinkedModules.length} InventoryItem(kind=logistics_module) rows, found ${afterItemKindTotal}. STOP.`
    );
  }

  console.log("DONE. Every real LogisticsModule row now has a real InventoryItem link, counts verified exact.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
