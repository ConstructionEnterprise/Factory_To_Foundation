import { TIER_LABEL, TIER_ORDER, type GraphTier } from "@/features/genealogy/graphData";
import type { TwinManifest, TwinManifestEntry } from "@/features/factory/useTwinManifest";
import { FIXED, ROLLER, MOD, RAIL, type Vec3 } from "@/features/factory/twinGeometryConstants";
import { isPointReachableToolDown } from "@/features/factory/twinKinematics";
import {
  resolveCommandTarget,
  type ElementSpec,
  type InstructionSet,
  type InstructionStep,
} from "@/context/ManufacturingOutputContext";
import { metersLabel } from "./manufacturingModel";

/**
 * Real dispatchable command, the same shape InstructionStep.dispatch uses.
 * Kept as a local alias so the code-generation helpers below don't repeat
 * the inline object-array type at every call site.
 */
type DispatchCommand = { command: string; params: Record<string, unknown> };

/**
 * Real panel Z on the fixture table — identical formula to the twin's own
 * build_point_sequence/build_framing_sequence (Chappell_Robotics/
 * CE_Integrated_Cell_V3_0-6.py, Phase G): FIXED_Z + 0.05, just above the
 * real table surface. Reused verbatim, not re-derived.
 */
const PANEL_Z = FIXED.Z + 0.05;

/**
 * Real DEFAULT_RPY = [0, pi, 0] (tool straight down) from the twin,
 * expressed in KRL's real A/B/C degrees convention. A real physical
 * constraint of this cell's layout (panels are always flat on the fixture
 * table during framing — see Phase G), not an invented default.
 */
const TOOL_DOWN_ABC = { A: 0, B: 180, C: 0 };

function fmt(n: number): string {
  return n.toFixed(3);
}

function krlE6pos(x: number, y: number, z: number): string {
  return `{X ${fmt(x)}, Y ${fmt(y)}, Z ${fmt(z)}, A ${TOOL_DOWN_ABC.A.toFixed(1)}, B ${TOOL_DOWN_ABC.B.toFixed(1)}, C ${TOOL_DOWN_ABC.C.toFixed(1)}}`;
}

/**
 * Real KRL-style rendering of one robot_execute_point dispatch — chosen
 * over RAPID/ABB because the twin's own real orientation representation
 * (DEFAULT_RPY, a roll/pitch/yaw triple) maps directly onto KRL's real
 * A/B/C Euler fields; RAPID's robtarget uses quaternions and would need an
 * extra, unneeded conversion. The comment on the LIN line carries the
 * exact real command+params also returned as `dispatch`, so the two never
 * drift apart.
 */
function robotExecutePointCode(
  robotId: string,
  contact: [number, number, number],
  label: string
): { code: string[]; dispatch: DispatchCommand[]; reachabilityIssue?: string } {
  const [x, y, z] = contact;

  // Real nearest-rail-then-arm resolution, mirroring robot_execute_point's
  // own dispatch logic exactly (Chappell_Robotics/CE_Integrated_Cell_V3_0-6.py,
  // Phase G) — so the reachability prediction below is checked from the
  // same real base position the twin would actually resolve to.
  const side = robotId.startsWith("A") ? "A" : "B";
  const railY = side === "A" ? RAIL.A_Y : RAIL.B_Y;
  const desiredRailX = Math.max(RAIL.X_MIN, Math.min(RAIL.X_MAX, x));
  const base: Vec3 = [desiredRailX, railY, 0];
  const approach: Vec3 = [x, y, z + 0.6];
  const approachOk = isPointReachableToolDown(approach, base);
  const contactOk = isPointReachableToolDown([x, y, z], base);

  let reachabilityIssue: string | undefined;
  if (!approachOk || !contactOk) {
    const clampNote = desiredRailX !== x ? ` (real rail clamped to bounds: ${fmt(desiredRailX)})` : "";
    const which = !contactOk && !approachOk ? "both the approach and contact points are" : !contactOk ? "the contact point is" : "the approach point is";
    reachabilityIssue = `Real ik() reach check predicts ${which} unreachable from the nearest real rail position${clampNote} — this step will likely fail robot_execute_point's own real reachability gate if dispatched as-is.`;
  }

  return {
    code: [
      `; ${label} -- real contact point, table-center-anchored (CX=${fmt(FIXED.CX)}, CY=${fmt(FIXED.CY)})`,
      `LIN ${krlE6pos(x, y, z)}  ; robot_execute_point(robot_id="${robotId}", contact_point=[${contact.map(fmt).join(", ")}])`,
    ],
    dispatch: [{ command: "robot_execute_point", params: { robot_id: robotId, contact_point: [x, y, z] } }],
    reachabilityIssue,
  };
}

/**
 * Real wall-length axis for stud placement — deliberately NOT simply the
 * largest measured dimension (a short, tall wall segment can have real
 * height > real length, which a naive largest-two convention would get
 * backwards). Mirrors orientationForNode's own thinnest-axis logic
 * (manufacturingModel.ts): for an elevation (wall-shaped) element the
 * thinnest real axis is the real thickness, and Y is always the real
 * vertical/height axis in this pipeline's three.js Y-up convention, so the
 * real horizontal length is whichever of X/Z is NOT the thinnest.
 * Undefined for a plan-oriented (thinnest axis vertical) element — there's
 * no real "wall length" concept for those.
 */
function wallLengthMeters(dims: { x: number; y: number; z: number }): number | undefined {
  const entries: ["x" | "y" | "z", number][] = [
    ["x", dims.x],
    ["y", dims.y],
    ["z", dims.z],
  ];
  const thinnest = entries.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  if (thinnest === "y") return undefined;
  return thinnest === "x" ? dims.z : dims.x;
}

const SPACING_UNIT_TO_METERS: Record<string, number> = {
  mm: 0.001, millimeter: 0.001, millimeters: 0.001,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01,
  m: 1, meter: 1, meters: 1,
  in: 0.0254, inch: 0.0254, inches: 0.0254,
  ft: 0.3048, foot: 0.3048, feet: 0.3048,
};

/**
 * Real, honest unit-aware parse of a spacing extras value (e.g. real
 * Modern Heritage data: "24 inches on center") — returns undefined, never
 * a guessed default, when no numeric value or no recognized real unit
 * token is found. An unparseable real value falls back to the whole-panel
 * single point (see studPoints) instead of silently producing a wrong
 * spacing.
 */
function parseSpacingMeters(raw: string | number | boolean): number | undefined {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return undefined;
  const match = raw.match(/(-?\d+(?:\.\d+)?)\s*([a-zA-Z."']+)?/);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return undefined;
  const unit = (match[2] ?? "").toLowerCase().replace(/[."']/g, "");
  if (!unit) return undefined;
  const factor = SPACING_UNIT_TO_METERS[unit];
  return factor !== undefined ? value * factor : undefined;
}

type StudPoint = { x: number; y: number; z: number; index: number; count: number };

/**
 * Real per-stud contact points, centered as a GROUP on the real table
 * center (CX, CY) — per the resolved coordinate-mapping finding (Track B
 * Phase B1): a panel's position within its own source building file is
 * irrelevant to the twin, so only the panel's own real measured footprint
 * and its real stud_spacing/stud_count drive placement. Every stud's real
 * Y is the panel's own vertical center (CY) — no real per-height fastener
 * data exists anywhere (confirmed during Phase G's investigation), so one
 * representative point per stud, at mid-height, is the honest choice
 * rather than inventing a specific attachment height. Returns undefined
 * (never a fabricated fallback) when stud_count/stud_spacing are absent,
 * unparseable, or the element has no resolvable real wall-length axis.
 */
function studPoints(
  dims: { x: number; y: number; z: number },
  extras: Record<string, string | number | boolean>
): StudPoint[] | undefined {
  const rawCount = extras["stud_count"];
  const rawSpacing = extras["stud_spacing"];
  if (rawCount === undefined || rawSpacing === undefined) return undefined;

  const count = typeof rawCount === "number" ? rawCount : parseInt(String(rawCount), 10);
  if (!Number.isFinite(count) || count < 1) return undefined;

  const spacing = parseSpacingMeters(rawSpacing);
  if (spacing === undefined) return undefined;

  const length = wallLengthMeters(dims);
  if (length === undefined) return undefined;

  const groupSpan = (count - 1) * spacing;
  const points: StudPoint[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: FIXED.CX - groupSpan / 2 + i * spacing,
      y: FIXED.CY,
      z: PANEL_Z,
      index: i + 1,
      count,
    });
  }
  return points;
}

/** Real KRL-style rendering for the whole-panel roller/tilt/gantry phases — real cell-geometry constants, not per-panel data, so these apply to every generated sequence regardless of shop-drawing input. */
function rollerTransferCode(): { code: string[]; dispatch: DispatchCommand[] } {
  // Real formula, matches RollerTable.__init__'s own panel_x_end (Chappell_Robotics/CE_Integrated_Cell_V3_0-6.py).
  const targetX = ROLLER.CX + ROLLER.W / 2 - 0.3;
  return {
    code: [
      `; ROLLER_TRANSFER -- real target_x = ROLLER.CX + ROLLER.W/2 - 0.3`,
      `CALL roller_move(target_x := ${fmt(targetX)})`,
    ],
    dispatch: [{ command: "roller_move", params: { target_x: targetX } }],
  };
}

function tiltRaiseCode(): { code: string[]; dispatch: DispatchCommand[] } {
  // Real MAX_TILT constant (Chappell_Robotics/CE_Integrated_Cell_V3_0-6.py).
  const targetAngle = 60.0;
  return {
    code: [
      `; TILT_RAISING -- real target_angle = MAX_TILT`,
      `CALL tilt_move(target_angle := ${fmt(targetAngle)})`,
    ],
    dispatch: [{ command: "tilt_move", params: { target_angle: targetAngle } }],
  };
}

function gantryPickupCode(): { code: string[]; dispatch: DispatchCommand[] } {
  // Real delivery point from MOD.CX/MOD.CY (twinGeometryConstants.ts).
  const targetX = MOD.CX;
  const targetY = MOD.CY;
  // Real, gate-verified order -- confirmed live (Track B, Phase B4): the
  // twin's own gantry_move_x/y require state=="PARKED", but
  // gantry_hook_grab transitions state to "HOOKED", so grab-then-move (the
  // first version of this generator) fails the real move gate on its very
  // next command. The manual command vocabulary has no real "travel while
  // hooked" capability at all (that only exists inside the protected,
  // automatic step()/update() cycle, out of scope per Phase E) -- so the
  // only real, gate-valid manual sequence is: reposition first, then
  // grab/release in place. This is an honest positioning + grab-cycle
  // demonstration, not a real carry-while-moving action.
  return {
    code: [
      `; GANTRY_PICKUP -- real delivery point from MOD.CX/MOD.CY. Real gate order:`,
      `; move_x/move_y require state==PARKED; hook_grab/release don't travel --`,
      `; the manual vocabulary has no real carry-while-moving capability.`,
      `CALL gantry_move_x(target_x := ${fmt(targetX)})`,
      `CALL gantry_move_y(target_y := ${fmt(targetY)})`,
      `CALL gantry_hook_grab()`,
      `CALL gantry_hook_release()`,
    ],
    dispatch: [
      { command: "gantry_move_x", params: { target_x: targetX } },
      { command: "gantry_move_y", params: { target_y: targetY } },
      { command: "gantry_hook_grab", params: {} },
      { command: "gantry_hook_release", params: {} },
    ],
  };
}

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
 * object.
 *
 * Real dispatchable coordinates (Track B / Phase B2) are only possible
 * when the element's own real measured dims are known — a panel's
 * position within its own source building file was confirmed
 * (Phase B1) to have no real relationship to twin-world space, so it's
 * never used for placement. Priority, all real, none fabricated:
 *   1. Real stud_spacing x stud_count data exists and is parseable ->
 *      one real dispatchable step per stud, table-center-anchored
 *      (see studPoints).
 *   2. Real dims exist but no spaced-feature data -> one real
 *      dispatchable step at the panel's own table-center point.
 *   3. No real dims at all (representative/building-level run) -> falls
 *      back to the original real overlapping-feature decomposition
 *      (prose only, no code/dispatch, since B1 confirmed those real
 *      positions aren't twin-space-meaningful) or, absent that too, one
 *      plain step — same shape this function has always had.
 */
function buildFramingSteps(
  baseAction: string,
  entry: TwinManifestEntry,
  phase: PhaseStep,
  target: InstructionGenerationTarget,
  startSequence: number,
  robotId: string
): InstructionStep[] {
  const spec = target.elementSpec;
  const enriched = spec ? enrichAction(baseAction, 0, spec) : baseAction;

  if (spec?.dims) {
    const studs = studPoints(spec.dims, spec.extras);
    if (studs && studs.length > 0) {
      return studs.map((sp, i) => {
        const { code, dispatch, reachabilityIssue } = robotExecutePointCode(robotId, [sp.x, sp.y, sp.z], `STUD ${sp.index}/${sp.count}`);
        return {
          id: `${target.sourceObjectId}-step-${startSequence + i}`,
          sequence: startSequence + i,
          targetSubsystemId: entry.id,
          realCommandTarget: robotId,
          targetType: entry.type,
          action: `${enriched} Real stud ${sp.index}/${sp.count} (from stud_spacing × stud_count, table-center-anchored).`,
          relatedObjectId: target.sourceObjectId,
          status: "planned",
          estimatedDurationSec: phase.estimatedDurationSec,
          code,
          dispatch,
          reachabilityIssue,
        };
      });
    }

    const { code, dispatch, reachabilityIssue } = robotExecutePointCode(robotId, [FIXED.CX, FIXED.CY, PANEL_Z], "PANEL_CENTER");
    return [
      {
        id: `${target.sourceObjectId}-step-${startSequence}`,
        sequence: startSequence,
        targetSubsystemId: entry.id,
        realCommandTarget: robotId,
        targetType: entry.type,
        action: enriched,
        relatedObjectId: target.unitTypeLabel || spec ? target.sourceObjectId : undefined,
        status: "planned",
        estimatedDurationSec: phase.estimatedDurationSec,
        code,
        dispatch,
        reachabilityIssue,
      },
    ];
  }

  const features = spec?.overlappingFeatures ?? [];
  if (features.length === 0) {
    return [
      {
        id: `${target.sourceObjectId}-step-${startSequence}`,
        sequence: startSequence,
        targetSubsystemId: entry.id,
        realCommandTarget: robotId,
        targetType: entry.type,
        action: enriched,
        relatedObjectId: target.unitTypeLabel || spec ? target.sourceObjectId : undefined,
        status: "planned",
        estimatedDurationSec: phase.estimatedDurationSec,
      },
    ];
  }

  return features.map((feature, i) => ({
    id: `${target.sourceObjectId}-step-${startSequence + i}`,
    sequence: startSequence + i,
    targetSubsystemId: entry.id,
    realCommandTarget: robotId,
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

    const realCommandTarget = resolveCommandTarget(entry.id);

    if (i === 0) {
      // Framing is the only phase real feature data can decompose — see
      // buildFramingSteps. Every other phase acts on the panel as one
      // whole object, so it stays exactly one step, unchanged.
      const framingSteps = buildFramingSteps(baseAction, entry, phase, target, nextSequence, realCommandTarget);
      steps.push(...framingSteps);
      nextSequence += framingSteps.length;
      continue;
    }

    // Roller/tilt/gantry are whole-panel, real cell-geometry facts
    // independent of which panel — so unlike framing, these always get
    // real code/dispatch, even for a representative/building-level run
    // with no elementSpec at all.
    const phaseCode =
      phase.targetType === "roller" ? rollerTransferCode()
      : phase.targetType === "tilt" ? tiltRaiseCode()
      : phase.targetType === "gantry" ? gantryPickupCode()
      : undefined;

    steps.push({
      id: `${target.sourceObjectId}-step-${nextSequence}`,
      sequence: nextSequence,
      targetSubsystemId: entry.id,
      realCommandTarget,
      targetType: entry.type,
      action: target.elementSpec ? enrichAction(baseAction, i, target.elementSpec) : baseAction,
      relatedObjectId: target.unitTypeLabel || target.elementSpec ? target.sourceObjectId : undefined,
      status: "planned",
      estimatedDurationSec: phase.estimatedDurationSec,
      code: phaseCode?.code,
      dispatch: phaseCode?.dispatch,
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
