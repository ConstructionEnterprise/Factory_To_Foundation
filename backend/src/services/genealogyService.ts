import type { GenealogyEdge, GenealogyNode } from "@prisma/client";

import * as repo from "../repositories/genealogyRepository";

export type GenealogyNodeDto = {
  id: string;
  title: string;
  tier: string;
  qr: string | null;
};

export type GenealogyEdgeDto = {
  id: string;
  fromId: string;
  toId: string;
};

function toNodeDto(row: GenealogyNode): GenealogyNodeDto {
  return { id: row.id, title: row.title, tier: row.tier, qr: row.qr };
}

function toEdgeDto(row: GenealogyEdge): GenealogyEdgeDto {
  return { id: row.id, fromId: row.fromId, toId: row.toId };
}

/**
 * Read-only for now — the real GenealogyNode/GenealogyEdge rows were
 * seeded directly (backend/prisma/seed.ts), matching this feature's
 * current real usage (a browse/relationship-graph view, no creation UI
 * exists in the frontend). Write routes are real, addable work, not built
 * speculatively ahead of an actual need.
 */
export async function listNodes(): Promise<GenealogyNodeDto[]> {
  const rows = await repo.findAllNodes();
  return rows.map(toNodeDto);
}

export async function listEdges(): Promise<GenealogyEdgeDto[]> {
  const rows = await repo.findAllEdges();
  return rows.map(toEdgeDto);
}
