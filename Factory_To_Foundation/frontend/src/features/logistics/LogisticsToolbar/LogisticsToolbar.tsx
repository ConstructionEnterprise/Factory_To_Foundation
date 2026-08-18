import { usePermission } from "@/context/AuthContext";
import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

type LogisticsToolbarProps = {
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
 * Real Operations-specific filter/action controls only (Phase 10,
 * 2026-08-18 command-ribbon correction) -- the Operations/Logistics
 * Flow/Fleet mode toggle that used to live here moved out to real
 * CommandRibbon onClick/active capability-switch buttons on
 * LogisticsPage.tsx, matching Sequencing/Fleet's own real precedent (see
 * CommandRibbon.tsx's own doc comment on why a capability switch is never
 * a dropdown). This component is now only ever mounted while the
 * Operations capability is active, so there's no mode branching left
 * here at all.
 */
export default function LogisticsToolbar({
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
    </ToolbarShell>
  );
}
