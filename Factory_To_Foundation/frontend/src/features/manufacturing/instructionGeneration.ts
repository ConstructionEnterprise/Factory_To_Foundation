import { TIER_LABEL, TIER_ORDER, type GraphTier } from "@/features/genealogy/graphData";
import type { TwinManifest, TwinManifestEntry } from "@/features/factory/useTwinManifest";
import { FIXED } from "@/features/factory/twinGeometryConstants";
import {
  resolveCommandTarget,
  type ElementSpec,
  type InstructionSet,
  type InstructionStep,
} from "@/context/ManufacturingOutputContext";
import { metersLabel } from "./manufacturingModel";

export type InstructionGenerationTarget = {
  sourceObjectId: string;
  /** Real unit type label (e.g. "1 Bedroom") — absent for a building-level representative run. */
  unitTypeLabel?: string;
  level?: number;
  /**
   * Real shop-drawing-derived data for one fabricatable element — present
   * when generation was triggered by viewing an element's sheet (see
   * ManufacturingBrowse's ElementSheet), absent for the toolbar's
   * representative run. Enriches the SAME phase sequence with the
   * element's real measured data; it does not fork a second generator.
   */
  elementSpec?: ElementSpec;
};

/**
 * A fabrication-relevant slice of the real 7-tier genealogy progression —
 * Building/Project are portfolio tiers, not manufacturing-cell operations,
 * so they're excluded here. Each transition is crossed with a real
 * manifest subsystem type, grounded in the twin's real master-phase
 * sequence (RAIL_WORKING -> ROLLER_TRANSFER -> TILT_RAISING ->
 * GANTRY_PICKUP -> RETURNING/COMPLETE, confirmed via
 * CE_Integrated_Cell_V3_0-6.py's IntegratedCell.step()) — not arbitrary.
 */
const FABRICATION_TIERS: GraphTier[] = TIER_ORDER.filter(
  (tier) => tier !== "building" && tier !== "project"
);

type PhaseStep = {
  fromTier: GraphTier;
  toTier: GraphTier;
  targetType: string;
  /** Manifest id builder — takes the deterministically-picked cell side ("A" | "B"). */
  manifestId: (side: "A" | "B") => string;
  realPhase: string;
  describe: (side: "A" | "B") => string;
  /** ILLUSTRATIVE ONLY — see InstructionStep.estimatedDurationSec. A reasonable round per-phase-type estimate, not measured/real. */
  estimatedDurationSec: number;
};

const PHASE_STEPS: PhaseStep[] = [
  {
    fromTier: "material",
    toTier: "framing-package",
    targetType: "robot",
    manifestId: (side) => `robots.${side}1`,
    realPhase: "RAIL_WORKING",
    describe: (side) =>
      `Framing & fastening pass — rail-mounted robot ${side}1 works the panel using its currently-mounted tool (sourced from its home ATC).`,
    estimatedDurationSec: 30,
  },
  {
    fromTier: "framing-package",
    toTier: "component",
    targetType: "roller",
    manifestId: () => "roller",
    realPhase: "ROLLER_TRANSFER",
    describe: () => "Transfer panel to the next station via the roller transfer table.",
    estimatedDurationSec: 15,
  },
  {
    fromTier: "component",
    toTier: "subassembly",
    targetType: "tilt",
    manifestId: () => "tilt",
    realPhase: "TILT_RAISING",
    describe: () => "Reorient panel from flat to vertical via the tilt table.",
    estimatedDurationSec: 20,
  },
  {
    fromTier: "subassembly",
    toTier: "module",
    targetType: "gantry",
    manifestId: () => "gantry",
    realPhase: "GANTRY_PICKUP",
    describe: () => "Lift and place the completed panel via the overhead gantry (phases GANTRY_PICKUP -> RETURNING -> COMPLETE).",
    estimatedDurationSec: 15,
  },
];

// Sanity check that FABRICATION_TIERS actually matches the transitions
// PHASE_STEPS encodes — if the real genealogy tier list ever changes
// shape, this throws loudly instead of silently generating a wrong sequence.
if (FABRICATION_TIERS.length !== PHASE_STEPS.length + 1) {
  throw new Error(
    "instructionGeneration: FABRICATION_TIERS no longer matches PHASE_STEPS — update the phase crossing."
  );
}

function findEntry(manifest: TwinManifest, id: string): TwinManifestEntry | undefined {
  return manifest.find((entry) => entry.id === id);
}

/** Deterministic, stable per source object — not random — so regenerating the same target yields the same side. */
function pickSide(sourceObjectId: string): "A" | "B" {
  let sum = 0;
  for (let i = 0; i < sourceObjectId.length; i++) sum += sourceObjectId.charCodeAt(i);
  return sum % 2 === 0 ? "A" : "B";
}

export type InstructionGenerationResult =
  | { ok: true; instructionSet: InstructionSet }
  | { ok: false; reason: string };

/**
 * Real per-phase enrichment from an element's real shop-drawing data.
 * Purely generic: dimension math and verbatim extras only — no name or
 * key-pattern branching anywhere, so every uploaded file takes this
 * identical path (§6.15 discipline).
 */
function enrichAction(baseAction: string, phaseIndex: number, spec: ElementSpec): string {
  const notes: string[] = [];
  if (phaseIndex === 0) {
    // Framing pass — the element's real measured envelope + real source metadata.
    if (spec.dims) {
      notes.push(
        `Real measured envelope: ${metersLabel(spec.dims.x)} × ${metersLabel(spec.dims.y)} × ${metersLabel(spec.dims.z)}.`
      );
    }
    const extraEntries = Object.entries(spec.extras);
    if (extraEntries.length > 0) {
      notes.push(`Real source metadata: ${extraEntries.map(([k, v]) => `${k}=${String(v)}`).join(", ")}.`);
    }
  }
  if (phaseIndex === 2 && spec.orientationKind) {
    // Tilt stage — the element's real thinnest-axis orientation vs. the cell's fixed flat->vertical flow.
    notes.push(
      spec.orientationKind === "elevation"
        ? "Element is wall-shaped (real thinnest axis horizontal) — the tilt stage's flat→vertical reorientation ends at this element's real installed orientation."
        : "Element is plan-oriented (real thinnest axis vertical) — the cell's fixed flow still tilts panels to vertical for gantry pickup; final flat installation orientation is beyond this cell's modeled flow."
    );
  }
  return notes.length > 0 ? `${baseAction} ${notes.join(" ")}` : baseAction;
}

function formatPosition(p: { x: number; y: number; z: number }): string {
  return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) m`;
}

/**
 * The framing phase specifically — the only phase that can real-ly
 * decompose per element, since fastening happens AT specific real
 * locations while roller/tilt/gantry act on the whole panel as one
 * object. Real overlapping features (see findOverlappingFeatures) each
 * become their own real sub-step with a real position; zero features
 * stays exactly one step, same as before this existed — no padding, no
 * invented minimum count.
 */
function buildFramingSteps(
  baseAction: string,
  entry: TwinManifestEntry,
  phase: PhaseStep,
  target: InstructionGenerationTarget,
  startSequence: number
): InstructionStep[] {
  const features = target.elementSpec?.overlappingFeatures ?? [];
  const enriched = target.elementSpec ? enrichAction(baseAction, 0, target.elementSpec) : baseAction;

  if (features.length === 0) {
    return [
      {
        id: `${target.sourceObjectId}-step-${startSequence}`,
        sequence: startSequence,
        targetSubsystemId: entry.id,
        realCommandTarget: resolveCommandTarget(entry.id),
        targetType: entry.type,
        action: enriched,
        relatedObjectId: target.unitTypeLabel || target.elementSpec ? target.sourceObjectId : undefined,
        status: "planned",
        estimatedDurationSec: phase.estimatedDurationSec,
      },
    ];
  }

  return features.map((feature, i) => ({
    id: `${target.sourceObjectId}-step-${startSequence + i}`,
    sequence: startSequence + i,
    targetSubsystemId: entry.id,
    realCommandTarget: resolveCommandTarget(entry.id),
    targetType: entry.type,
    action: `${enriched} Real co-located feature ${i + 1}/${features.length}: "${feature.name}" at ${formatPosition(feature.position)}.`,
    relatedObjectId: feature.id,
    status: "planned",
    estimatedDurationSec: phase.estimatedDurationSec,
  }));
}

/**
 * Real fit check: the element lies flat on the fixture table, so its two
 * LARGEST real dimensions occupy the table plane (the smallest is its
 * thickness). Compared against the twin's real TABLE_JIG_FIXED constants
 * — a genuinely computed statement with its real numbers, either way.
 */
function buildFabricationNotes(spec: ElementSpec): string[] {
  if (!spec.dims) return [];
  const sorted = [Math.abs(spec.dims.x), Math.abs(spec.dims.y), Math.abs(spec.dims.z)].sort((a, b) => b - a);
  const [d1, d2] = sorted;
  const fits = d1 <= FIXED.W && d2 <= FIXED.D;
  return [
    fits
      ? `Fits the real fixture table: element footprint ${metersLabel(d1)} × ${metersLabel(d2)} within TABLE_JIG_FIXED ${metersLabel(FIXED.W)} × ${metersLabel(FIXED.D)}.`
      : `Exceeds the real fixture table: element footprint ${metersLabel(d1)} × ${metersLabel(d2)} vs TABLE_JIG_FIXED ${metersLabel(FIXED.W)} × ${metersLabel(FIXED.D)} — cannot be fabricated in one piece on this cell as modeled.`,
  ];
}

/**
 * Builds a real, readable planned sequence — never executed, never written
 * to command_queue.json (see ManufacturingOutputContext). Every
 * targetSubsystemId/realCommandTarget comes from a real manifest lookup;
 * if the manifest is missing an id this sequence needs, generation fails
 * loudly instead of inventing one.
 */
export function generateInstructionSet(
  target: InstructionGenerationTarget,
  manifest: TwinManifest
): InstructionGenerationResult {
  const side = pickSide(target.sourceObjectId);
  const steps: InstructionStep[] = [];
  let nextSequence = 1;

  for (let i = 0; i < PHASE_STEPS.length; i++) {
    const phase = PHASE_STEPS[i];
    const manifestId = phase.manifestId(side);
    const entry = findEntry(manifest, manifestId);
    if (!entry) {
      return {
        ok: false,
        reason: `Manifest has no entry for "${manifestId}" — cannot generate a real-subsystem-grounded step without it.`,
      };
    }

    const tierNote = `${TIER_LABEL[phase.fromTier]} → ${TIER_LABEL[phase.toTier]}`;
    const unitNote = target.unitTypeLabel
      ? `${target.unitTypeLabel}${target.level !== undefined ? ` (Level ${target.level})` : ""}`
      : "typical residential module";

    const baseAction = `[${tierNote}] ${phase.describe(side)} (${unitNote}; real phase: ${phase.realPhase})`;

    if (i === 0) {
      // Framing is the only phase real feature data can decompose — see
      // buildFramingSteps. Every other phase acts on the panel as one
      // whole object, so it stays exactly one step, unchanged.
      const framingSteps = buildFramingSteps(baseAction, entry, phase, target, nextSequence);
      steps.push(...framingSteps);
      nextSequence += framingSteps.length;
      continue;
    }

    steps.push({
      id: `${target.sourceObjectId}-step-${nextSequence}`,
      sequence: nextSequence,
      targetSubsystemId: entry.id,
      realCommandTarget: resolveCommandTarget(entry.id),
      targetType: entry.type,
      action: target.elementSpec ? enrichAction(baseAction, i, target.elementSpec) : baseAction,
      relatedObjectId: target.unitTypeLabel || target.elementSpec ? target.sourceObjectId : undefined,
      status: "planned",
      estimatedDurationSec: phase.estimatedDurationSec,
    });
    nextSequence += 1;
  }

  return {
    ok: true,
    instructionSet: {
      sourceObjectId: target.sourceObjectId,
      generatedAt: new Date().toISOString(),
      steps,
      elementSpec: target.elementSpec,
      fabricationNotes: target.elementSpec ? buildFabricationNotes(target.elementSpec) : undefined,
    },
  };
}
