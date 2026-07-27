import { usePermission } from "@/context/AuthContext";
import { ToolbarButton, ToolbarInput, ToolbarSelect, ToolbarShell } from "@/framework/ui";

type LogisticsToolbarProps = {
  /** Opens the real (provisional) Dispatch-creation form — see LogisticsDispatchForm's own doc comment for why this lives here rather than in a real Browse Logistics panel (Phase 8, not built yet). */
  onNewDispatch?: () => void;
  /** Opens the real (provisional) chain-of-custody tracker — see LogisticsDispatchTracker's own doc comment. */
  onTrackDispatches?: () => void;
};

export default function LogisticsToolbar({ onNewDispatch, onTrackDispatches }: LogisticsToolbarProps) {
  const createPermission = usePermission("logistics", "create");
  const readPermission = usePermission("logistics", "read");

  return (
    <ToolbarShell>
      <ToolbarInput placeholder="Search by Asset, Module, or ID..." />
      <ToolbarSelect><option>All Zones</option></ToolbarSelect>
      <ToolbarSelect><option>All Statuses</option></ToolbarSelect>
      <ToolbarButton>Filters</ToolbarButton>
      <ToolbarButton>Reset</ToolbarButton>
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
