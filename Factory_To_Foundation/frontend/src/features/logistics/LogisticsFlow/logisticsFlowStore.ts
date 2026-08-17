import { useSyncExternalStore } from "react";

import * as api from "./logisticsFlowApi";
import type { FlowConnection, FlowGraph, FlowPoint, LogisticsFlow } from "./logisticsFlowApi";

/**
 * Real shared state for Logistics Flow's three panels (Browse/Map/
 * Inspector) — deliberately NOT part of the global SelectionContext, same
 * reasoning as constructionDocumentPreviewStore.ts: "selected flow point/
 * connection" is a shape only this feature ever needs, and folding it into
 * SelectionContext's discriminated union would force every other feature's
 * payload type to account for it. Same small module-level
 * useSyncExternalStore pattern as constructionSiteStore.ts/
 * constructionDocumentPreviewStore.ts — no context provider needed.
 */

export type FlowSelection = { kind: "point"; id: string } | { kind: "connection"; id: string };

type State = {
  flows: LogisticsFlow[];
  points: FlowPoint[];
  connections: FlowConnection[];
  loading: boolean;
  error: string | null;
  selection: FlowSelection | null;
  /**
   * Real live-monitor scope (Phase 5, 2026-08-17) — null means "all flows,"
   * the existing cross-flow Browse/Map behavior, unchanged. Set, it scopes
   * the Map to one real flow's `graph` (status + blockage-propagated
   * effectiveStatus), which only makes honest sense within a single real
   * flow's own connection graph, never mixed across flows.
   */
  selectedFlowId: string | null;
  graph: FlowGraph | null;
  graphLoading: boolean;
  graphError: string | null;
  /** LIVE MONITOR, not simulation — see logisticsFlowStore.ts's startMonitor() doc comment. */
  monitorRunning: boolean;
};

let state: State = {
  flows: [],
  points: [],
  connections: [],
  loading: false,
  error: null,
  selection: null,
  selectedFlowId: null,
  graph: null,
  graphLoading: false,
  graphError: null,
  monitorRunning: false,
};
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export function useLogisticsFlowState(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

let loaded = false;

/** Fetches both real lists fresh — called once on first real subscriber mount and after every real mutation. */
export async function loadLogisticsFlow(): Promise<void> {
  emit({ ...state, loading: true, error: null });
  try {
    const [flows, points, connections] = await Promise.all([api.listLogisticsFlows(), api.listFlowPoints(), api.listFlowConnections()]);
    loaded = true;
    emit({ ...state, flows, points, connections, loading: false, error: null });
  } catch (err) {
    emit({ ...state, loading: false, error: err instanceof Error ? err.message : String(err) });
  }
}

/** Deferred-to-first-subscriber load, same real fix as constructionSiteStore.ts's own §10 lesson: fetching unconditionally at module-import time can race a not-yet-authenticated session. */
export function ensureLogisticsFlowLoaded(): void {
  if (!loaded) void loadLogisticsFlow();
}

export function selectFlowPoint(id: string): void {
  emit({ ...state, selection: { kind: "point", id } });
}

export function selectFlowConnection(id: string): void {
  emit({ ...state, selection: { kind: "connection", id } });
}

export function clearFlowSelection(): void {
  if (state.selection !== null) emit({ ...state, selection: null });
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;
const MONITOR_POLL_MS = 8000;

/** Real fetch of one flow's live-monitor graph — the single source both manual Refresh and the Run polling loop call. */
export async function refreshFlowGraph(): Promise<void> {
  const flowId = state.selectedFlowId;
  if (!flowId) return;
  emit({ ...state, graphLoading: true, graphError: null });
  try {
    const graph = await api.getFlowGraph(flowId);
    // A flow switch (or clear) may have happened while this request was in
    // flight — never let a stale response overwrite the current selection.
    if (state.selectedFlowId !== flowId) return;
    emit({ ...state, graph, graphLoading: false, graphError: null });
  } catch (err) {
    if (state.selectedFlowId !== flowId) return;
    emit({ ...state, graphLoading: false, graphError: err instanceof Error ? err.message : String(err) });
  }
}

/** Scopes the Map/monitor to one real flow (or back to the unscoped cross-flow view, passing null). Stops any running monitor from the previous flow — a poll must never keep hitting an id the user navigated away from. */
export function selectFlow(flowId: string | null): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  emit({ ...state, selectedFlowId: flowId, graph: null, graphError: null, monitorRunning: false });
  if (flowId) void refreshFlowGraph();
}

/**
 * LIVE MONITOR mode (Phase 5, 2026-08-17) — deliberately NOT a simulation
 * engine. "Run" starts polling the real backend graph endpoint (which
 * itself only ever reflects real linked Vehicle/LogisticsDispatch state
 * plus real human-recorded holds/halts); it never advances anything on its
 * own client-side. Naming this "Run" (rather than e.g. "Watch") preserves
 * the eventual product vocabulary for a future true simulation mode
 * without pretending FF can already move material through the graph by
 * itself — see the Phase 5 architecture note in frontend/CLAUDE.md.
 */
export function startMonitor(): void {
  if (!state.selectedFlowId || monitorInterval) return;
  emit({ ...state, monitorRunning: true });
  void refreshFlowGraph();
  monitorInterval = setInterval(() => void refreshFlowGraph(), MONITOR_POLL_MS);
}

export function pauseMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  emit({ ...state, monitorRunning: false });
}

/**
 * Reset — per explicit correction, this must NEVER delete or edit a real
 * FlowPointStatusEvent. It only stops any running poll and re-fetches the
 * current authoritative graph fresh, i.e. "return the viewport to current
 * authoritative state and clear the active monitor snapshot." History
 * stays exactly as it was; only this transient client view changes.
 */
export function resetMonitor(): void {
  pauseMonitor();
  void refreshFlowGraph();
}
