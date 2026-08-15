import type { FlowConnection } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as flowPointRepo from "../repositories/flowPointRepository";
import * as repo from "../repositories/flowConnectionRepository";

export type FlowConnectionDto = {
  id: string;
  sourcePointId: string;
  targetPointId: string;
  relationship: string | null;
  distanceMeters: number | null;
  notes: string | null;
};

function toDto(row: FlowConnection): FlowConnectionDto {
  return {
    id: row.id,
    sourcePointId: row.sourcePointId,
    targetPointId: row.targetPointId,
    relationship: row.relationship,
    distanceMeters: row.distanceMeters,
    notes: row.notes,
  };
}

export async function listConnections(): Promise<FlowConnectionDto[]> {
  const rows = await repo.findAllConnections();
  return rows.map(toDto);
}

export type CreateConnectionInput = {
  sourcePointId: string;
  targetPointId: string;
  relationship?: string;
  distanceMeters?: number;
  notes?: string;
};

/**
 * Real create — asserts both real points exist first (same "assert real,
 * don't trust the client" discipline as LogisticsModule's dispatchId
 * check, this table's own real Logistics sibling) and rejects a self-loop,
 * since a point connected to itself isn't a real flow relationship.
 */
export async function createConnection(input: CreateConnectionInput): Promise<FlowConnectionDto> {
  if (input.sourcePointId === input.targetPointId) {
    throw new ValidationError("A flow connection's source and target must be different points");
  }

  const [source, target] = await Promise.all([
    flowPointRepo.findPointById(input.sourcePointId),
    flowPointRepo.findPointById(input.targetPointId),
  ]);
  if (!source) throw new NotFoundError(`No flow point with id "${input.sourcePointId}"`);
  if (!target) throw new NotFoundError(`No flow point with id "${input.targetPointId}"`);

  const row = await repo.createConnection({
    sourcePointId: input.sourcePointId,
    targetPointId: input.targetPointId,
    relationship: input.relationship?.trim() || null,
    distanceMeters: input.distanceMeters ?? null,
    notes: input.notes?.trim() || null,
  });
  return toDto(row);
}

export type UpdateConnectionInput = {
  relationship?: string | null;
  distanceMeters?: number | null;
  notes?: string | null;
};

export async function updateConnection(id: string, input: UpdateConnectionInput): Promise<FlowConnectionDto> {
  const existing = await repo.findConnectionById(id);
  if (!existing) throw new NotFoundError(`No flow connection with id "${id}"`);

  const row = await repo.updateConnection(id, {
    ...(input.relationship !== undefined ? { relationship: input.relationship?.trim() || null } : {}),
    ...(input.distanceMeters !== undefined ? { distanceMeters: input.distanceMeters } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
  });
  return toDto(row);
}

export async function deleteConnection(id: string): Promise<void> {
  const existing = await repo.findConnectionById(id);
  if (!existing) throw new NotFoundError(`No flow connection with id "${id}"`);
  await repo.deleteConnection(id);
}
