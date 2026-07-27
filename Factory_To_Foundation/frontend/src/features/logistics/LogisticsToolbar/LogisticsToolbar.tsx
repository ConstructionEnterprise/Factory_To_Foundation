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
};

export default function LogisticsToolbar({ onNewDispatch, onTrackDispatches, onNewMaterial, onNewModule }: LogisticsToolbarProps) {
  const createPermission = usePermission("logistics", "create");
  const readPermission = usePermission("logistics", "read");

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
    </ToolbarShell>
  );
}
