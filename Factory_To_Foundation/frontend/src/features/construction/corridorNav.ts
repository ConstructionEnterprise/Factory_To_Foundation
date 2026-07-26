import type { MapXZ } from "./mapProjection";

/**
 * Real endpoint data for one F»F delivery corridor, carried from a click on
 * Construction map's corridor arc to Logistics' map via react-router
 * navigation state (`navigate(path, { state })`) — deliberately NOT via
 * SelectionContext's "logistics" selection variant.
 *
 * Why not reuse `setSelected({ feature: "logistics", ... })` the same way
 * Factory→Robotics cross-nav does: Logistics' existing `LogisticsPayload`
 * is a fixed fixture shape (status/location/destination/loadInfo) that
 * `LogisticsInspector` reads unconditionally whenever `selected.feature ===
 * "logistics"`. A corridor is a real construction project's delivery
 * destination, not a shipment — forcing it through that shape would mean
 * fabricating a status/loadInfo that don't exist. `setSelected` is still
 * called on click (with `feature: "construction"`, the real, honest shape
 * for what was actually clicked), matching the reusable half of the
 * Phase 1 pattern; router state carries the other half — "where should the
 * destination page's camera look" — since that's a different concern than
 * "what inspector object is selected."
 */
export type CorridorTarget = {
  projectId: string;
  title: string;
  coords: MapXZ;
  /** True when the site itself is only county-level approximate (mirrors
   * Construction map's dashed-arc disclosure) — never a precise-looking
   * destination when the underlying site data isn't. */
  approx: boolean;
};

export type CorridorNavState = {
  corridorTarget: CorridorTarget;
};
