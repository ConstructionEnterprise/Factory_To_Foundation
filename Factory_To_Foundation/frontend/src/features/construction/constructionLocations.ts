import { projectLonLat, type MapXZ } from "./mapProjection";
import type { SiteOverride } from "./constructionSiteStore";

/**
 * Location layer for the Construction Enterprises Map.
 *
 * Real data only in the fixture layer — investigated before this was
 * written (see the map pass in CLAUDE.md):
 * - Garden Lofts is the ONLY project with a real location source:
 *   garden_lofts_params_v2.json (the canonical "Sheet 1" spec Manufacturing
 *   already treats as ground truth) says PROJECT.LOCATION = "Lewisville,
 *   Texas". Lewisville is in Denton County — real, derivable.
 * - Stonepine, Cedarwood Flats, and Skyline Towers have NO location source
 *   anywhere (frontend fixtures, Construction_Enterprises repo, Garden
 *   Lofts source files all checked). They ship as honest "unlocated" —
 *   user-confirmed decision — and are sited in-app instead.
 * - Chappell International (the factory) is real and precise: Saginaw, TX,
 *   Tarrant County (user-confirmed real location; the lon/lat below is
 *   Saginaw's real city-center geography).
 *
 * In-app assignments live in real Postgres via the ff-backend API
 * (constructionSiteStore, Phase 3a of the enterprise migration — no longer
 * localStorage), keyed by project id; this fixture layer is the default
 * underneath.
 */

export type SitePrecision = "unlocated" | "region" | "address" | "sited";

type FixtureLocation = {
  /** County name — present only when a real source exists. */
  region?: string;
  /** Provenance of the region value (or of its honest absence). */
  source: string;
};

export const PROJECT_FIXTURE_LOCATIONS: Record<string, FixtureLocation> = {
  stonepine: { source: "No location source exists in the real data" },
  cedarwood: { source: "No location source exists in the real data" },
  "garden-lofts": {
    region: "Denton",
    source: "garden_lofts_params_v2.json: PROJECT.LOCATION = \"Lewisville, Texas\" (Denton County)",
  },
  skyline: { source: "No location source exists in the real data" },
};

export function isConstructionProjectId(id: string): boolean {
  return id in PROJECT_FIXTURE_LOCATIONS;
}

/** The F»F factory node — not a construction project, the hub the modules ship from. */
export const FACTORY_NODE = {
  id: "chappell-international",
  title: "Chappell International",
  region: "Tarrant",
  address: "Saginaw, TX",
  // Real Saginaw, TX city-center geography (WGS84).
  lonLat: [-97.364, 32.86] as [number, number],
};

export const FACTORY_COORDS: MapXZ = projectLonLat(FACTORY_NODE.lonLat);

export type ResolvedSite = {
  projectId: string;
  precision: SitePrecision;
  region?: string;
  address?: string;
  /** Map-space position (1 unit = 1 km) — present only for 'sited'/'address'. */
  coords?: MapXZ;
  source: string;
};

/**
 * Merge the fixture layer with the real backend-sourced overrides into one
 * resolved site. Precision is derived, never stored:
 * - coords assigned  → 'sited' (or 'address' when an address string is also set)
 * - no coords        → 'region' if a real county is known, else 'unlocated'
 * An address string without coords is metadata only — it never promotes
 * placement precision, because we have no geocoding (deliberately).
 */
export function resolveSite(projectId: string, overrides: Record<string, SiteOverride>): ResolvedSite {
  const fixture = PROJECT_FIXTURE_LOCATIONS[projectId];
  const override = overrides[projectId];
  const address = override?.address || undefined;
  const coords = override?.coords;

  if (coords) {
    return {
      projectId,
      precision: address ? "address" : "sited",
      region: fixture?.region,
      address,
      coords,
      source: "Placed in-app (real backend, Postgres via the ff-backend API)",
    };
  }
  return {
    projectId,
    precision: fixture?.region ? "region" : "unlocated",
    region: fixture?.region,
    address,
    source: fixture?.source ?? "Unknown project id",
  };
}
