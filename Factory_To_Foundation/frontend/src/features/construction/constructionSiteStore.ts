import { useSyncExternalStore } from "react";

import { AUTH_CHANGED_EVENT } from "@/context/AuthContext";
import { authFetch } from "@/lib/authFetch";

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
 * Real RBAC (Phase 3b): every request below sends `credentials: "include"`
 * so the httpOnly auth cookies actually reach the API — without it, every
 * call here would 401 even for a genuinely logged-in user, since fetch()
 * doesn't send cookies cross-origin by default. `describeResponseError()`
 * surfaces the backend's real `{ error }` body (e.g. a 403's exact missing
 * permission), not a generic "server responded 403".
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

/** Reads the real `{ error: string }` body the backend's error handler always sends (auth.ts's middleware included) rather than a generic "server responded 4xx" — a 403 should say which permission is missing, not just that something failed. */
async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

let state: SiteState = { overrides: {}, placementFor: null, hoveredId: null, loading: true, error: null };
const listeners = new Set<() => void>();

function emit(next: Partial<SiteState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

type SiteDto = { projectId: string } & SiteOverride;

async function loadSites() {
  try {
    const res = await authFetch(`${API_BASE}/construction-sites`);
    if (!res.ok) throw new Error(await describeResponseError(res));
    const sites = (await res.json()) as SiteDto[];
    const overrides: Record<string, SiteOverride> = {};
    for (const site of sites) overrides[site.projectId] = { address: site.address, coords: site.coords };
    emit({ overrides, loading: false, error: null });
  } catch (err) {
    emit({ loading: false, error: `Couldn't reach the site server — sites unavailable this session (${describeError(err)})` });
  }
}

// Real fix for a real bug (Phase 3b): this store used to kick off its
// initial fetch unconditionally at module-import time. Once auth existed,
// that fetch almost always fired BEFORE the user had actually logged in
// (route components are all eagerly imported, regardless of what the auth
// gate in App.tsx is currently rendering) — it failed with a real 401, and
// nothing ever retried after login actually succeeded. Fixed by deferring
// the fetch until the first real subscriber (i.e. a mounted Construction
// component) shows up, which can only happen once the user is past the
// auth gate — confirmed live: logging in and opening Construction now
// loads real site data instead of surfacing a stale "Not authenticated".
let loadStarted = false;
function ensureSitesLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void loadSites();
}

// Real second bug found live, same root cause: the "only ever once" guard
// above means logging out and back in as a DIFFERENT role — with no full
// page reload in between, since this is a real SPA — never re-fetched.
// Confirmed live: restoring two real site placements while logged in as
// CEO, then switching to that same browser tab's already-initialized app,
// still showed the old "Not authenticated"/empty state from a prior
// session. Fixed by forcing a real reload on every genuine auth
// transition (AuthContext's AUTH_CHANGED_EVENT — fired on initial resolve,
// login, and logout), not just the first-ever mount.
window.addEventListener(AUTH_CHANGED_EVENT, () => {
  loadStarted = true;
  emit({ loading: true });
  void loadSites();
});

export function useSiteState(): SiteState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      ensureSitesLoaded();
      return () => listeners.delete(l);
    },
    () => state
  );
}

export function setSiteAddress(projectId: string, address: string) {
  const previous = state.overrides[projectId] ?? {};
  const trimmed = address.trim();
  emit({ overrides: { ...state.overrides, [projectId]: { ...previous, address: trimmed || undefined } }, error: null });

  void authFetch(`${API_BASE}/construction-sites/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: trimmed }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(await describeResponseError(res));
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

  void authFetch(`${API_BASE}/construction-sites/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coords }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(await describeResponseError(res));
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

  void authFetch(`${API_BASE}/construction-sites/${projectId}`, { method: "DELETE" })
    .then(async (res) => {
      if (!res.ok) throw new Error(await describeResponseError(res));
    })
    .catch((err) => {
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
