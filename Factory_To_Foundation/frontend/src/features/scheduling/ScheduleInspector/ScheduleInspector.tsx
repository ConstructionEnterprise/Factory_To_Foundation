import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard } from "@/framework/ui";
import { OWNING_MODULE_LABEL, type OwningModule } from "@/features/scheduling/scheduleData";

function formatPorts(ports: { label: string; type: string }[]): string {
  return ports.length ? ports.map((p) => `${p.label} (${p.type})`).join(", ") : "None";
}

/** Same visible text as the old free-text ownedBy field — a type-safety fix, not a display change. */
function ownedByLabel(ownedByModule: OwningModule | null): string {
  return ownedByModule === null ? "Not yet built" : OWNING_MODULE_LABEL[ownedByModule];
}

export default function ScheduleInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "scheduling" ? selected : undefined;

  return (
    <PanelCard title="Selected Schedule" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-1">
        <h2 className="text-2xl font-bold text-gray-900">{sel?.payload.name ?? "Nothing Selected"}</h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>{sel?.objectType ?? "Select a schedule"}</p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-600">
        {sel?.payload.description ?? "Select a schedule type from the browser to see what it tracks."}
      </p>

      <div className="mt-6 space-y-1">
        <DetailRow label="Owned By" value={sel ? ownedByLabel(sel.payload.ownedByModule) : "--"} />
        <DetailRow label="Inputs" value={sel ? formatPorts(sel.payload.inputs) : "--"} />
        <DetailRow label="Outputs" value={sel ? formatPorts(sel.payload.outputs) : "--"} />
      </div>

      {sel && (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
          No live schedule data yet — this will populate once {sel.payload.ownedByModule === null ? "an owning feature exists for Inbound Material" : OWNING_MODULE_LABEL[sel.payload.ownedByModule]} has real data to report.
        </div>
      )}
    </PanelCard>
  );
}
