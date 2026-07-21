import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * The first cross-feature data flow in FF: Manufacturing writes a derived,
 * human-readable planned sequence here; Factory reads it. Same pattern as
 * SelectionContext (context + provider + hook), scoped only to this one
 * flow. In-memory only, not persisted — regenerating from the real ingested
 * geometry + live manifest is cheap, and nothing else in FF persists yet.
 *
 * This is explicitly the "simple version": a planning artifact, never
 * executed, never written to command_queue.json. See resolveCommandTarget
 * below for why the shape has two separate target fields.
 */
export type InstructionStep = {
  id: string;
  sequence: number;
  /** Real manifest id from cell_manifest.json, e.g. "robots.A1", "gantry", "atc_A_near" — what the manifest and Factory's own UI already use consistently for display/cross-referencing. */
  targetSubsystemId: string;
  /**
   * The actual resolve_target()-compatible name on the twin's `cell` object
   * — NOT always the same string as targetSubsystemId. Confirmed via direct
   * investigation of Construction_Enterprises/Chappell_Robotics: for 9 of 13
   * manifest identities (gantry, roller, tilt, rail_A, rail_B, and the 4
   * ATCs) this is identical. For the 4 robots specifically, cell_manifest.json
   * uses a dotted "robots.A1" id (borrowed from pyvista_render.py's
   * click-to-select part-labeling scheme) but the twin's real
   * `resolve_target()` does a flat `getattr(cell, name)` — the real
   * attribute is `cell.A1`, not `cell.robots.A1`. Always derive this via
   * `resolveCommandTarget()`, never hand-write it, so this confirmed real
   * bug can't quietly reappear.
   */
  realCommandTarget: string;
  /** Real type from the manifest — "robot" | "gantry" | "roller" | "tilt" | "atc" | "rail". */
  targetType: string;
  /**
   * Human-readable, illustrative planning content ONLY. The real twin
   * command vocabulary is exactly pause/resume/reset/step/set_speed — no
   * move/tilt-raise/roller-roll/tool-change command exists yet. This text
   * describes real subsystem roles grounded in the real genealogy tier
   * progression and the twin's real master-phase sequence, but it is NOT
   * a draft of an executable command. Always render alongside a "Planning
   * Draft" disclaimer — never let this be mistaken for something closer
   * to execution than it is.
   */
  action: string;
  /** The real ingested geometry object this step operates on, e.g. "GL_L04_1BR_A1_E". Absent for a building-level representative sequence. */
  relatedObjectId?: string;
  /** Always "planned" in this version — never "executing"/"complete", which would imply real execution. */
  status: "planned";
  /**
   * ILLUSTRATIVE ONLY — a reasonable round estimate per step type (30s for
   * robot framing/fastening, 15s for roller transfer, 20s for tilt
   * reorientation, 15s for gantry pickup/place), not measured or derived
   * from any real timing data. Nothing in the twin exposes real per-step
   * duration. Kept as round numbers, not falsely-precise ones — precision
   * here would misrepresent them as real. Same honesty standard as
   * `action` above; always render alongside the same "Planning Draft"
   * disclosure.
   */
  estimatedDurationSec: number;
  /**
   * Real dispatchable command(s) this step actually maps to, in order —
   * e.g. `[{command: "robot_execute_point", params: {robot_id, contact_point}}]`.
   * `code` below is a human-readable rendering of this exact same real
   * payload, not independently invented text. Absent when no real
   * command/coordinate is derivable for this step (see Track B / Phase
   * B1's finding on shop-drawing-vs-twin coordinate spaces) — never a
   * fabricated placeholder command.
   */
  dispatch?: { command: string; params: Record<string, unknown> }[];
  /**
   * Real KRL-style code lines rendering `dispatch` above, using KUKA
   * KRL's real structural conventions (E6POS target declarations in
   * degrees, LIN/CALL statements) — chosen over RAPID/ABB because the
   * twin's own real orientation representation (DEFAULT_RPY, a
   * roll/pitch/yaw triple) maps directly onto KRL's real A/B/C Euler
   * fields, while RAPID's robtarget uses quaternions and would need an
   * extra, unneeded conversion layer. Still illustrative in structure
   * (not a literal program a real KRC would compile) but every value
   * shown is real, not fabricated. Absent exactly when `dispatch` is.
   */
  code?: string[];
  /**
   * Real, computed-at-generation-time reachability concern for this
   * step's dispatch — present only when the same real ik() reach math
   * the twin's own robot_execute_point uses (see
   * isPointReachableToolDown in twinKinematics.ts) predicts this exact
   * point will fail the twin's real dispatch-time reachability gate.
   * Surfaced so a human sees this BEFORE clicking Execute (Phase B3),
   * not just as a scattered dispatch failure mid-sequence — real
   * precedent: a panel wider than the real fixture table (Exterior Wall
   * Frame 01, Track B investigation) puts several of its real stud
   * points outside real reach. Absent means no known issue at
   * generation time, not a guarantee — the twin's own real dispatch
   * check is still the actual backstop.
   */
  reachabilityIssue?: string;
};

/**
 * The real shop-drawing-derived data for one fabricatable element — the
 * exact same real values the element's sheet displays (name, measured
 * bounding box, thinnest-axis orientation, verbatim source extras),
 * packaged for instruction generation. Source-agnostic by construction:
 * every field is either derived from live geometry (any file) or passed
 * through verbatim (extras, whatever keys this file's author wrote —
 * possibly none, which is a real state, not an error).
 */
export type ElementSpec = {
  name: string;
  /** Real measured bounding-box size in meters — undefined only when the node truly has no geometry (then it isn't fabricatable and shouldn't reach generation anyway). */
  dims?: { x: number; y: number; z: number };
  /** Real thinnest-axis classification from orientationForNode — "elevation" = wall-shaped, "plan" = floor/ceiling-shaped. */
  orientationKind?: "plan" | "elevation";
  extras: Record<string, string | number | boolean>;
  /**
   * Real other leaf meshes elsewhere in the model whose bounding box
   * actually spatially overlaps this element's — see
   * findOverlappingFeatures() in manufacturingModel.ts. Empty for a
   * featureless element; that's a real result, not a missing one. Drives
   * a real per-feature step breakdown in instruction generation instead
   * of one static framing line for every element regardless of what it is.
   */
  overlappingFeatures: { id: string; name: string; position: { x: number; y: number; z: number } }[];
};

export type InstructionSet = {
  /** Which real ingested unit/module this sequence is for — a real object name, or the building root id for a representative/building-level run. */
  sourceObjectId: string;
  generatedAt: string;
  steps: InstructionStep[];
  /** Present when this set was generated from a real shop-drawing sheet (see ElementSpec); absent for a representative/building-level run. */
  elementSpec?: ElementSpec;
  /**
   * Real measured statements about this element vs. the real cell —
   * currently the fixture-table fit check (element footprint vs. the
   * twin's real 6.6 × 3.8 m TABLE_JIG_FIXED constants). Only genuinely
   * computed facts belong here, stated with their real numbers — never a
   * severity score or a guessed feasibility rating.
   */
  fabricationNotes?: string[];
};

/**
 * The one, explicitly-documented translation from a manifest id to the
 * twin's real command-target name. See InstructionStep.realCommandTarget
 * above for the confirmed-real reason this isn't a no-op for robots.
 */
export function resolveCommandTarget(manifestId: string): string {
  const ROBOT_PREFIX = "robots.";
  return manifestId.startsWith(ROBOT_PREFIX) ? manifestId.slice(ROBOT_PREFIX.length) : manifestId;
}

type ManufacturingOutputContextType = {
  instructionSet: InstructionSet | null;
  setInstructionSet: (set: InstructionSet | null) => void;
};

const ManufacturingOutputContext = createContext<ManufacturingOutputContextType | undefined>(undefined);

type ManufacturingOutputProviderProps = {
  children: ReactNode;
};

export function ManufacturingOutputProvider({ children }: ManufacturingOutputProviderProps) {
  const [instructionSet, setInstructionSet] = useState<InstructionSet | null>(null);

  return (
    <ManufacturingOutputContext.Provider value={{ instructionSet, setInstructionSet }}>
      {children}
    </ManufacturingOutputContext.Provider>
  );
}

export function useManufacturingOutput() {
  const context = useContext(ManufacturingOutputContext);

  if (!context) {
    throw new Error(
      "useManufacturingOutput must be used inside ManufacturingOutputProvider."
    );
  }

  return context;
}
