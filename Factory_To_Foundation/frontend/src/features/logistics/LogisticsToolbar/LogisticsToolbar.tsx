import { usePermission } from "@/context/AuthContext";
import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

export type LogisticsMode = "operations" | "flow";

type LogisticsToolbarProps = {
  mode: LogisticsMode;
  onModeChange: (mode: LogisticsMode) => void;
  /** Opens the real (provisional) Dispatch-creation form — see LogisticsDispatchForm's own doc comment for why this still lives here rather than an inline Browse affordance. */
  onNewDispatch?: () => void;
  /** Opens the real (provisional) chain-of-custody tracker — see LogisticsDispatchTracker's own doc comment. */
  onTrackDispatches?: () => void;
  /** Opens the real (provisional) Material-creation form — see LogisticsMaterialForm's own doc comment. */
  onNewMaterial?: () => void;
  /** Opens the real (provisional) Module-creation form — see LogisticsModuleForm's own doc comment. */
  onNewModule?: () => void;
  /** Opens the real, configurable mileage-rate manager — see MileageRateManager's own doc comment. */
  onMileageRate?: () => void;
};

/**
 * Same "mode" toggle mechanism this feature briefly lived under in
 * Manufacturing before the domain correction — Operations (Dispatch/
 * Material/Module) is the default, unchanged surface; Logistics Flow is a
 * peer capability covering point-to-point movement relationships
 * (internal material flow today, expected to grow to autonomous dolly
 * movement/staging/yard flow/outbound handoffs — see LogisticsFlow's own
 * doc comments). The operations-specific search/filter/creation controls
 * only make sense in Operations mode; Logistics Flow's own "+ Add Point"/
 * "+ Add Connection" affordances live inline in its Browse/Inspector
 * panels instead, matching how this feature was originally built.
 */
export default function LogisticsToolbar({
  mode,
  onModeChange,
  onNewDispatch,
  onTrackDispatches,
  onNewMaterial,
  onNewModule,
  onMileageRate,
}: LogisticsToolbarProps) {
  const createPermission = usePermission("logistics", "create");
  const readPermission = usePermission("logistics", "read");
  const updatePermission = usePermission("logistics", "update");

  return (
    <ToolbarShell>
      <div className="flex overflow-hidden rounded-[0.2rem] border" style={{ borderColor: "var(--ff-panel-border)" }}>
        <button
          type="button"
          onClick={() => onModeChange("operations")}
          className="px-3 py-2 text-sm font-medium"
          style={{
            background: mode === "operations" ? "var(--ff-accent)" : "transparent",
            color: mode === "operations" ? "white" : "var(--ff-text-primary)",
          }}
        >
          Operations
        </button>
        <button
          type="button"
          onClick={() => onModeChange("flow")}
          className="px-3 py-2 text-sm font-medium"
          style={{
            background: mode === "flow" ? "var(--ff-accent)" : "transparent",
            color: mode === "flow" ? "white" : "var(--ff-text-primary)",
          }}
        >
          Logistics Flow
        </button>
      </div>

      {mode === "operations" && (
        <>
          <ToolbarInput placeholder="Search by Asset, Module, or ID..." />
          <ToolbarSelect><option>All Zones</option></ToolbarSelect>
          <ToolbarSelect><option>All Statuses</option></ToolbarSelect>
          <ToolbarButton>Filters</ToolbarButton>
          <ToolbarButton>Reset</ToolbarButton>
          {onNewMaterial && (
            <ToolbarButton onClick={onNewMaterial} disabled={!createPermission.allowed} title={createPermission.reason}>
              + New Material
            </ToolbarButton>
          )}
          {onNewModule && (
            <ToolbarButton onClick={onNewModule} disabled={!createPermission.allowed} title={createPermission.reason}>
              + New Module
            </ToolbarButton>
          )}
          {onNewDispatch && (
            <ToolbarButton onClick={onNewDispatch} disabled={!createPermission.allowed} title={createPermission.reason}>
              + New Dispatch
            </ToolbarButton>
          )}
          {onTrackDispatches && (
            <ToolbarButton onClick={onTrackDispatches} disabled={!readPermission.allowed} title={readPermission.reason}>
              Track Dispatches
            </ToolbarButton>
          )}
          {onMileageRate && (
            <ToolbarButton onClick={onMileageRate} disabled={!updatePermission.allowed} title={updatePermission.reason}>
              Mileage Rate
            </ToolbarButton>
          )}
        </>
      )}
    </ToolbarShell>
  );
}
