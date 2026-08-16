import type { ModuleSequenceEntry, ModuleSequenceStatus } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/moduleSequenceRepository";

export type ModuleSequenceEntryDto = {
  id: string;
  inventoryItemId: string;
  itemTitle: string;
  constructionProjectId: string;
  buildingTreeNodeId: string;
  buildingTitle: string;
  status: ModuleSequenceStatus;
  sequencePosition: number | null;
  sourceDispatchId: string | null;
  notes: string | null;
  blockedByCount: number;
  createdAt: string;
  updatedAt: string;
};

type EntryRow = ModuleSequenceEntry & {
  inventoryItem: { title: string };
  buildingTreeNode: { title: string };
  blockedDependencies: { blockingEntryId: string }[];
};

function toDto(row: EntryRow): ModuleSequenceEntryDto {
  return {
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    itemTitle: row.inventoryItem.title,
    constructionProjectId: row.constructionProjectId,
    buildingTreeNodeId: row.buildingTreeNodeId,
    buildingTitle: row.buildingTreeNode.title,
    status: row.status,
    sequencePosition: row.sequencePosition,
    sourceDispatchId: row.sourceDispatchId,
    notes: row.notes,
    blockedByCount: row.blockedDependencies.length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEntriesForProject(projectId: string): Promise<ModuleSequenceEntryDto[]> {
  const rows = await repo.findEntriesByProject(projectId);
  return rows.map(toDto);
}

export type EligibleModuleDto = {
  inventoryItemId: string;
  title: string;
  buildingTreeNodeId: string | null;
  buildingTitle: string | null;
};

/** Real, handoff-eligible modules for the "add to sequence" UI flow (Phase 2.3). */
export async function listEligibleModules(projectId: string): Promise<EligibleModuleDto[]> {
  const rows = await repo.findEligibleModules(projectId);
  return rows
    .filter((r): r is typeof r & { inventoryItemId: string } => r.inventoryItemId !== null)
    .map((r) => ({
      inventoryItemId: r.inventoryItemId,
      title: r.name,
      buildingTreeNodeId: r.buildingTreeNodeId,
      buildingTitle: r.buildingTreeNode?.title ?? null,
    }));
}

/**
 * Real handoff contract (docs/decisions/2026-08-16-modular-sequencing-plan.md
 * §1): a ModuleSequenceEntry cannot be created until the real InventoryItem
 * has a real, delivered source dispatch. This is Sequencing's only real
 * coupling to Logistics/Transportation, and it's enforced here, not just
 * documented -- the entry genuinely cannot get ahead of Logistics' own
 * honest status.
 */
export async function createEntry(inventoryItemId: string, createdById: string): Promise<ModuleSequenceEntryDto> {
  const item = await repo.findInventoryItemForHandoff(inventoryItemId);
  if (!item) throw new NotFoundError(`No inventory item with id "${inventoryItemId}"`);

  const module = item.logisticsModule;
  if (!module) {
    throw new ValidationError(
      "This inventory item has no real Logistics provenance -- Modular Sequencing currently only supports items backed by a real LogisticsModule."
    );
  }
  if (!module.dispatch || module.dispatch.status !== "delivered") {
    throw new ValidationError(
      "Cannot sequence this item until its real dispatch reaches \"delivered\" -- it has not crossed the Transportation handoff yet."
    );
  }
  if (!module.constructionProjectId || !module.buildingTreeNodeId) {
    throw new ValidationError(
      "This item has no real project/building assignment yet -- assign its LogisticsModule to a project and building before sequencing."
    );
  }

  const existing = await repo.findEntryByInventoryItemId(inventoryItemId);
  if (existing) throw new ValidationError("This item already has a real Module Sequence entry.");

  const row = await repo.createEntry({
    inventoryItemId,
    constructionProjectId: module.constructionProjectId,
    buildingTreeNodeId: module.buildingTreeNodeId,
    sourceDispatchId: module.dispatchId,
  });

  // Real creation event -- the Timeliner's first real data point for this entry.
  await repo.createEvent({ sequenceEntryId: row.id, fromStatus: null, toStatus: "pending", changedById: createdById, notes: null });

  const rows = await repo.findEntriesByProject(module.constructionProjectId);
  const created = rows.find((r) => r.id === row.id)!;
  return toDto(created);
}

/**
 * Real, closed state machine -- linear, no skipping ahead, same
 * discipline as logisticsDispatchService.ts's VALID_TRANSITIONS. `pending`
 * means "handoff has occurred (real delivered dispatch exists) but
 * Construction hasn't logged its own on-site arrival confirmation yet" --
 * a real, separate event from Logistics' own "delivered" signal.
 */
const VALID_TRANSITIONS: Record<ModuleSequenceStatus, ModuleSequenceStatus[]> = {
  pending: ["site_arrival"],
  site_arrival: ["site_acceptance"],
  site_acceptance: ["installation"],
  installation: ["placement"],
  placement: ["complete"],
  complete: [],
};

export async function transitionStatus(
  entryId: string,
  toStatus: ModuleSequenceStatus,
  changedById: string,
  notes?: string
): Promise<ModuleSequenceEntryDto> {
  const existing = await repo.findEntryById(entryId);
  if (!existing) throw new NotFoundError(`No module sequence entry with id "${entryId}"`);

  const allowed = VALID_TRANSITIONS[existing.status];
  if (!allowed.includes(toStatus)) {
    const allowedText = allowed.length > 0 ? allowed.join(", ") : "none -- this entry is already complete";
    throw new ValidationError(
      `Cannot transition this entry from "${existing.status}" to "${toStatus}" -- valid next state(s): ${allowedText}`
    );
  }

  // Real blocker check -- an entry can't advance past `pending` while a
  // real predecessor hasn't reached `complete`.
  if (existing.status === "pending") {
    const blockers = await repo.findBlockingEntries(entryId);
    const incomplete = blockers.filter((b) => b.blockingEntry.status !== "complete");
    if (incomplete.length > 0) {
      throw new ValidationError(
        `Cannot start this entry -- blocked by ${incomplete.length} real predecessor entr${incomplete.length === 1 ? "y" : "ies"} not yet complete.`
      );
    }
  }

  await repo.updateEntryStatus(entryId, toStatus);
  await repo.createEvent({ sequenceEntryId: entryId, fromStatus: existing.status, toStatus, changedById, notes: notes ?? null });

  const rows = await repo.findEntriesByProject(existing.constructionProjectId);
  const updated = rows.find((r) => r.id === entryId)!;
  return toDto(updated);
}

export async function updatePosition(entryId: string, sequencePosition: number | null): Promise<ModuleSequenceEntryDto> {
  const existing = await repo.findEntryById(entryId);
  if (!existing) throw new NotFoundError(`No module sequence entry with id "${entryId}"`);

  await repo.updateEntryPosition(entryId, sequencePosition);
  const rows = await repo.findEntriesByProject(existing.constructionProjectId);
  const updated = rows.find((r) => r.id === entryId)!;
  return toDto(updated);
}

export type ModuleSequenceEventDto = {
  id: string;
  sequenceEntryId: string;
  fromStatus: string | null;
  toStatus: string;
  changedById: string;
  changedAt: string;
  notes: string | null;
};

/** The real event history -- this IS the Timeliner's actual data source (Phase 2.3). */
export async function listEvents(entryId: string): Promise<ModuleSequenceEventDto[]> {
  const existing = await repo.findEntryById(entryId);
  if (!existing) throw new NotFoundError(`No module sequence entry with id "${entryId}"`);

  const rows = await repo.findEventsByEntryId(entryId);
  return rows.map((row) => ({
    id: row.id,
    sequenceEntryId: row.sequenceEntryId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    changedById: row.changedById,
    changedAt: row.changedAt.toISOString(),
    notes: row.notes,
  }));
}

export async function addDependency(blockingEntryId: string, blockedEntryId: string): Promise<void> {
  const [blocking, blocked] = await Promise.all([repo.findEntryById(blockingEntryId), repo.findEntryById(blockedEntryId)]);
  if (!blocking) throw new NotFoundError(`No module sequence entry with id "${blockingEntryId}"`);
  if (!blocked) throw new NotFoundError(`No module sequence entry with id "${blockedEntryId}"`);
  if (blockingEntryId === blockedEntryId) throw new ValidationError("An entry cannot depend on itself.");

  await repo.createDependency(blockingEntryId, blockedEntryId);
}
