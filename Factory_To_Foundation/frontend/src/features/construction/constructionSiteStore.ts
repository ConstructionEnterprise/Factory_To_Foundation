import { useSyncExternalStore } from "react";

/**
 * In-app site assignments for the Construction Enterprises Map, plus the
 * map's transient UI state (placement mode, hover sync with Browse).
 *
 * Persistence: assignments (address strings + map-click coordinates) go to
 * a localStorage overlay keyed by project id — the fixture location layer
 * in constructionLocations.ts stays the default underneath, so clearing an
 * assignment falls back to the honest fixture state (region-level for
 * Garden Lofts, unlocated for the rest). Placement mode and hover are
 * in-memory only.
 *
 * Same module-level store + useSyncExternalStore pattern as
 * manufacturingModel's version counter — small, no context provider needed.
 */

export type SiteCoords = { x: number; z: number };
export type SiteOverride = { address?: string; coords?: SiteCoords };

type SiteState = {
  overrides: Record<string, SiteOverride>;
  /** Project id currently waiting for a map click to set its coords. */
  placementFor: string | null;
  /** Project/factory id hovered in the map or the Browse panel (both sync here). */
  hoveredId: string | null;
};

const STORAGE_KEY = "ff-construction-sites";

function loadOverrides(): Record<string, SiteOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, SiteOverride>;
  } catch {
    return {};
  }
}

let state: SiteState = { overrides: loadOverrides(), placementFor: null, hoveredId: null };
const listeners = new Set<() => void>();

function emit(next: Partial<SiteState>, persistOverrides = false) {
  state = { ...state, ...next };
  if (persistOverrides) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.overrides));
    } catch {
      // Storage unavailable (private mode etc.) — assignments still work for the session.
    }
  }
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

export function setSiteAddress(projectId: string, address: string) {
  const existing = state.overrides[projectId] ?? {};
  const trimmed = address.trim();
  const nextOverride: SiteOverride = { ...existing, address: trimmed || undefined };
  emit({ overrides: { ...state.overrides, [projectId]: nextOverride } }, true);
}

export function setSiteCoords(projectId: string, coords: SiteCoords) {
  const existing = state.overrides[projectId] ?? {};
  emit(
    {
      overrides: { ...state.overrides, [projectId]: { ...existing, coords } },
      placementFor: null,
    },
    true
  );
}

export function clearSite(projectId: string) {
  const next = { ...state.overrides };
  delete next[projectId];
  emit({ overrides: next, placementFor: state.placementFor === projectId ? null : state.placementFor }, true);
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
