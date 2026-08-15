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

export type FlowPoint = {
  id: string;
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef: string | null;
  status: string | null;
  notes: string | null;
};

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

export function listFlowPoints(): Promise<FlowPoint[]> {
  return requestJson("/flow-points");
}

export type CreateFlowPointInput = {
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  assetRef?: string;
  status?: string;
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
  status: string | null;
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
