import { useNavigate } from "react-router-dom";

import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard } from "@/framework/ui";

import { MODULE_OPTIONS, pathForModuleId } from "@/features/scheduling/moduleNavigation";

function formatPorts(ports: { label: string; type: string }[]): string {
  return ports.length ? ports.map((p) => `${p.label} (${p.type})`).join(", ") : "None";
}

/** Real label for a real module id -- looked up from the same 13-row real catalog the RBAC directory/task-owner picker already use, not a narrow fixture-era union. */
function ownedByLabel(ownedByModuleId: string | null): string {
  if (!ownedByModuleId) return "Not yet built";
  return MODULE_OPTIONS.find((m) => m.id === ownedByModuleId)?.label ?? ownedByModuleId;
}

/**
 * Phase 2.3 follow-up (2026-08-16): this panel used to be the thing that
 * navigated straight to a task's real owning module the moment a Heat
 * Map tile or Gantt row was clicked -- Joshua's real bug report. That
 * jump is now a real, explicit, opt-in button here instead (same
 * "View X in Y ->" pattern FactoryInspector already uses for "open this
 * robot in Robotics"), so selecting something in Scheduling always shows
 * its real detail here first.
 */
export default function ScheduleInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "scheduling" ? selected : undefined;
  const navigate = useNavigate();

  const ownerPath = sel ? pathForModuleId(sel.payload.ownedByModuleId) : undefined;
  const ownerLabel = sel ? ownedByLabel(sel.payload.ownedByModuleId) : null;

  return (
    <PanelCard title="Selected Schedule" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-1">
        <h2 className="text-2xl font-bold text-gray-900">{sel?.payload.name ?? "Nothing Selected"}</h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>{sel?.objectType ?? "Select a schedule"}</p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-600">
        {sel?.payload.description ?? "Select a schedule type from the browser to see what it tracks."}
      </p>

      <div className="mt-6 space-y-1">
        <DetailRow label="Owned By" value={sel ? ownedByLabel(sel.payload.ownedByModuleId) : "--"} />
        <DetailRow label="Inputs" value={sel ? formatPorts(sel.payload.inputs) : "--"} />
        <DetailRow label="Outputs" value={sel ? formatPorts(sel.payload.outputs) : "--"} />
      </div>

      {sel && (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
          No live schedule data yet — this will populate once {ownerLabel === "Not yet built" ? "an owning feature exists for this stage" : ownerLabel} has real data to report.
        </div>
      )}

      {sel && ownerPath && (
        <button
          type="button"
          onClick={() => navigate(ownerPath)}
          className="mt-5 w-full rounded-[0.2rem] px-3.5 py-2 text-sm font-medium text-white"
          style={{ background: "var(--ff-accent)" }}
          title={`Open the real owning module (${sel.payload.ownedByModuleId})`}
        >
          View in {ownerLabel} →
        </button>
      )}
    </PanelCard>
  );
}
