import type { LogisticsCustodyEvent, LogisticsDispatch, LogisticsStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllDispatches(): Promise<LogisticsDispatch[]> {
  return prisma.logisticsDispatch.findMany({ orderBy: { dispatchedAt: "desc" } });
}

export function findDispatchById(id: string): Promise<LogisticsDispatch | null> {
  return prisma.logisticsDispatch.findUnique({ where: { id } });
}

export function findTruckById(id: string) {
  return prisma.logisticsTruck.findUnique({ where: { id } });
}

export function findDriverById(id: string) {
  return prisma.logisticsDriver.findUnique({ where: { id } });
}

/** Real validation against the actual seeded/created project — never trust a client-supplied destinationProjectId without checking it exists. */
export function findConstructionProjectById(id: string) {
  return prisma.constructionProject.findUnique({ where: { id } });
}

export type CreateDispatchInput = {
  truckId: string;
  driverId: string;
  destinationProjectId: string;
  eta: Date | null;
  route: string | null;
  traffic: string | null;
  odometerStart: number | null;
  businessPurpose: string | null;
  createdById: string;
};

/**
 * Real, atomic: the dispatch row and its own real chain-of-custody creation
 * event (fromStatus null -> toStatus staged) are written in one
 * transaction, so a dispatch can never exist without a matching first
 * custody event (or vice versa) even if the process crashes mid-write.
 */
export async function createDispatch(data: CreateDispatchInput): Promise<{ dispatch: LogisticsDispatch; event: LogisticsCustodyEvent }> {
  return prisma.$transaction(async (tx) => {
    const dispatch = await tx.logisticsDispatch.create({
      data: {
        truckId: data.truckId,
        driverId: data.driverId,
        destinationProjectId: data.destinationProjectId,
        eta: data.eta,
        route: data.route,
        traffic: data.traffic,
        odometerStart: data.odometerStart,
        businessPurpose: data.businessPurpose,
      },
    });
    const event = await tx.logisticsCustodyEvent.create({
      data: {
        dispatchId: dispatch.id,
        fromStatus: null,
        toStatus: dispatch.status,
        changedById: data.createdById,
      },
    });
    return { dispatch, event };
  });
}

export type TransitionStatusInput = {
  dispatchId: string;
  fromStatus: LogisticsStatus;
  toStatus: LogisticsStatus;
  changedById: string;
  notes: string | null;
};

/**
 * Real, atomic: the status update and its own custody event are written in
 * one transaction — the two can never drift apart (a crash between them
 * would otherwise leave either a status change with no recorded reason, or
 * an orphaned event that doesn't match the dispatch's actual current
 * status).
 */
export async function transitionStatus(
  input: TransitionStatusInput
): Promise<{ dispatch: LogisticsDispatch; event: LogisticsCustodyEvent }> {
  return prisma.$transaction(async (tx) => {
    const dispatch = await tx.logisticsDispatch.update({
      where: { id: input.dispatchId },
      data: { status: input.toStatus },
    });
    const event = await tx.logisticsCustodyEvent.create({
      data: {
        dispatchId: input.dispatchId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedById: input.changedById,
        notes: input.notes,
      },
    });
    return { dispatch, event };
  });
}

/** Every real custody event for one dispatch, oldest first — the actual chain-of-custody reading order (creation, then each real transition in the order they happened). */
export function findCustodyEvents(dispatchId: string): Promise<LogisticsCustodyEvent[]> {
  return prisma.logisticsCustodyEvent.findMany({ where: { dispatchId }, orderBy: { changedAt: "asc" } });
}

export type RecentCustodyEvent = LogisticsCustodyEvent & { dispatch: { truck: { identifier: string } } };

/** Real cross-dispatch recent activity (Phase 1.3, 2026-08-16 rollout) -- for Analytics' real Events feed, not scoped to one dispatch like findCustodyEvents() above. */
export function findRecentCustodyEvents(limit: number): Promise<RecentCustodyEvent[]> {
  return prisma.logisticsCustodyEvent.findMany({
    orderBy: { changedAt: "desc" },
    take: limit,
    include: { dispatch: { include: { truck: { select: { identifier: true } } } } },
  });
}

export type RecordMileageData = {
  odometerStart: number | null;
  odometerEnd: number | null;
  miles: number | null;
  businessPurpose: string | null;
};

/** Real, direct field update — no status/custody-event side effect, since recording a real odometer reading isn't itself a chain-of-custody transition (logisticsDispatchService.ts's recordMileage() owns the real derivation/validation logic that produces this data). */
export function updateMileage(dispatchId: string, data: RecordMileageData): Promise<LogisticsDispatch> {
  return prisma.logisticsDispatch.update({
    where: { id: dispatchId },
    data: {
      odometerStart: data.odometerStart,
      odometerEnd: data.odometerEnd,
      miles: data.miles,
      businessPurpose: data.businessPurpose,
    },
  });
}

/** Real, direct field update — logisticsDispatchService.ts's pushToTaxReport() owns the real eligibility validation (delivered + complete mileage + business purpose) that must pass before this is ever called. */
export function markTaxReported(dispatchId: string, userId: string): Promise<LogisticsDispatch> {
  return prisma.logisticsDispatch.update({
    where: { id: dispatchId },
    data: { taxReportedAt: new Date(), taxReportedById: userId },
  });
}

/** Every real dispatch that has actually been pushed to the tax report, oldest trip first — the same reading order a real IRS mileage log is kept in. */
export function findTaxReportedDispatches(): Promise<LogisticsDispatch[]> {
  return prisma.logisticsDispatch.findMany({
    where: { taxReportedAt: { not: null } },
    orderBy: { dispatchedAt: "asc" },
  });
}
