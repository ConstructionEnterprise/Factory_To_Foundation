/**
 * Real, one-time backfill for Phase 4.1 (2026-08-17) -- links every
 * existing real FlowPoint to a new real LogisticsFlow row, grouped by
 * real graph connectivity (FlowConnection edges), not by guessing. Each
 * connected component becomes one real LogisticsFlow. The real project is
 * resolved by finding that component's real `transportation_handoff`
 * point, reading its `assetRef` (a real LogisticsDispatch id), and using
 * that dispatch's own real `destinationProjectId` -- reading what the
 * data already states, same discipline as backfill-logistics-module-
 * identity.ts's name-parsing. A component with no resolvable
 * transportation_handoff/dispatch is NOT guessed at -- the run fails
 * loudly instead of assigning a fabricated project.
 *
 * Idempotent: only processes FlowPoint rows where flowId is still null.
 *
 * Real, deliberate type casts below (`as unknown as string | null`): this
 * script must stay runnable against a real database state BETWEEN the two
 * real migrations (nullable add, then a later NOT NULL tightening) --
 * e.g. a future production deploy, same "backfill scripts need a separate
 * explicit run per environment" lesson this project already learned. The
 * *current* schema.prisma (and the types it generates) reflects the
 * already-tightened, post-backfill state, so it disagrees with the
 * pre-backfill DB shape this script is written to handle -- a real,
 * temporary, documented mismatch, not a carelessly silenced error.
 *
 *   npx tsx --env-file=.env scripts/backfill-logistics-flow.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function findComponents(pointIds: string[], edges: { sourcePointId: string; targetPointId: string }[]): string[][] {
  const adjacency = new Map<string, Set<string>>();
  for (const id of pointIds) adjacency.set(id, new Set());
  for (const e of edges) {
    adjacency.get(e.sourcePointId)?.add(e.targetPointId);
    adjacency.get(e.targetPointId)?.add(e.sourcePointId);
  }

  const seen = new Set<string>();
  const components: string[][] = [];
  for (const id of pointIds) {
    if (seen.has(id)) continue;
    const component: string[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!seen.has(neighbor)) stack.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }),
  });

  const NULL_FLOW_ID = null as unknown as string;

  console.log("=== BEFORE ===");
  const beforeUnlinked = await prisma.flowPoint.count({ where: { flowId: NULL_FLOW_ID } });
  const beforeFlowCount = await prisma.logisticsFlow.count();
  console.log(`flow_point: ${beforeUnlinked} unlinked | logistics_flow: ${beforeFlowCount} existing`);

  const unlinkedPoints = await prisma.flowPoint.findMany({
    where: { flowId: NULL_FLOW_ID },
    select: { id: true, type: true, name: true, assetRef: true },
  });
  const allEdges = await prisma.flowConnection.findMany({ select: { sourcePointId: true, targetPointId: true } });
  const unlinkedIds = new Set(unlinkedPoints.map((p) => p.id));
  const relevantEdges = allEdges.filter((e) => unlinkedIds.has(e.sourcePointId) && unlinkedIds.has(e.targetPointId));

  const components = findComponents(
    unlinkedPoints.map((p) => p.id),
    relevantEdges
  );

  // Find the real superintendent/CEO account to author the new LogisticsFlow rows.
  const author = await prisma.user.findFirst({ where: { role: { name: "CEO" } } });
  if (!author) throw new Error("No real CEO-role user found -- cannot author LogisticsFlow rows. STOP.");

  let created = 0;
  for (const component of components) {
    const pointsById = new Map(unlinkedPoints.map((p) => [p.id, p]));
    const handoff = component.map((id) => pointsById.get(id)!).find((p) => p.type === "transportation_handoff");
    if (!handoff || !handoff.assetRef) {
      throw new Error(
        `Component [${component.join(", ")}] has no real transportation_handoff point with a real assetRef -- refusing to guess its project. STOP.`
      );
    }

    const dispatch = await prisma.logisticsDispatch.findUnique({ where: { id: handoff.assetRef } });
    if (!dispatch) {
      throw new Error(`transportation_handoff point ${handoff.id}'s assetRef "${handoff.assetRef}" is not a real LogisticsDispatch id. STOP.`);
    }

    const flow = await prisma.logisticsFlow.create({
      data: {
        name: `Logistics Flow — ${dispatch.destinationProjectId}`,
        constructionProjectId: dispatch.destinationProjectId,
        createdById: author.id,
      },
    });
    await prisma.flowPoint.updateMany({ where: { id: { in: component } }, data: { flowId: flow.id } });
    created += 1;
    console.log(`Created LogisticsFlow "${flow.name}" (${flow.id}) for ${component.length} real points, resolved via dispatch ${dispatch.id}`);
  }

  console.log(`Created ${created} real LogisticsFlow rows from ${components.length} real connected components.`);

  console.log("=== AFTER ===");
  const afterUnlinked = await prisma.flowPoint.count({ where: { flowId: NULL_FLOW_ID } });
  const afterFlowCount = await prisma.logisticsFlow.count();
  console.log(`flow_point: ${afterUnlinked} still unlinked | logistics_flow: ${afterFlowCount} total`);

  if (afterUnlinked !== 0) {
    throw new Error("Backfill incomplete: some FlowPoint rows are still unlinked after the run. STOP.");
  }
  if (afterFlowCount !== beforeFlowCount + created) {
    throw new Error(`Real count mismatch: expected ${beforeFlowCount + created} LogisticsFlow rows, found ${afterFlowCount}. STOP.`);
  }

  console.log("DONE. Every real FlowPoint row now has a real LogisticsFlow link, counts verified exact.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
