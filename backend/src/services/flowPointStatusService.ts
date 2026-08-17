import type { FlowConnection, FlowPoint, FlowPointStatus, FlowPointStatusEvent } from "@prisma/client";

import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/flowPointRepository";

/**
 * Phase 5 (2026-08-17) — Logistics Flow live operational state. Three real
 * states, unlike LogisticsStatus's one-way staged->in_transit->delivered
 * lifecycle: an operational hold/halt is genuinely recoverable in any
 * direction (a halt can resolve straight back to normal, a hold can
 * escalate to a halt, etc.), so there is no VALID_TRANSITIONS map here —
 * every distinct pair of states is a legal real move. Only same->same is
 * rejected, since that would be a no-op event, not a real transition.
 */
const ALL_STATUSES: FlowPointStatus[] = ["normal", "held", "halted"];

export type FlowPointStatusEventDto = {
  id: string;
  flowPointId: string;
  fromStatus: FlowPointStatus | null;
  toStatus: FlowPointStatus;
  reason: string | null;
  changedById: string;
  changedAt: string;
};

function toEventDto(row: FlowPointStatusEvent): FlowPointStatusEventDto {
  return {
    id: row.id,
    flowPointId: row.flowPointId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    changedById: row.changedById,
    changedAt: row.changedAt.toISOString(),
  };
}

/** The real, full status history for one point, oldest first — immutable; Reset in the UI must never call anything that deletes these. */
export async function listStatusEvents(flowPointId: string): Promise<FlowPointStatusEventDto[]> {
  const point = await repo.findPointById(flowPointId);
  if (!point) throw new NotFoundError(`No flow point with id "${flowPointId}"`);
  const rows = await repo.findStatusEvents(flowPointId);
  return rows.map(toEventDto);
}

/**
 * Manual, human-recorded transition — the only path for the 5 stage types
 * with no real linked asset (receiving/factory/autonomous_handling/
 * staging/loading), and also a valid real override for the 2 derived types
 * when a person has real information the linked Vehicle/Dispatch record
 * doesn't yet reflect. A reason is required for held/halted (an
 * operational hold with no stated cause isn't a real, useful record) and
 * optional when releasing back to normal.
 */
export async function recordManualTransition(
  flowPointId: string,
  toStatus: FlowPointStatus,
  changedById: string,
  reason?: string
): Promise<FlowPointStatusEventDto> {
  const existing = await repo.findPointById(flowPointId);
  if (!existing) throw new NotFoundError(`No flow point with id "${flowPointId}"`);

  if (existing.status === toStatus) {
    throw new ValidationError(`This point is already "${toStatus}" — not a real transition.`);
  }
  if ((toStatus === "held" || toStatus === "halted") && !reason?.trim()) {
    throw new ValidationError(`A reason is required when marking a point "${toStatus}".`);
  }

  const { event } = await repo.transitionStatus({
    flowPointId,
    fromStatus: existing.status,
    toStatus,
    reason: reason?.trim() || null,
    changedById,
  });
  return toEventDto(event);
}

/** Real mapping from a linked Vehicle's own real status to this point's operational status. */
function statusFromVehicle(vehicle: { status: string; identifier: string }): { status: FlowPointStatus; reason: string } {
  if (vehicle.status === "maintenance") {
    return { status: "held", reason: `Linked vehicle "${vehicle.identifier}" is in maintenance.` };
  }
  if (vehicle.status === "retired") {
    return { status: "halted", reason: `Linked vehicle "${vehicle.identifier}" is retired.` };
  }
  return { status: "normal", reason: `Linked vehicle "${vehicle.identifier}" is active.` };
}

/** Real mapping from a linked LogisticsDispatch's own real status to this point's operational status. */
function statusFromDispatch(dispatch: { status: string }): { status: FlowPointStatus; reason: string } {
  if (dispatch.status === "staged") {
    return { status: "held", reason: "Linked dispatch is staged, not yet in transit." };
  }
  return { status: "normal", reason: `Linked dispatch status: ${dispatch.status}.` };
}

/**
 * Real, read-time derivation for the 2 stage types that carry a real
 * `assetRef` into another authoritative domain (load_assignment ->
 * Vehicle, transportation_handoff -> LogisticsDispatch) — Type A
 * projection, same shape as Cost Intelligence -> Analytics: no new data
 * invented, the linked row's own real status is the source of truth.
 * Idempotent: only writes a new FlowPointStatusEvent (and only touches
 * FlowPoint.status) when the derived value actually differs from the
 * currently-stored one, so re-running this on every read doesn't spam
 * history with no-op events. `triggeredById` is the real authenticated
 * user whose request caused this recompute — there is no synthetic
 * "system" account in this schema, and inventing one would be exactly the
 * kind of fabricated actor this project has repeatedly avoided.
 */
export async function syncDerivedStatus(point: FlowPoint, triggeredById: string): Promise<FlowPoint> {
  if (!point.assetRef) return point;

  let derived: { status: FlowPointStatus; reason: string } | null = null;
  if (point.type === "load_assignment") {
    const vehicle = await repo.findVehicleById(point.assetRef);
    if (vehicle) derived = statusFromVehicle(vehicle);
  } else if (point.type === "transportation_handoff") {
    const dispatch = await repo.findDispatchById(point.assetRef);
    if (dispatch) derived = statusFromDispatch(dispatch);
  }

  if (!derived || derived.status === point.status) return point;

  const { point: updated } = await repo.transitionStatus({
    flowPointId: point.id,
    fromStatus: point.status,
    toStatus: derived.status,
    reason: derived.reason,
    changedById: triggeredById,
  });
  return updated;
}

const SEVERITY: Record<FlowPointStatus, number> = { normal: 0, held: 1, halted: 2 };

export type FlowPointWithEffectiveStatus = {
  id: string;
  status: FlowPointStatus;
  effectiveStatus: FlowPointStatus;
  blockedBy: string[];
};

export type FlowConnectionWithEffectiveStatus = {
  id: string;
  effectiveStatus: FlowPointStatus;
};

/**
 * Real graph-based blockage propagation, pure derivation, nothing
 * persisted. A point's own real `status` can be worse than what its
 * upstream neighbors show; `effectiveStatus` additionally accounts for
 * "can this point actually push material forward right now" — if
 * anything reachable downstream (following real FlowConnection edges,
 * source -> target = the real direction material moves) is held or
 * halted, this point is at least "held" too, since it cannot hand
 * material off past a blocked stage even if its own local condition is
 * fine. A point already worse than "held" locally keeps its own real
 * status (own status always wins over a propagated one when it's more
 * severe). An edge's effectiveStatus is the worse of its two endpoints'
 * effectiveStatus — it can't be carrying material normally if either end
 * can't.
 */
export function computeEffectiveStatuses(
  points: FlowPoint[],
  connections: FlowConnection[]
): { points: FlowPointWithEffectiveStatus[]; connections: FlowConnectionWithEffectiveStatus[] } {
  const pointById = new Map(points.map((p) => [p.id, p]));
  // reverse adjacency: targetId -> real upstream sourceIds feeding into it
  const upstreamOf = new Map<string, string[]>();
  for (const conn of connections) {
    if (!pointById.has(conn.sourcePointId) || !pointById.has(conn.targetPointId)) continue;
    const list = upstreamOf.get(conn.targetPointId) ?? [];
    list.push(conn.sourcePointId);
    upstreamOf.set(conn.targetPointId, list);
  }

  const effective = new Map<string, { status: FlowPointStatus; blockedBy: Set<string> }>();
  for (const p of points) effective.set(p.id, { status: p.status, blockedBy: new Set() });

  // BFS backward from every real held/halted point, propagating "held" to
  // everything transitively upstream of it (own real status still wins if
  // it's already worse than "held").
  for (const blocker of points) {
    if (SEVERITY[blocker.status] === 0) continue;
    const seen = new Set<string>([blocker.id]);
    const queue = [...(upstreamOf.get(blocker.id) ?? [])];
    while (queue.length > 0) {
      const upstreamId = queue.shift()!;
      if (seen.has(upstreamId)) continue;
      seen.add(upstreamId);

      const entry = effective.get(upstreamId);
      if (entry) {
        if (SEVERITY["held"] > SEVERITY[entry.status]) entry.status = "held";
        entry.blockedBy.add(blocker.id);
      }
      for (const next of upstreamOf.get(upstreamId) ?? []) queue.push(next);
    }
  }

  const pointsOut: FlowPointWithEffectiveStatus[] = points.map((p) => {
    const entry = effective.get(p.id)!;
    return { id: p.id, status: p.status, effectiveStatus: entry.status, blockedBy: [...entry.blockedBy] };
  });

  const connectionsOut: FlowConnectionWithEffectiveStatus[] = connections.map((c) => {
    const source = effective.get(c.sourcePointId);
    const target = effective.get(c.targetPointId);
    const worse =
      SEVERITY[source?.status ?? "normal"] >= SEVERITY[target?.status ?? "normal"]
        ? source?.status ?? "normal"
        : target?.status ?? "normal";
    return { id: c.id, effectiveStatus: worse };
  });

  return { points: pointsOut, connections: connectionsOut };
}

export { ALL_STATUSES };
