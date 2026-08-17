import type { ModuleSequenceEntry, ModuleSequenceStatus } from "@prisma/client";

export type SequenceEffectiveState = "ready" | "blocked";

export type EntryWithEffectiveState = {
  id: string;
  status: ModuleSequenceStatus;
  effectiveState: SequenceEffectiveState;
  blockedByChain: string[];
};

/**
 * Real transitive blockage overlay (Phase 7, 2026-08-17), pure derivation,
 * nothing persisted -- same posture as flowPointStatusService.
 * computeEffectiveStatuses(). moduleSequenceService.transitionStatus()'s
 * own real gate only re-checks blockers while an entry is still "pending";
 * once an entry has actually left pending it has permanently passed that
 * gate, so it is always "ready" here regardless of any predecessor's later
 * state. Only two real states -- an entry either can start (or already
 * has) or it is genuinely blocked from starting by a real, unresolved
 * predecessor, transitively. No fabricated third/intermediate state:
 * ModuleSequenceStatus has no held/halted concept, matching the same
 * discipline the Phase 7 audit applied to Sequencing generally.
 */
export function computeEffectiveStates(
  entries: Pick<ModuleSequenceEntry, "id" | "status">[],
  edges: { blockingEntryId: string; blockedEntryId: string }[]
): EntryWithEffectiveState[] {
  const statusById = new Map(entries.map((e) => [e.id, e.status]));
  // reverse adjacency: blockedEntryId -> real entries directly blocking it
  const blockedByOf = new Map<string, string[]>();
  for (const edge of edges) {
    if (!statusById.has(edge.blockingEntryId) || !statusById.has(edge.blockedEntryId)) continue;
    const list = blockedByOf.get(edge.blockedEntryId) ?? [];
    list.push(edge.blockingEntryId);
    blockedByOf.set(edge.blockedEntryId, list);
  }

  return entries.map((entry) => {
    if (entry.status !== "pending") {
      return { id: entry.id, status: entry.status, effectiveState: "ready", blockedByChain: [] };
    }

    // BFS over real direct blockers, transitively, collecting every real
    // upstream entry not yet complete -- the full root-cause chain, not
    // just the direct single-hop neighbor moduleSequenceService's own
    // transitionStatus() gate checks.
    const chain = new Set<string>();
    const seen = new Set<string>([entry.id]);
    const queue = [...(blockedByOf.get(entry.id) ?? [])];
    while (queue.length > 0) {
      const upstreamId = queue.shift()!;
      if (seen.has(upstreamId)) continue;
      seen.add(upstreamId);
      const upstreamStatus = statusById.get(upstreamId);
      if (upstreamStatus && upstreamStatus !== "complete") {
        chain.add(upstreamId);
        for (const next of blockedByOf.get(upstreamId) ?? []) queue.push(next);
      }
    }

    return {
      id: entry.id,
      status: entry.status,
      effectiveState: chain.size > 0 ? "blocked" : "ready",
      blockedByChain: [...chain],
    };
  });
}
