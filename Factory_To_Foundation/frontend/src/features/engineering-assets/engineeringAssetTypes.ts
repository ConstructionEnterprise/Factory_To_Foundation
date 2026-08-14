/**
 * Engineering Asset Catalog — data model only, not wired into any route or
 * page yet (§31 Robot Library workstream, Phase 4). Evolved from the
 * original asset-library plan's flat shape (name/category/tags/preview/
 * status) after Phase 1's engineering-recovery pass found that "browsable
 * catalog card" and "recovered engineering knowledge" are two different
 * things that shouldn't be collapsed into one record — see
 * simulations-/simulations/engineering-recovery/INDEX.md for the source
 * material this type model was built to fit, not invented ahead of it.
 *
 * Four layers, matching what Phase 1 actually recovered rather than a
 * pre-imagined schema: Engineering (what the simulation models physically),
 * Source (where it lives and whether it's touchable), Visualization
 * (renderer state — legacy, piloted, or none), Verification (how much of
 * this is actually confirmed vs. still just recovered documentation).
 */

export type EngineeringGeometry = {
  /** Free-text summary of the physical/kinematic model, not a re-derivation of the source. */
  summary: string;
  /** Named constant -> value + physical meaning, e.g. "MAX_REACH" -> "5.0 -- A2+A3+D6, full arm reach". */
  keyConstants?: Record<string, string>;
};

export type EngineeringBehavior = {
  /** The real state-machine sequence, as recovered, not idealized. */
  stateSequence?: string[];
  /** Narrative process description. */
  processFlow?: string;
};

export type EngineeringInterface = {
  name: string;
  description: string;
};

export type RelationshipKind =
  | "coordinate-space-match"
  | "lineage-predecessor"
  | "lineage-successor"
  | "subsystem-of"
  | "live-twin-correlation"
  | "shares-code-with";

export type EngineeringRelationship = {
  relatedAssetId: string;
  kind: RelationshipKind;
  description: string;
};

export type EngineeringRecord = {
  geometry?: EngineeringGeometry;
  behavior?: EngineeringBehavior;
  interfaces?: EngineeringInterface[];
  relationships?: EngineeringRelationship[];
  /** Path to the human-readable recovery record this was extracted from -- the .md is authoritative, this type is a structured index over it, not a replacement. */
  recoveryDocPath: string;
};

export type SourceRecord = {
  repository: string;
  path: string;
  /** Free-text lineage note (predecessor/successor version, migration history). */
  lineage?: string;
  /**
   * True for CE_Integrated_Cell_V3_0-6.py (and any future asset given the
   * same status): never modify, format, refactor, convert, rename, move,
   * or run migration tooling against the source. Reading for cataloging
   * remains fine. This flag is the enforcement point other tooling
   * (a future migration script, an "edit" UI action, etc.) should check.
   */
  immutable: boolean;
};

export type LegacyRenderer = "matplotlib" | "pygame" | "none";

export type MigrationClass =
  /** Has a World-style class with .step() already separated from drawing -- same pattern the pilot proved, just needs a snapshot() method added. */
  | "A"
  /** No classes; state is module-level globals mutated inside the draw callback -- needs a real separation introduced first. */
  | "C"
  /** Outside classification -- protected/immutable source. */
  | "D"
  /** Already migrated and verified (currently: assembly_cell_v100 only). */
  | "piloted";

export type VisualizationRecord = {
  currentRenderer: LegacyRenderer;
  migrationClass?: MigrationClass;
  migrationNotes?: string;
  previewImageUrl?: string;
  browserAssetUrl?: string;
};

export type RuntimeStatus =
  | "not-assessed"
  | "reference-only"
  | "runnable-headless"
  | "launchable-in-browser";

export type LiveTwinCorrelation =
  | "none"
  | "shared-coordinate-space"
  | "shared-robot-identity"
  | "is-the-live-twin";

export type VerificationRecord = {
  engineeringRecoveryStatus: "not-started" | "recovered";
  runtimeStatus: RuntimeStatus;
  liveTwinCorrelation: LiveTwinCorrelation;
  knownLimitations: string[];
};

/**
 * Deliberately more honest than a plain previewable/launchable/not_ready
 * triad -- "protected-reference" exists specifically so CE_Integrated_Cell_
 * V3_0-6 can be a legitimate catalog entry without ever implying it's
 * executable from this library or eligible for any migration action.
 */
export type EngineeringAssetStatus = "previewable" | "launchable" | "not_ready" | "protected-reference";

export type EngineeringAsset = {
  id: string;
  name: string;
  category: string;
  library: "robot" | "manufacturing";
  status: EngineeringAssetStatus;
  immutable: boolean;
  engineering: EngineeringRecord;
  source: SourceRecord;
  visualization: VisualizationRecord;
  verification: VerificationRecord;
};
