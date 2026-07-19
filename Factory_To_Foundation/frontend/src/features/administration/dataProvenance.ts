/**
 * The single real source of truth for "is this feature showing real data
 * or fixture data" — operationalizes what's otherwise only written as
 * prose in CLAUDE.md / FF_Frontend_OS_Handoff.md into real UI. Kept as
 * one small, easy-to-update table rather than scattered inline claims —
 * when a feature's status changes (e.g. Robotics gets wired to the twin
 * bridge), this is the one place that needs updating.
 *
 * `status` values, in order of "how real":
 * - "real-live"      — reads a live, currently-running data source.
 * - "real-static"     — real data, but a fixed real dataset/structural
 *                        fact, not something that updates live.
 * - "real-structure-fixture-values" — the shape/structure is real
 *                        (seeded from a real source), but the values
 *                        shown today are still fixture placeholders.
 * - "fixture"          — end-to-end fixture data, nothing real behind it
 *                        yet beyond whatever structural grouping field
 *                        (zone, category) the Browse panel groups by.
 */
export type DataProvenanceStatus = "real-live" | "real-static" | "real-structure-fixture-values" | "fixture";

export type FeatureProvenance = {
  feature: string;
  status: DataProvenanceStatus;
  summary: string;
  source: string;
};

export const dataProvenance: FeatureProvenance[] = [
  {
    feature: "Genealogy",
    status: "real-static",
    summary:
      "Real 7-tier hierarchy (Material → Framing-Package → Component → Sub-Assembly → Module → Building → Project), rebuilt from CE_Genealogy_AllInOne-5.py's build_thread(), with the real QR/prefix scheme ported alongside it. One real thread, not live production data.",
    source: "features/genealogy/graphData.ts + genealogyRegistry.ts",
  },
  {
    feature: "Factory",
    status: "real-live",
    summary:
      "All 13 real subsystems from the twin's cell_manifest.json render; 7 (gantry, roller, tilt, 4 robots) show real live state.json status, the other 6 (2 rails, 4 ATCs) honestly show “unknown” — real identities with no live data behind them yet. Shows an honest “Twin Offline” state with no nodes at all if the bridge isn't reachable, never stale/fabricated data.",
    source: "twin-bridge/server.mjs (polls the digital twin) + features/factory/useTwinManifest.ts, useTwinState.ts",
  },
  {
    feature: "Robotics",
    status: "real-structure-fixture-values",
    summary:
      "Real subsystem structure seeded from the twin's own object model (1 RailSubsystem + 4 ATCSubsystem, each with real 4-tool loadouts) — but live status/task/cycle-time values are still fixture placeholders. Deliberately not wired to the twin bridge yet, waiting for the manifest-driven pattern proven on Factory to extend here.",
    source: "features/robotics/roboticsData.ts",
  },
  {
    feature: "Logistics",
    status: "fixture",
    summary:
      "Fixture yard/dock/transportation data end to end. Browse is grouped by the real “zone” field, but the underlying records themselves are fixture, not live.",
    source: "features/logistics/logisticsData.ts",
  },
  {
    feature: "Construction",
    status: "real-structure-fixture-values",
    summary:
      "Real Construction Enterprises project/building/floor structure (4 real projects: Stonepine Residences, Cedarwood Flats Buildings A–E, Garden Lofts' 20 floors, Skyline Towers' 40 floors). Progress values are mixed: Cedarwood's original Buildings A/B/C carry plausible-but-fixture progress numbers; every building/floor added since (D/E, all Garden Lofts/Skyline floors, Stonepine) shows an honest “no progress data yet” placeholder instead of extending that fixture.",
    source: "features/construction/constructionData.ts",
  },
  {
    feature: "Manufacturing",
    status: "real-static",
    summary:
      "Real, source-agnostic geometry ingestion — a real local blender-bridge service converts an uploaded .blend file via headless Blender and replaces the loaded model (replace semantics, not a library). The tree, per-node metadata, selection, and generated sheets all walk whatever real hierarchy and real custom-property extras the uploaded file actually contains, with no hardcoded naming pattern or per-project field list — verified against two structurally different real files (Garden Lofts' object-parented tower, Modern Heritage's Collection-grouped framing). The Manufacturing → Factory instruction generator does a real live twin-manifest lookup at generation time, but the generated instruction text itself is illustrative planning content, never executed.",
    source: "blender-bridge/server.mjs + features/manufacturing/manufacturingModel.ts",
  },
  {
    feature: "Scheduling",
    status: "real-static",
    summary:
      "Real 5-stage pipeline taxonomy modeled as real IEC 61131-3-style function blocks — real named ports, real port-to-port wires. Structural only (Phase 1): no execution engine, no live values flow through the wires. “Inbound Material” still has no owning feature — an open gap, not an oversight.",
    source: "features/scheduling/scheduleData.ts",
  },
  {
    feature: "Assets",
    status: "fixture",
    summary:
      "Fixture equipment/vehicle/tool data end to end. Browse is grouped by the real “category” field, but the underlying records are fixture, not live.",
    source: "features/assets/assetsData.ts",
  },
];
