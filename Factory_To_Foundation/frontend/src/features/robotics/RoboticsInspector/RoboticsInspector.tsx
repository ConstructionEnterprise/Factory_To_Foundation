import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";
import { useTwinState } from "@/features/factory/useTwinState";

import { robotCoarseStatus, type RobotName } from "../roboticsData";

const RAD2DEG = 180 / Math.PI;

const STATUS_TONE: Record<string, StatusTone> = {
  running: "positive",
  idle: "warning",
  unknown: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  running: "Running",
  idle: "Idle",
  unknown: "No Live Data",
};

/**
 * Real live robot telemetry — every value read fresh from the twin store
 * keyed on the selected robot, so it tracks the same frames the viewport
 * animates. The six joint angles are the real q the arm is posed from,
 * shown in both degrees and radians. No fabricated cycle times or invented
 * axis strings (the old fixture's) — only what the twin actually reports.
 */
export default function RoboticsInspector() {
  const { selected } = useSelection();
  const { connected, state } = useTwinState();

  const sel = selected?.feature === "robotics" ? selected : undefined;
  const robotName = sel?.payload.robotName as RobotName | undefined;
  const robot = robotName && state ? state.robots[robotName] : undefined;
  const status = robotCoarseStatus(robot?.state);

  return (
    <PanelCard title="Selected Robot" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mb-3 flex">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            connected
              ? { background: "var(--ff-status-positive)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
        >
          {connected ? "Live Twin Data" : "Twin Offline"}
        </span>
      </div>

      <div className="mt-2">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {sel?.payload.name ?? "Nothing Selected"}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {sel?.objectType ?? "Select a robot"}
        </p>
      </div>

      <div className="mt-4">
        {sel ? (
          <StatusBadge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
        ) : (
          <StatusBadge label="—" tone="neutral" />
        )}
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Live State" value={robot?.state ?? "--"} />
        <DetailRow label="Rail Position (X)" value={robot ? `${robot.rail_x.toFixed(2)} m` : "--"} />
        <DetailRow label="Cycles Completed" value={robot ? String(robot.cycles) : "--"} />
        <DetailRow label="Mounted Tool Index" value={robot ? String(robot.tool_idx) : "--"} />
      </div>

      {robot && (
        <div className="mt-4">
          <h3 className="mb-1 text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>
            Real Joint Angles (live 6-DOF telemetry)
          </h3>
          <div className="space-y-0.5">
            {robot.q.map((v, i) => (
              <DetailRow key={i} label={`Joint ${i + 1} (q${i + 1})`} value={`${(v * RAD2DEG).toFixed(1)}° · ${v.toFixed(3)} rad`} />
            ))}
          </div>
          <p className="mt-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
            The same real q the viewport poses the arm from. The twin has no per-joint limits (see Factory's reach
            envelope) — these are unconstrained DH joint angles, not clamped values.
          </p>
        </div>
      )}
    </PanelCard>
  );
}
