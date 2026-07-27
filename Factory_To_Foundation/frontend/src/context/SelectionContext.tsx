import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type { OwningModule } from "@/features/scheduling/scheduleData";

// Each feature's payload shape. Kept minimal until the feature is
// actually built — extend as each one ships real inspector content.
export type GenealogyPayload = { name: string };

export type FactoryPayload = {
  name: string;
  /** "unknown" is a real, honest fourth state — for manifest-confirmed subsystems (the rail/ATC identities) with no live state.json fields behind them yet, never fabricated as idle/running/down. */
  status: "running" | "idle" | "down" | "unknown";
  cycleTime: string;
  utilization: string;
  operator: string;
  maintenance: string;
  alarms: string;
  /** Real granular state string from the digital twin (e.g. "TRAVELING_TO_WORK") — only present when the payload came from live twin data, kept alongside the coarse `status` so nothing real gets lost to the 3-value simplification. */
  liveState?: string;
};

export type RoboticsPayload = {
  name: string;
  /** Real robot key A1/A2/B1/B2 — the identity for live lookup and Factory→Robotics cross-nav. Live telemetry (state, rail_x, the six joint angles q, tool_idx) is read live from the twin store keyed on this, never frozen here (a snapshot would go stale as the robot moves). */
  robotName: string;
};

/**
 * Real, closed set of Logistics entity kinds (Phase 8) — one variant per
 * real Prisma model a Browse row can now come from
 * (LogisticsMaterial/Module/Dispatch; Truck/Driver are real too but only
 * ever surface as resolved display fields on a Dispatch selection, never
 * as their own top-level Browse row — see LogisticsBrowse.tsx). Replaces
 * the original fixture-shaped flat payload (name/status/location/
 * destination/loadInfo) that every kind was forced through before any of
 * this was real. `kind` is a real discriminant here (unlike
 * ManufacturingPayload's deliberately-generic extras bag) because these
 * are genuinely distinct real database tables, not an open question about
 * whether two concepts are "the same thing."
 */
export type LogisticsMaterialPayload = {
  kind: "material";
  name: string;
  quantity: number | null;
  location: string | null;
};

export type LogisticsModulePayload = {
  kind: "module";
  name: string;
  location: string | null;
  /** Real dispatch id if one's assigned, else null (staged in the Yard, unassigned). Real dispatch-derived label/status resolved by the consumer, not stored here — matches LogisticsModule's own "derived, never stored" schema design. */
  dispatchId: string | null;
  dispatchLabel: string | null;
  dispatchStatus: string | null;
};

export type LogisticsDispatchPayload = {
  kind: "dispatch";
  /** Real resolved display labels — LogisticsBrowse looks these up from the same real truck/driver/project lists it already fetches, so Inspector never needs a second round-trip or a raw id shown as if it were a name. */
  truckIdentifier: string;
  driverName: string;
  destinationTitle: string;
  status: string;
  route: string | null;
  traffic: string | null;
  eta: string | null;
  dispatchedAt: string;
};

export type LogisticsPayload = LogisticsMaterialPayload | LogisticsModulePayload | LogisticsDispatchPayload;

export type ConstructionPayload = {
  name: string;
  progress: string;
  trade: string;
  inspector: string;
  punchListCount: string;
};

/**
 * Agnostic to source format or project — a selected node is just its
 * real name plus whatever real custom-property data it actually
 * carries. No `kind` discriminant (no assumption a "unit" vs "building"
 * distinction exists at all), no per-file fields (SF/level/subtype were
 * Garden-Lofts-specific derived concepts, not general). Loosely typed
 * (`Record<string, unknown>`) here to avoid this context module
 * depending on the manufacturing feature's own extras shape;
 * ManufacturingInspector narrows it with the real type it owns.
 */
export type ManufacturingPayload = {
  name: string;
  extras: Record<string, unknown>;
};

export type SchedulePayload = {
  name: string;
  description: string;
  /** null = genuinely no owning module yet (Inbound Material) — see scheduleData.ts's OwningModule doc comment. */
  ownedByModule: OwningModule | null;
  /** Real function-block ports (Phase 1 — structural only, nothing executes). Empty for a block with none on that side (e.g. Inbound Material has no inputs). */
  inputs: { label: string; type: string }[];
  outputs: { label: string; type: string }[];
};

export type AssetsPayload = {
  name: string;
  category: string;
  status: "active" | "maintenance" | "retired";
  lastService: string;
};

/**
 * One global selection engine, discriminated by `feature`. Every variant
 * shares the same envelope (feature/objectType/objectId/payload) but the
 * payload type is specific to that feature, so consumers narrow on
 * `selected.feature` and get a type-checked payload — no casting.
 */
export type Selection =
  | { feature: "genealogy"; objectType: string; objectId: string; payload: GenealogyPayload }
  | { feature: "factory"; objectType: string; objectId: string; payload: FactoryPayload }
  | { feature: "robotics"; objectType: string; objectId: string; payload: RoboticsPayload }
  | { feature: "logistics"; objectType: string; objectId: string; payload: LogisticsPayload }
  | { feature: "construction"; objectType: string; objectId: string; payload: ConstructionPayload }
  | { feature: "manufacturing"; objectType: string; objectId: string; payload: ManufacturingPayload }
  | { feature: "scheduling"; objectType: string; objectId: string; payload: SchedulePayload }
  | { feature: "assets"; objectType: string; objectId: string; payload: AssetsPayload };

type SelectionContextType = {
  selected: Selection | null;
  setSelected: (selection: Selection) => void;
};

const SelectionContext = createContext<SelectionContextType | undefined>(
  undefined
);

type SelectionProviderProps = {
  children: ReactNode;
};

export function SelectionProvider({
  children,
}: SelectionProviderProps) {
  const [selected, setSelected] = useState<Selection | null>(null);

  return (
    <SelectionContext.Provider
      value={{
        selected,
        setSelected,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);

  if (!context) {
    throw new Error(
      "useSelection must be used inside SelectionProvider."
    );
  }

  return context;
}
