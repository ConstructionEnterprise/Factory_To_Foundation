import type { Prisma, ProductionRun } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/productionRunRepository";

export type ProductionRunDto = {
  id: string;
  assemblyId: string;
  assemblyName: string;
  cellRef: string | null;
  status: ProductionRun["status"];
  plannedQuantity: number | null;
  /// Real, computed here -- COUNT of this run's own real ProductionOutput
  /// rows. Never a second, independently-entered number that could drift
  /// from what was actually produced.
  actualQuantity: number;
  startedAt: string;
  completedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  /** Real Manufacturing-model provenance snapshot (Phase 8, 2026-08-17) -- see materialRequirementService.ts. */
  sourceModelNodeId: string | null;
  sourceDimensions: unknown;
  sourceExtras: unknown;
};

async function toDto(row: ProductionRun): Promise<ProductionRunDto> {
  const [assembly, actualQuantity] = await Promise.all([
    repo.findAssemblyById(row.assemblyId),
    repo.countOutputsForRun(row.id),
  ]);
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    // Real assertion, not an optional chain -- a run's assemblyId is a
    // required FK, so a missing assembly here would mean real referential
    // corruption, not a legitimate absence to paper over with "Unknown".
    assemblyName: assembly!.name,
    cellRef: row.cellRef,
    status: row.status,
    plannedQuantity: row.plannedQuantity,
    actualQuantity,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sourceModelNodeId: row.sourceModelNodeId,
    sourceDimensions: row.sourceDimensions,
    sourceExtras: row.sourceExtras,
  };
}

export async function listRuns(): Promise<ProductionRunDto[]> {
  const rows = await repo.findAllRuns();
  return Promise.all(rows.map(toDto));
}

export async function getRun(id: string): Promise<ProductionRunDto> {
  const row = await repo.findRunById(id);
  if (!row) throw new NotFoundError(`No production run with id "${id}"`);
  return toDto(row);
}

export type CreateRunInput = {
  assemblyId: string;
  cellRef?: string;
  plannedQuantity?: number;
  startedAt?: string;
  createdById: string;
  /** Real, optional Manufacturing-model provenance (Phase 8, 2026-08-17) -- present only when this run was created from a specific selected/measured Manufacturing node. */
  sourceModelNodeId?: string;
  sourceDimensions?: unknown;
  sourceExtras?: unknown;
};

/**
 * Real create -- asserts the real assembly exists (same "assert real,
 * don't trust the client" discipline as every other cross-domain FK in
 * this backend). `startedAt` defaults to now if not supplied -- a real
 * run genuinely starts at the moment it's recorded unless a caller has a
 * real, disclosed different start time.
 */
export async function createRun(input: CreateRunInput): Promise<ProductionRunDto> {
  const assembly = await repo.findAssemblyById(input.assemblyId);
  if (!assembly) throw new NotFoundError(`No cost assembly with id "${input.assemblyId}"`);

  if (input.plannedQuantity !== undefined && input.plannedQuantity <= 0) {
    throw new ValidationError("Planned quantity must be a real, positive number.");
  }

  const row = await repo.createRun({
    assemblyId: input.assemblyId,
    cellRef: input.cellRef?.trim() || null,
    plannedQuantity: input.plannedQuantity ?? null,
    startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
    createdById: input.createdById,
    sourceModelNodeId: input.sourceModelNodeId ?? null,
    sourceDimensions: input.sourceDimensions as Prisma.InputJsonValue | undefined,
    sourceExtras: input.sourceExtras as Prisma.InputJsonValue | undefined,
  });
  return toDto(row);
}

/**
 * Real, one-way transition -- a run's completion is a genuine real-world
 * event, same "no going back" posture as LogisticsStatus's own real
 * staged->in_transit->delivered lifecycle. `completedAt` is set to now,
 * the real moment this was recorded complete.
 */
export async function completeRun(id: string): Promise<ProductionRunDto> {
  const existing = await repo.findRunById(id);
  if (!existing) throw new NotFoundError(`No production run with id "${id}"`);
  if (existing.status === "complete") {
    throw new ValidationError("This production run is already complete.");
  }

  const row = await repo.updateRunStatus(id, "complete", new Date());
  return toDto(row);
}
