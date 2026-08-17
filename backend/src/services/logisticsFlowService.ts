import type { LogisticsFlow } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as flowPointRepo from "../repositories/flowPointRepository";
import * as repo from "../repositories/logisticsFlowRepository";
import { computeEffectiveStatuses, syncDerivedStatus } from "./flowPointStatusService";
import { toDto as toFlowPointDto } from "./flowPointService";

export type LogisticsFlowDto = {
  id: string;
  name: string;
  constructionProjectId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: LogisticsFlow): LogisticsFlowDto {
  return {
    id: row.id,
    name: row.name,
    constructionProjectId: row.constructionProjectId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** `projectId` is an optional real filter -- omitted, this lists every real flow across all projects (the existing cross-project Browse behavior), same "preserve the aggregate view" posture as Analytics' own project filter. */
export async function listFlows(projectId?: string): Promise<LogisticsFlowDto[]> {
  const rows = await repo.findAllFlows(projectId);
  return rows.map(toDto);
}

export async function getFlow(id: string): Promise<LogisticsFlowDto> {
  const row = await repo.findFlowById(id);
  if (!row) throw new NotFoundError(`No logistics flow with id "${id}"`);
  return toDto(row);
}

export type FlowGraphPointDto = {
  id: string;
  flowId: string;
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef: string | null;
  status: string;
  effectiveStatus: string;
  blockedBy: string[];
  notes: string | null;
};

export type FlowGraphConnectionDto = {
  id: string;
  sourcePointId: string;
  targetPointId: string;
  relationship: string | null;
  distanceMeters: number | null;
  effectiveStatus: string;
};

export type FlowGraphDto = {
  flow: LogisticsFlowDto;
  points: FlowGraphPointDto[];
  connections: FlowGraphConnectionDto[];
};

/**
 * The real live-monitor payload (Phase 5, 2026-08-17) — what the viewport's
 * Run/Refresh polls. Three steps, in order: (1) sync each point that
 * carries a real assetRef against its linked Vehicle/LogisticsDispatch,
 * writing a real FlowPointStatusEvent only when something actually
 * changed; (2) reload the now-current points; (3) compute the pure,
 * unpersisted blockage-propagation overlay across the real connection
 * graph. `triggeredById` attributes any derived-sync event this call
 * produces to the real authenticated caller — see
 * flowPointStatusService.syncDerivedStatus()'s own doc comment for why
 * there's no synthetic "system" actor.
 */
export async function getFlowGraph(id: string, triggeredById: string): Promise<FlowGraphDto> {
  const row = await repo.findFlowById(id);
  if (!row) throw new NotFoundError(`No logistics flow with id "${id}"`);

  const { points: rawPoints } = await flowPointRepo.findFlowGraph(id);
  await Promise.all(rawPoints.map((p) => syncDerivedStatus(p, triggeredById)));

  const { points: syncedPoints, connections } = await flowPointRepo.findFlowGraph(id);
  const { points: effectivePoints, connections: effectiveConnections } = computeEffectiveStatuses(
    syncedPoints,
    connections
  );
  const effectiveById = new Map(effectivePoints.map((p) => [p.id, p]));
  const effectiveConnById = new Map(effectiveConnections.map((c) => [c.id, c]));

  return {
    flow: toDto(row),
    points: syncedPoints.map((p) => {
      const dto = toFlowPointDto(p);
      const effective = effectiveById.get(p.id)!;
      return { ...dto, effectiveStatus: effective.effectiveStatus, blockedBy: effective.blockedBy };
    }),
    connections: connections.map((c) => ({
      id: c.id,
      sourcePointId: c.sourcePointId,
      targetPointId: c.targetPointId,
      relationship: c.relationship,
      distanceMeters: c.distanceMeters,
      effectiveStatus: effectiveConnById.get(c.id)!.effectiveStatus,
    })),
  };
}

export type CreateFlowInput = {
  name: string;
  constructionProjectId: string;
  createdById: string;
};

/** Real create -- refuses a bogus project id rather than trusting the client, same "assert real" discipline as every other cross-domain FK in this backend. */
export async function createFlow(input: CreateFlowInput): Promise<LogisticsFlowDto> {
  if (!input.name.trim()) throw new ValidationError("A real name is required.");

  const project = await repo.findProjectById(input.constructionProjectId);
  if (!project) throw new NotFoundError(`No construction project with id "${input.constructionProjectId}"`);

  const row = await repo.createFlow({
    name: input.name.trim(),
    constructionProjectId: input.constructionProjectId,
    createdById: input.createdById,
  });
  return toDto(row);
}
