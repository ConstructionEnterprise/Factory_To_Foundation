import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import { formatRoboticsStatus, roboticsNodes } from "../roboticsData";

const STATUS_TONE: Record<string, StatusTone> = {
  running: "positive",
  idle: "warning",
  fault: "critical",
};

export default function RoboticsInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "robotics" ? selected : undefined;
  const node = sel ? roboticsNodes.find((n) => n.id === sel.objectId) : undefined;

  return (
    <PanelCard title="Selected Robot" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>{sel?.payload.name ?? "Nothing Selected"}</h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>{sel?.objectType ?? "Select a robot"}</p>
      </div>

      <div className="mt-4">
        {sel ? (
          <StatusBadge label={formatRoboticsStatus(sel.payload.status)} tone={STATUS_TONE[sel.payload.status]} />
        ) : (
          <StatusBadge label="—" tone="neutral" />
        )}
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Current Task" value={sel?.payload.currentTask ?? "--"} />
        <DetailRow label="Tool" value={sel?.payload.tool ?? "--"} />
        <DetailRow label="Cycle Time" value={sel?.payload.cycleTime ?? "--"} />
        <DetailRow label="Axis Positions" value={sel?.payload.axisPositions ?? "--"} />
        <DetailRow label="Available Tools" value={node?.tools.join(", ") || "--"} />
      </div>
    </PanelCard>
  );
}
