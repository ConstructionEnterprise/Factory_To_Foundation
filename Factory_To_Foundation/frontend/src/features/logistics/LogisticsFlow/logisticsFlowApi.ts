import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real API client for the Logistics Flow (point-to-point) map — talks to
 * the real backend route files flowPoints.ts/flowConnections.ts. Same
 * authFetch/describeResponseError pattern as logisticsOperationsApi.ts:
 * credentials always included, a real `{ error }` body surfaced on failure
 * instead of a generic "server responded 4xx".
 */
const API_BASE = BACKEND_URL;

/**
 * Suggested vocabulary only, per the architecture decision this feature was
 * built against — not a closed/enforced set anywhere (frontend or backend).
 * Offered as the form's default options; "Custom…" always falls through to
 * free text.
 *
 * Real internal-movement sequence (2026-08-15 architecture decision, see
 * frontend/CLAUDE.md's own "Logistics Flow" section for the full boundary
 * rule): Receiving → Factory → Autonomous Handling → Staging → Load
 * Assignment → Loading → Transportation Handoff. `load_assignment` and
 * `transportation_handoff` are the two types that get real resolved
 * references (see flowPointResolution.ts) instead of plain free text.
 */
export const SUGGESTED_FLOW_POINT_TYPES = [
  "receiving",
  "factory",
  "autonomous_handling",
  "staging",
  "load_assignment",
  "loading",
  "transportation_handoff",
] as const;

/**
 * Real, project-scoped Logistics Flow instance (Phase 4.1, 2026-08-17) --
 * the project relationship lives here, not on FlowPoint/FlowConnection
 * directly, which stay reusable topology beneath one real flow.
 */
export type LogisticsFlow = {
  id: string;
  name: string;
  constructionProjectId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Real operational status (Phase 5, 2026-08-17) — three states, not a
 * one-way lifecycle: `held`/`halted` can resolve back to `normal` directly,
 * since a real operational condition (equipment unavailable, an emergency
 * stop) is genuinely recoverable in either direction. See
 * flowPointStatusService.ts on the backend for the full reasoning.
 */
export type FlowPointStatus = "normal" | "held" | "halted";

export type FlowPoint = {
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

/** One real, immutable entry in a point's status history — never edited or deleted, including by "Reset" in the live-monitor UI. */
export type FlowPointStatusEvent = {
  id: string;
  flowPointId: string;
  fromStatus: FlowPointStatus | null;
  toStatus: FlowPointStatus;
  reason: string | null;
  changedById: string;
  changedAt: string;
};

/**
 * Real live-monitor payload for one flow (Phase 5, 2026-08-17) — points
 * carry both their own real `status` and a derived, never-persisted
 * `effectiveStatus` (blockage propagated backward along the real
 * connection graph: a point that cannot push material past a held/halted
 * downstream neighbor shows at least "held" here even if its own status is
 * normal). `blockedBy` names the real downstream point id(s) responsible.
 */
export type FlowGraphPoint = FlowPoint & { effectiveStatus: FlowPointStatus; blockedBy: string[] };
export type FlowGraphConnection = FlowConnection & { effectiveStatus: FlowPointStatus };
export type FlowGraph = { flow: LogisticsFlow; points: FlowGraphPoint[]; connections: FlowGraphConnection[] };

export type FlowConnection = {
  id: string;
  sourcePointId: string;
  targetPointId: string;
  relationship: string | null;
  distanceMeters: number | null;
  notes: string | null;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** `projectId` is an optional real filter -- reuses the same real `?projectId=` backend support Phase 4.1 added, omitted here it lists every real flow (LogisticsFlowStore's own existing cross-project behavior, unchanged). */
export function listLogisticsFlows(projectId?: string): Promise<LogisticsFlow[]> {
  return requestJson(`/logistics-flows${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`);
}

export type CreateLogisticsFlowInput = {
  name: string;
  constructionProjectId: string;
};

export function createLogisticsFlow(input: CreateLogisticsFlowInput): Promise<LogisticsFlow> {
  return requestJson("/logistics-flows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function listFlowPoints(): Promise<FlowPoint[]> {
  return requestJson("/flow-points");
}

export type CreateFlowPointInput = {
  flowId: string;
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef?: string;
  notes?: string;
};

export function createFlowPoint(input: CreateFlowPointInput): Promise<FlowPoint> {
  return requestJson("/flow-points", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type UpdateFlowPointInput = Partial<{
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef: string | null;
  notes: string | null;
}>;

export function updateFlowPoint(id: string, input: UpdateFlowPointInput): Promise<FlowPoint> {
  return requestJson(`/flow-points/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteFlowPoint(id: string): Promise<void> {
  return requestJson(`/flow-points/${id}`, { method: "DELETE" });
}

/**
 * Real, manual operational-status transition — the only way a point
 * without a resolvable linked asset (5 of the 7 real stage types) ever
 * changes color, and a valid real override for the other 2. `reason` is
 * required by the backend for held/halted, optional when releasing back to
 * normal.
 */
export function transitionFlowPointStatus(id: string, toStatus: FlowPointStatus, reason?: string): Promise<FlowPointStatusEvent> {
  return requestJson(`/flow-points/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toStatus, reason }),
  });
}

/** The real, full, immutable status history for one point, oldest first. */
export function listFlowPointStatusEvents(id: string): Promise<FlowPointStatusEvent[]> {
  return requestJson(`/flow-points/${id}/status-events`);
}

/**
 * The real live-monitor payload for one flow (Phase 5, 2026-08-17) — what
 * "Run"/"Refresh" polls. Read-only from the caller's perspective even
 * though it can trigger a real derived-status sync server-side (see the
 * backend route's own doc comment): this is the honest consequence of
 * reading current linked-asset state, not a separate write action.
 */
export function getFlowGraph(flowId: string): Promise<FlowGraph> {
  return requestJson(`/logistics-flows/${flowId}/graph`);
}

export function listFlowConnections(): Promise<FlowConnection[]> {
  return requestJson("/flow-connections");
}

export type CreateFlowConnectionInput = {
  sourcePointId: string;
  targetPointId: string;
  relationship?: string;
  distanceMeters?: number;
  notes?: string;
};

export function createFlowConnection(input: CreateFlowConnectionInput): Promise<FlowConnection> {
  return requestJson("/flow-connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type UpdateFlowConnectionInput = Partial<{
  relationship: string | null;
  distanceMeters: number | null;
  notes: string | null;
}>;

export function updateFlowConnection(id: string, input: UpdateFlowConnectionInput): Promise<FlowConnection> {
  return requestJson(`/flow-connections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteFlowConnection(id: string): Promise<void> {
  return requestJson(`/flow-connections/${id}`, { method: "DELETE" });
}
