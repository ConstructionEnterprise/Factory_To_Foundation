import { TIER_LABEL, TIER_ORDER, type GraphTier } from "@/features/genealogy/graphData";
import type { TwinManifest, TwinManifestEntry } from "@/features/factory/useTwinManifest";
import {
  resolveCommandTarget,
  type InstructionSet,
  type InstructionStep,
} from "@/context/ManufacturingOutputContext";

export type InstructionGenerationTarget = {
  sourceObjectId: string;
  /** Real unit type label (e.g. "1 Bedroom") — absent for a building-level representative run. */
  unitTypeLabel?: string;
  level?: number;
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
  },
  {
    fromTier: "framing-package",
    toTier: "component",
    targetType: "roller",
    manifestId: () => "roller",
    realPhase: "ROLLER_TRANSFER",
    describe: () => "Transfer panel to the next station via the roller transfer table.",
  },
  {
    fromTier: "component",
    toTier: "subassembly",
    targetType: "tilt",
    manifestId: () => "tilt",
    realPhase: "TILT_RAISING",
    describe: () => "Reorient panel from flat to vertical via the tilt table.",
  },
  {
    fromTier: "subassembly",
    toTier: "module",
    targetType: "gantry",
    manifestId: () => "gantry",
    realPhase: "GANTRY_PICKUP",
    describe: () => "Lift and place the completed panel via the overhead gantry (phases GANTRY_PICKUP -> RETURNING -> COMPLETE).",
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

    steps.push({
      id: `${target.sourceObjectId}-step-${i + 1}`,
      sequence: i + 1,
      targetSubsystemId: entry.id,
      realCommandTarget: resolveCommandTarget(entry.id),
      targetType: entry.type,
      action: `[${tierNote}] ${phase.describe(side)} (${unitNote}; real phase: ${phase.realPhase})`,
      relatedObjectId: target.unitTypeLabel ? target.sourceObjectId : undefined,
      status: "planned",
    });
  }

  return {
    ok: true,
    instructionSet: {
      sourceObjectId: target.sourceObjectId,
      generatedAt: new Date().toISOString(),
      steps,
    },
  };
}
