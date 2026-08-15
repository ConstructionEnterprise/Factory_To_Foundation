import { useSyncExternalStore } from "react";

import * as api from "./logisticsFlowApi";
import type { FlowConnection, FlowPoint } from "./logisticsFlowApi";

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
  points: FlowPoint[];
  connections: FlowConnection[];
  loading: boolean;
  error: string | null;
  selection: FlowSelection | null;
};

let state: State = { points: [], connections: [], loading: false, error: null, selection: null };
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
    const [points, connections] = await Promise.all([api.listFlowPoints(), api.listFlowConnections()]);
    loaded = true;
    emit({ ...state, points, connections, loading: false, error: null });
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
