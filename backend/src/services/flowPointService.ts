import type { FlowPoint } from "@prisma/client";

import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/flowPointRepository";

export type FlowPointDto = {
  id: string;
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef: string | null;
  status: string | null;
  notes: string | null;
};

function toDto(row: FlowPoint): FlowPointDto {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    positionX: row.positionX,
    positionY: row.positionY,
    assetRef: row.assetRef,
    status: row.status,
    notes: row.notes,
  };
}

export async function listPoints(): Promise<FlowPointDto[]> {
  const rows = await repo.findAllPoints();
  return rows.map(toDto);
}

export type CreatePointInput = {
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef?: string;
  status?: string;
  notes?: string;
};

/**
 * Real create — the only way a real FlowPoint row comes to exist. Ships
 * with zero seeded rows (matching this schema's own "empty is honest"
 * convention, same as every other Logistics table at its own equivalent
 * phase — this table is itself part of Logistics, not just following the
 * pattern from outside it).
 */
export async function createPoint(input: CreatePointInput): Promise<FlowPointDto> {
  const row = await repo.createPoint({
    type: input.type.trim(),
    name: input.name.trim(),
    positionX: input.positionX,
    positionY: input.positionY,
    assetRef: input.assetRef?.trim() || null,
    status: input.status?.trim() || null,
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
  status?: string | null;
  notes?: string | null;
};

/** Covers both metadata edits and drag-to-move position persistence — one route, same as every field on this small a resource. */
export async function updatePoint(id: string, input: UpdatePointInput): Promise<FlowPointDto> {
  const existing = await repo.findPointById(id);
  if (!existing) throw new NotFoundError(`No flow point with id "${id}"`);

  const row = await repo.updatePoint(id, {
    ...(input.type !== undefined ? { type: input.type.trim() } : {}),
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.positionX !== undefined ? { positionX: input.positionX } : {}),
    ...(input.positionY !== undefined ? { positionY: input.positionY } : {}),
    ...(input.assetRef !== undefined ? { assetRef: input.assetRef?.trim() || null } : {}),
    ...(input.status !== undefined ? { status: input.status?.trim() || null } : {}),
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
