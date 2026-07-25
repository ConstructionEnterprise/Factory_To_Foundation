import { useSyncExternalStore } from "react";

/**
 * In-app site assignments for the Construction Enterprises Map, plus the
 * map's transient UI state (placement mode, hover sync with Browse).
 *
 * Persistence (Phase 3a — enterprise migration): real Postgres via the
 * backend API (backend/src/routes/constructionSites.ts,
 * http://localhost:4300/construction-sites), not localStorage anymore.
 * Full cutover, no localStorage fallback — deliberate: a stale local cache
 * sitting next to a real backend risks the two silently diverging, which
 * is a worse failure mode than an honest "couldn't reach the server" error
 * surfaced via `error` below when the backend isn't running.
 *
 * resolveSite() (constructionLocations.ts) is unchanged and still owns
 * precision — it merges the frontend-only fixture layer (never migrated to
 * SQL, per schema.prisma's own scope note) with whatever `overrides` this
 * store hands it, exactly as before. Only where `overrides` comes from
 * changed; the merge itself is still real application-layer logic, per
 * ConstructionSite's own "no precision column" design.
 *
 * Same module-level store + useSyncExternalStore pattern as
 * manufacturingModel's version counter — small, no context provider needed.
 */

const API_BASE = "http://localhost:4300";

export type SiteCoords = { x: number; z: number };
export type SiteOverride = { address?: string; coords?: SiteCoords };

type SiteState = {
  overrides: Record<string, SiteOverride>;
  /** Project id currently waiting for a map click to set its coords. */
  placementFor: string | null;
  /** Project/factory id hovered in the map or the Browse panel (both sync here). */
  hoveredId: string | null;
  /** True until the initial GET /construction-sites resolves — the one real async gap a synchronous localStorage read never had. */
  loading: boolean;
  /** Last real fetch/save failure, human-readable — null when nothing's wrong. */
  error: string | null;
};

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

let state: SiteState = { overrides: {}, placementFor: null, hoveredId: null, loading: true, error: null };
const listeners = new Set<() => void>();

function emit(next: Partial<SiteState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function useSiteState(): SiteState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

type SiteDto = { projectId: string } & SiteOverride;

async function loadSites() {
  try {
    const res = await fetch(`${API_BASE}/construction-sites`);
    if (!res.ok) throw new Error(`server responded ${res.status}`);
    const sites = (await res.json()) as SiteDto[];
    const overrides: Record<string, SiteOverride> = {};
    for (const site of sites) overrides[site.projectId] = { address: site.address, coords: site.coords };
    emit({ overrides, loading: false, error: null });
  } catch (err) {
    emit({ loading: false, error: `Couldn't reach the site server — sites unavailable this session (${describeError(err)})` });
  }
}

void loadSites();

export function setSiteAddress(projectId: string, address: string) {
  const previous = state.overrides[projectId] ?? {};
  const trimmed = address.trim();
  emit({ overrides: { ...state.overrides, [projectId]: { ...previous, address: trimmed || undefined } }, error: null });

  void fetch(`${API_BASE}/construction-sites/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: trimmed }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`server responded ${res.status}`);
      const site = (await res.json()) as SiteDto;
      emit({ overrides: { ...state.overrides, [projectId]: { address: site.address, coords: site.coords } } });
    })
    .catch((err) => {
      // Roll back to the last known-good value — never leave the UI
      // showing an edit that was never actually persisted.
      emit({ overrides: { ...state.overrides, [projectId]: previous }, error: `Couldn't save address (${describeError(err)})` });
    });
}

export function setSiteCoords(projectId: string, coords: SiteCoords) {
  const previous = state.overrides[projectId] ?? {};
  emit({
    overrides: { ...state.overrides, [projectId]: { ...previous, coords } },
    placementFor: null,
    error: null,
  });

  void fetch(`${API_BASE}/construction-sites/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coords }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`server responded ${res.status}`);
      const site = (await res.json()) as SiteDto;
      emit({ overrides: { ...state.overrides, [projectId]: { address: site.address, coords: site.coords } } });
    })
    .catch((err) => {
      emit({ overrides: { ...state.overrides, [projectId]: previous }, error: `Couldn't save location (${describeError(err)})` });
    });
}

export function clearSite(projectId: string) {
  const previous = state.overrides[projectId];
  const next = { ...state.overrides };
  delete next[projectId];
  emit({ overrides: next, placementFor: state.placementFor === projectId ? null : state.placementFor, error: null });

  void fetch(`${API_BASE}/construction-sites/${projectId}`, { method: "DELETE" }).catch((err) => {
    // Roll back the optimistic clear if the delete never actually reached the server.
    if (previous) emit({ overrides: { ...state.overrides, [projectId]: previous }, error: `Couldn't clear site (${describeError(err)})` });
  });
}

export function startPlacement(projectId: string) {
  emit({ placementFor: projectId });
}

export function cancelPlacement() {
  if (state.placementFor !== null) emit({ placementFor: null });
}

export function setHoveredSite(id: string | null) {
  if (state.hoveredId !== id) emit({ hoveredId: id });
}
