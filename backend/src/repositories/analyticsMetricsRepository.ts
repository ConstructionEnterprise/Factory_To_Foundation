import { prisma } from "../lib/prisma";

/**
 * Real raw-row fetchers, one per real time-series table backing the fixed
 * metric catalog (analyticsCatalog.ts). Each returns only the fields the
 * service layer needs to bucket/aggregate -- no metric-specific logic
 * lives here, just real reads.
 */

export function findLogisticsCustodyEventsInRange(start: Date, end: Date) {
  return prisma.logisticsCustodyEvent.findMany({
    where: { changedAt: { gte: start, lte: end } },
    select: { changedAt: true },
  });
}

export function findScheduleTaskStatusEventsInRange(start: Date, end: Date) {
  return prisma.scheduleTaskStatusEvent.findMany({
    where: { changedAt: { gte: start, lte: end } },
    select: { changedAt: true },
  });
}

export function findInstructionExecutionsInRange(start: Date, end: Date) {
  return prisma.instructionExecution.findMany({
    where: { executedAt: { gte: start, lte: end } },
    select: { executedAt: true, ok: true },
  });
}

export function findModuleSequenceEventsInRange(start: Date, end: Date) {
  return prisma.moduleSequenceEvent.findMany({
    where: { changedAt: { gte: start, lte: end } },
    select: { changedAt: true },
  });
}
