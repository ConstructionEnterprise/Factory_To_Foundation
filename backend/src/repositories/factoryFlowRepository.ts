import { prisma } from "../lib/prisma";

/**
 * Real Factory Flow projection queries (Phase 10, 2026-08-18) -- reads
 * only, no new schema. Joins existing Instructions/Production/Logistics
 * records through real identities each already carries: InstructionSet's
 * own `sourceObjectId` and ProductionRun's own `sourceModelNodeId` both
 * reference the same real Manufacturing geometry node, just from two
 * independent features built at different times -- the same real-world
 * identity, not a fabricated FK.
 */

export function findRunForFlow(productionRunId: string) {
  return prisma.productionRun.findUnique({
    where: { id: productionRunId },
    include: {
      outputs: {
        include: {
          inventoryItem: {
            include: {
              logisticsModule: { include: { dispatch: true } },
              moduleSequenceEntry: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Every real InstructionSet generated for this Manufacturing node, newest first -- empty when none exist (honest absence, not an error). */
export function findInstructionSetsBySourceObjectId(sourceObjectId: string) {
  return prisma.instructionSet.findMany({
    where: { sourceObjectId },
    include: { steps: { include: { executions: true } } },
    orderBy: { generatedAt: "desc" },
  });
}

/**
 * Real End-to-End Unit Lifecycle read (Reports rebuild, 2026-08-18) -- the
 * same real chain findRunForFlow() above reads per-run, unscoped: every
 * real completed ProductionOutput across every real ProductionRun. Same
 * exact nested include, just rooted on productionOutput directly instead
 * of nested under productionRun.outputs.
 */
export function findAllCompletedOutputsForUnitLifecycle() {
  return prisma.productionOutput.findMany({
    where: { status: "complete" },
    include: {
      inventoryItem: {
        include: {
          logisticsModule: { include: { dispatch: true } },
          moduleSequenceEntry: {
            include: {
              // Real blocking-dependency read (reuses the same real
              // ModuleSequenceDependency graph moduleSequenceStatusService.ts's
              // computeEffectiveStates() walks) -- only the direct blocker's
              // own status/title is needed here, not the full transitive
              // chain that live-monitor feature computes.
              blockedDependencies: {
                include: { blockingEntry: { include: { inventoryItem: { select: { title: true } } } } },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
