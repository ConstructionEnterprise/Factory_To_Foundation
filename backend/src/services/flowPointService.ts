import type { FlowPoint, FlowPointStatus } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/flowPointRepository";

export type FlowPointDto = {
  id: string;
  flowId: string;
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef: string | null;
  status: FlowPointStatus;
  notes: string | null;
};

export function toDto(row: FlowPoint): FlowPointDto {
  return {
    id: row.id,
    flowId: row.flowId,
    type: row.type,
    name: row.name,
    positionX: row.positionX,
    positionY: row.positionY,
    assetRef: row.assetRef,
    status: row.status,
    notes: row.notes,
  };
}

/** `flowId` is an optional real filter -- omitted, this lists every real point across all flows (the existing cross-flow Browse behavior, unchanged). */
export async function listPoints(flowId?: string): Promise<FlowPointDto[]> {
  const rows = await repo.findAllPoints(flowId);
  return rows.map(toDto);
}

export type CreatePointInput = {
  flowId: string;
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef?: string;
  notes?: string;
};

/**
 * Real create — the only way a real FlowPoint row comes to exist. Ships
 * with zero seeded rows (matching this schema's own "empty is honest"
 * convention, same as every other Logistics table at its own equivalent
 * phase — this table is itself part of Logistics, not just following the
 * pattern from outside it). Requires a real, existing LogisticsFlow —
 * asserted, not trusted, same discipline as every other cross-domain FK.
 */
export async function createPoint(input: CreatePointInput): Promise<FlowPointDto> {
  const flow = await repo.findFlowById(input.flowId);
  if (!flow) throw new NotFoundError(`No logistics flow with id "${input.flowId}"`);

  const row = await repo.createPoint({
    flowId: input.flowId,
    type: input.type.trim(),
    name: input.name.trim(),
    positionX: input.positionX,
    positionY: input.positionY,
    assetRef: input.assetRef?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  return toDto(row);
}

export type UpdatePointInput = {
  type?: string;
  name?: string;
  positionX?: number;
  positionY?: number;
  assetRef?: string | null;
  notes?: string | null;
};

/**
 * Covers metadata edits and drag-to-move position persistence — deliberately
 * cannot touch `status` (Phase 5, 2026-08-17): every real status change must
 * go through flowPointStatusService so a FlowPointStatusEvent is always
 * written, never silently skipped via this generic PATCH.
 */
export async function updatePoint(id: string, input: UpdatePointInput): Promise<FlowPointDto> {
  const existing = await repo.findPointById(id);
  if (!existing) throw new NotFoundError(`No flow point with id "${id}"`);

  const row = await repo.updatePoint(id, {
    ...(input.type !== undefined ? { type: input.type.trim() } : {}),
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.positionX !== undefined ? { positionX: input.positionX } : {}),
    ...(input.positionY !== undefined ? { positionY: input.positionY } : {}),
    ...(input.assetRef !== undefined ? { assetRef: input.assetRef?.trim() || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
  });
  return toDto(row);
}

/** Cascades to the point's own FlowConnection rows at the DB level (schema's onDelete: Cascade) — never leaves an orphaned connection. */
export async function deletePoint(id: string): Promise<void> {
  const existing = await repo.findPointById(id);
  if (!existing) throw new NotFoundError(`No flow point with id "${id}"`);
  await repo.deletePoint(id);
}
