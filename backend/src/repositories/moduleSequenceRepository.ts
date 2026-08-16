import type { ModuleSequenceEntry, ModuleSequenceEvent, ModuleSequenceStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type InventoryItemForHandoff = {
  id: string;
  logisticsModule: {
    dispatchId: string | null;
    constructionProjectId: string | null;
    buildingTreeNodeId: string | null;
    dispatch: { id: string; status: string; dispatchedAt: Date } | null;
  } | null;
};

/** Real handoff-contract read (§1 of the plan doc) -- resolves whether this item has a real, delivered source dispatch. */
export function findInventoryItemForHandoff(inventoryItemId: string): Promise<InventoryItemForHandoff | null> {
  return prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
    select: {
      id: true,
      logisticsModule: {
        select: {
          dispatchId: true,
          constructionProjectId: true,
          buildingTreeNodeId: true,
          dispatch: { select: { id: true, status: true, dispatchedAt: true } },
        },
      },
    },
  });
}

export function findEntryByInventoryItemId(inventoryItemId: string): Promise<ModuleSequenceEntry | null> {
  return prisma.moduleSequenceEntry.findUnique({ where: { inventoryItemId } });
}

export function findEntryById(id: string): Promise<ModuleSequenceEntry | null> {
  return prisma.moduleSequenceEntry.findUnique({ where: { id } });
}

/**
 * Real, eligible-for-sequencing LogisticsModule rows (Phase 2.3) -- has a
 * real delivered dispatch (the handoff has occurred) and no existing
 * ModuleSequenceEntry yet. Feeds the frontend's "add module" flow so a
 * user only ever picks from real, handoff-eligible items, never a raw
 * inventoryItemId typed blind.
 */
export function findEligibleModules(projectId: string) {
  return prisma.logisticsModule.findMany({
    where: {
      constructionProjectId: projectId,
      dispatch: { status: "delivered" },
      inventoryItem: { moduleSequenceEntry: null },
    },
    select: {
      inventoryItemId: true,
      name: true,
      buildingTreeNodeId: true,
      buildingTreeNode: { select: { title: true } },
    },
  });
}

export function findEntriesByProject(projectId: string) {
  return prisma.moduleSequenceEntry.findMany({
    where: { constructionProjectId: projectId },
    include: {
      inventoryItem: { select: { title: true } },
      buildingTreeNode: { select: { title: true } },
      blockedDependencies: { select: { blockingEntryId: true } },
    },
    orderBy: [{ buildingTreeNodeId: "asc" }, { sequencePosition: "asc" }],
  });
}

export type CreateEntryInput = {
  inventoryItemId: string;
  constructionProjectId: string;
  buildingTreeNodeId: string;
  sourceDispatchId: string | null;
};

export function createEntry(input: CreateEntryInput): Promise<ModuleSequenceEntry> {
  return prisma.moduleSequenceEntry.create({ data: input });
}

export function updateEntryStatus(id: string, status: ModuleSequenceStatus): Promise<ModuleSequenceEntry> {
  return prisma.moduleSequenceEntry.update({ where: { id }, data: { status } });
}

export function updateEntryPosition(id: string, sequencePosition: number | null): Promise<ModuleSequenceEntry> {
  return prisma.moduleSequenceEntry.update({ where: { id }, data: { sequencePosition } });
}

export type CreateEventInput = {
  sequenceEntryId: string;
  fromStatus: ModuleSequenceStatus | null;
  toStatus: ModuleSequenceStatus;
  changedById: string;
  notes: string | null;
};

export function createEvent(input: CreateEventInput): Promise<ModuleSequenceEvent> {
  return prisma.moduleSequenceEvent.create({ data: input });
}

export function findEventsByEntryId(sequenceEntryId: string): Promise<ModuleSequenceEvent[]> {
  return prisma.moduleSequenceEvent.findMany({ where: { sequenceEntryId }, orderBy: { changedAt: "asc" } });
}

export function createDependency(blockingEntryId: string, blockedEntryId: string) {
  return prisma.moduleSequenceDependency.create({ data: { blockingEntryId, blockedEntryId } });
}

export function findBlockingEntries(blockedEntryId: string) {
  return prisma.moduleSequenceDependency.findMany({
    where: { blockedEntryId },
    include: { blockingEntry: { select: { id: true, status: true } } },
  });
}
