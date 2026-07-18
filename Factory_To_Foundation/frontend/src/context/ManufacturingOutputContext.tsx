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
};

export type InstructionSet = {
  /** Which real ingested unit/module this sequence is for — a real object name, or the building root id for a representative/building-level run. */
  sourceObjectId: string;
  generatedAt: string;
  steps: InstructionStep[];
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
