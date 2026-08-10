import { useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { usePermission } from "@/context/AuthContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";
import { useTwinState, type TwinRobotState, type TwinState } from "@/features/factory/useTwinState";
import { dispatchOne, type CommandExecutionResult } from "@/features/factory/twinExecute";

import { robotCoarseStatus, type RobotName } from "../roboticsData";

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

// No per-joint limits exist anywhere in the twin (confirmed by direct
// search, see twinGeometryConstants.ts's own note) — the real gate is the
// SAFE_REACH/collision check `robot_move_j` runs server-side. These bounds
// are just sane UI travel, not a physical constraint being encoded here.
const JOG_MIN_DEG = -180;
const JOG_MAX_DEG = 180;
const JOG_STEP_DEG = 0.5;

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

      {robotName && robot && (
        <RoboticsJogPanel key={robotName} robotName={robotName} robot={robot} connected={connected} state={state} />
      )}
    </PanelCard>
  );
}

/**
 * Real jog control for `robot_move_j` — the concrete missing Phase 3b
 * piece. The twin-side command was already dispatch-ready (Phases A-H);
 * this is the first UI that ever sends it. Keyed by `robotName` from the
 * parent so switching the selected robot remounts this component and its
 * local slider state re-initializes from that robot's live `q`, instead of
 * fighting the 750ms live-state poll on every render.
 */
function RoboticsJogPanel({
  robotName,
  robot,
  connected,
  state,
}: {
  robotName: RobotName;
  robot: TwinRobotState;
  connected: boolean;
  state: TwinState | null;
}) {
  const executePermission = usePermission("factory", "execute");
  const [jogDeg, setJogDeg] = useState<number[]>(() => robot.q.map((v) => v * RAD2DEG));
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<CommandExecutionResult | null>(null);

  // Same three real preconditions `_robot_manual_gate` enforces twin-side
  // (MANUAL mode, cell paused, robot PARKED_AT_ATC), mirrored here the same
  // way FactoryInstructions.tsx gates its own Execute button.
  const canJog = connected && state?.mode === "MANUAL" && state?.paused === true && robot.state === "PARKED_AT_ATC" && executePermission.allowed;
  const gateReason = !connected
    ? "Twin bridge not reachable — jogging is unavailable until it's running."
    : state?.mode !== "MANUAL"
      ? `Twin is in ${state?.mode ?? "an unknown"} mode — set it to MANUAL to jog.`
      : !state?.paused
        ? "Twin is not paused — pause it before jogging."
        : robot.state !== "PARKED_AT_ATC"
          ? `${robotName} is ${robot.state} — jogging requires it PARKED_AT_ATC.`
          : !executePermission.allowed
            ? executePermission.reason
            : null;

  function handleSliderChange(jointIndex: number, valueDeg: number) {
    setJogDeg((prev) => {
      const next = prev.slice();
      next[jointIndex] = valueDeg;
      return next;
    });
  }

  function handleResetToCurrent() {
    setJogDeg(robot.q.map((v) => v * RAD2DEG));
    setResult(null);
  }

  async function handleSend() {
    setSending(true);
    setResult(null);
    const params: Record<string, unknown> = { robot_id: robotName };
    jogDeg.forEach((v, i) => {
      params[`q${i + 1}`] = v * DEG2RAD;
    });
    const r = await dispatchOne("robot_move_j", params);
    setResult(r);
    setSending(false);
  }

  return (
    <div className="mt-4">
      <h3 className="mb-1 text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>
        Jog (robot_move_j)
      </h3>

      {gateReason && (
        <div
          className="mb-2 rounded-[0.2rem] p-1.5 text-[0.65rem]"
          style={{ border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-muted)" }}
        >
          {gateReason}
        </div>
      )}

      <div className="space-y-1.5">
        {jogDeg.map((v, i) => (
          <div key={i}>
            <div className="flex justify-between text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
              <span>Joint {i + 1} (q{i + 1})</span>
              <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>{v.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min={JOG_MIN_DEG}
              max={JOG_MAX_DEG}
              step={JOG_STEP_DEG}
              value={v}
              disabled={!canJog || sending}
              onChange={(e) => handleSliderChange(i, Number(e.target.value))}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={!canJog || sending}
          onClick={handleSend}
          className="rounded-[0.2rem] px-2 py-1 text-[0.65rem] font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--ff-accent)" }}
        >
          {sending ? "Sending…" : "Send Jog"}
        </button>
        <button
          type="button"
          disabled={sending}
          onClick={handleResetToCurrent}
          className="rounded-[0.2rem] px-2 py-1 text-[0.65rem] font-semibold disabled:opacity-40"
          style={{ border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-primary)" }}
        >
          Reset to Current
        </button>
      </div>

      {result && (
        <p
          className="mt-1.5 text-[0.65rem]"
          style={{ color: result.ok ? "var(--ff-status-positive)" : "var(--ff-status-critical)" }}
        >
          {result.ok ? "Dispatched — real completion confirmed." : `Failed: ${result.reason ?? "unknown"}`}
        </p>
      )}
    </div>
  );
}
