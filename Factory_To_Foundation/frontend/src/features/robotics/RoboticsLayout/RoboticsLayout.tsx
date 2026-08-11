import { useLayoutEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

import { PanelCard } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";
import { usePermission } from "@/context/AuthContext";
import { useTwinState, type TwinState } from "@/features/factory/useTwinState";
import { dispatchOne } from "@/features/factory/twinExecute";
import { RobotArm } from "@/features/factory/RobotArm";
import { authFetch } from "@/lib/authFetch";
import { TWIN_BRIDGE_URL } from "@/lib/env";

import { ROBOT_NAMES, type RobotName } from "../roboticsData";

/**
 * Bare `POST /twin-command`, deliberately bypassing `dispatchOne`'s own
 * 400ms `SETTLE_MS` + poll-until-settle machinery. Real, confirmed-live
 * reason this exists as a second path rather than just reusing
 * `dispatchOne` twice: `reset`'s own real effect unconditionally un-pauses
 * the cell (see `ResetCellButton`'s doc comment below), so getting a
 * following `pause` to actually land before real automatic cycling runs a
 * robot back out of `PARKED_AT_ATC` — or into a fresh collision — is a
 * genuine real-time race against this twin's unthrottled ~100Hz driver
 * loop. `dispatchOne`'s settle delay alone (400ms × 2 commands) already
 * lost that race live, twice, before this existed. This only confirms
 * twin-bridge accepted the write, not that the twin has processed it yet —
 * acceptable here because both commands are still sent in strict order,
 * each only after the previous POST's response, and the real risk this
 * guards against (a slow client) is exactly what it removes.
 */
async function postCommandFast(command: string, params: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await authFetch(`${TWIN_BRIDGE_URL}/twin-command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, params }),
    });
    const body = await res.json();
    return res.ok && body.ok === true;
  } catch {
    return false;
  }
}

/**
 * Real cell-wide AUTO/MANUAL toggle for `set_mode` — was previously
 * dispatchable only by hand-editing command_queue.json or POSTing
 * directly to twin-bridge; no UI anywhere in FF ever sent it. Placed here
 * (not per-robot) because mode is real twin-wide state (`state.mode`,
 * one value for the whole cell), not something that varies per robot —
 * same "cell-wide control lives in the viewport header" placement Factory's
 * own Run Simulation button already uses. Reuses `dispatchOne` (the same
 * dispatch + poll-until-settle path the jog panel uses) since `set_mode`
 * is a real instant command with no `manual_moves` entry to wait out.
 * Gated on `factory:execute` — the same permission the jog panel and
 * Factory's Execute/Run Simulation controls already require, since this is
 * an equally real operational control over the live cell, not a per-robot
 * concern.
 */
function ModeToggle({ connected, mode }: { connected: boolean; mode: TwinState["mode"] | undefined }) {
  const permission = usePermission("factory", "execute");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (!mode) return;
    const next = mode === "MANUAL" ? "AUTO" : "MANUAL";
    setPending(true);
    setError(null);
    const result = await dispatchOne("set_mode", { mode: next });
    if (!result.ok) setError(result.reason ?? "set_mode failed");
    setPending(false);
  }

  const isManual = mode === "MANUAL";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={!connected || !mode || pending || !permission.allowed}
        className="rounded-[0.2rem] px-3 py-1 text-xs font-medium disabled:opacity-50"
        style={
          isManual
            ? { background: "var(--ff-accent)", color: "white" }
            : { border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-primary)" }
        }
        title={
          !connected
            ? "Twin Bridge Offline"
            : (permission.reason ?? (mode ? `Switch to ${isManual ? "AUTO" : "MANUAL"}` : "Mode unknown"))
        }
      >
        {pending ? "Switching…" : `Mode: ${mode ?? "--"}`}
      </button>
      {error && (
        <span className="text-xs font-medium" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Real cell-wide pause/resume toggle for `pause`/`resume` — the other real
 * precondition the jog panel gates on (`state.paused === true`) that had
 * no dispatchable UI control anywhere in FF, same gap ModeToggle just
 * closed for `mode`. `pause` takes an optional `target` (defaults "all"
 * server-side); this always sends whole-cell pause, matching `resume`'s
 * own whole-cell-only real shape (Option A, locked — see CLAUDE.md §6.6).
 */
function PauseToggle({ connected, paused }: { connected: boolean; paused: boolean | undefined }) {
  const permission = usePermission("factory", "execute");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (paused === undefined) return;
    setPending(true);
    setError(null);
    const result = paused ? await dispatchOne("resume", {}) : await dispatchOne("pause", { target: "all" });
    if (!result.ok) setError(result.reason ?? "pause/resume failed");
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={!connected || paused === undefined || pending || !permission.allowed}
        className="rounded-[0.2rem] px-3 py-1 text-xs font-medium disabled:opacity-50"
        style={
          paused
            ? { background: "var(--ff-accent)", color: "white" }
            : { border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-primary)" }
        }
        title={
          !connected
            ? "Twin Bridge Offline"
            : (permission.reason ?? (paused === undefined ? "Pause state unknown" : paused ? "Resume the cell" : "Pause the cell"))
        }
      >
        {pending ? "…" : paused === undefined ? "Paused: --" : paused ? "Paused" : "Running"}
      </button>
      {error && (
        <span className="text-xs font-medium" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Real cell-wide `reset` — the third real precondition gap: a robot only
 * ever reaches `PARKED_AT_ATC` (the jog panel's third gate) at fresh cell
 * init or after completing a full real automatic cycle; nothing in the
 * manual command vocabulary can put a robot back there directly
 * (`robot_home` only moves the arm's pose, it never touches `robot.state`
 * — confirmed by reading CE_Integrated_Cell_V3_0-6.py directly). `reset`
 * (`cell = IntegratedCell()`) is the one real command that does — it also
 * clears any stale estop/collision-streak state, which is what actually
 * blocked jogging live this session. Two-click inline confirm (matching
 * this app's existing FileCard delete-confirm convention, not a native
 * `confirm()` dialog) since this genuinely discards in-progress automatic
 * work (placed_walls, cycle counts) — a real, disclosed cost, not hidden
 * behind a casual single click.
 *
 * Real, confirmed-live gotcha: `reset`'s own real effect unconditionally
 * sets `_paused = False` (read directly in CE_Integrated_Cell_V3_0-6.py's
 * `reset` command handler) — the instant a reset lands, the cell resumes
 * real automatic cycling. At this twin's real unthrottled ~100Hz driver
 * loop, that's enough to run every robot back out of PARKED_AT_ATC and
 * into a fresh real collision/estop within a few seconds — confirmed live
 * this session: a separate, human-paced Pause click after Reset lost that
 * race every time — and even chaining two full `dispatchOne` calls back to
 * back still lost it live (each one's own 400ms settle delay was enough
 * real wall-clock time for the unthrottled loop to run a robot back out of
 * PARKED_AT_ATC and into a fresh collision). Fixed by sending both commands
 * via `postCommandFast` instead — no settle delay between them, just the
 * real POST round-trip — confirmed live afterward to actually land both
 * before any automatic cycling could run away.
 */
function ResetCellButton({ connected }: { connected: boolean }) {
  const permission = usePermission("factory", "execute");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    setError(null);
    const resetOk = await postCommandFast("reset", {});
    if (!resetOk) {
      setError("reset failed to dispatch");
    } else {
      const pauseOk = await postCommandFast("pause", { target: "all" });
      if (!pauseOk) setError("reset sent, but pause failed to dispatch — cell may resume auto-cycling");
    }
    setPending(false);
    setConfirming(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        onBlur={() => setConfirming(false)}
        disabled={!connected || pending || !permission.allowed}
        className="rounded-[0.2rem] px-3 py-1 text-xs font-medium disabled:opacity-50"
        style={
          confirming
            ? { background: "var(--ff-status-critical)", color: "white" }
            : { border: "1px solid var(--ff-panel-border)", color: "var(--ff-text-primary)" }
        }
        title={
          !connected
            ? "Twin Bridge Offline"
            : (permission.reason ??
              "Real cell reset + immediate pause — clears estop/collisions and returns every robot to PARKED_AT_ATC, then pauses before automatic cycling can run it away again. Discards in-progress automatic-cycle work. Click twice to confirm.")
        }
      >
        {pending ? "Resetting…" : confirming ? "Confirm Reset & Pause?" : "Reset Cell"}
      </button>
      {error && (
        <span className="text-xs font-medium" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Isolated single-robot 3D viewport — one robot at a time, its real live
 * pose driven by the same twinKinematics forward kinematics (via the
 * shared RobotArm) that renders Factory's full-cell viewport, so the two
 * tabs can't disagree about the same q. Independent Canvas/OrbitControls
 * from Factory's — this is a dedicated inspection view, not a slice of the
 * other one.
 *
 * Rendered in the robot's own base frame (rail translation removed) so the
 * arm stays centered while you orbit it; the real rail position is shown
 * as a value in the Inspector, never hidden by the centering.
 */
const TARGET: [number, number, number] = [0, 2, 0];
const EYE: [number, number, number] = [6, 5, 7];

function IsolatedCamera() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  useLayoutEffect(() => {
    camRef.current?.position.set(...EYE);
    camRef.current?.lookAt(...TARGET);
  }, []);
  return <PerspectiveCamera ref={camRef} makeDefault fov={45} near={0.1} far={100} />;
}

export default function RoboticsLayout() {
  const { selected } = useSelection();
  const { connected, state } = useTwinState();

  const selectedRobot: RobotName =
    (selected?.feature === "robotics" ? (selected.payload.robotName as RobotName) : undefined) ?? ROBOT_NAMES[0];
  const robot = state ? state.robots[selectedRobot] : undefined;

  return (
    <PanelCard title="Isolated Robot — Live Pose" className="h-full" bodyClassName="flex flex-col flex-1">
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-100">
        <span className="text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }}>
          Robot {selectedRobot}
        </span>
        {robot && (
          <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
            {robot.state}
          </span>
        )}
        <ModeToggle connected={connected} mode={state?.mode} />
        <PauseToggle connected={connected} paused={state?.paused} />
        <ResetCellButton connected={connected} />
        <span
          className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            connected
              ? { background: "var(--ff-status-positive)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
        >
          {connected ? "Live Pose" : "Twin Offline"}
        </span>
      </div>

      <div className="relative flex-1" style={{ background: "var(--ff-content-bg)" }}>
        <Canvas>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 15, 8]} intensity={1.2} />
          <directionalLight position={[-8, 6, -6]} intensity={0.4} />
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[8, 8]} />
            <meshStandardMaterial color="#EFEFEF" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
          {robot && <RobotArm q={robot.q} railX={0} railY={0} toolIdx={robot.tool_idx} />}
          <IsolatedCamera />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={TARGET} />
        </Canvas>

        {!robot && (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm"
            style={{ color: "var(--ff-text-muted)" }}
          >
            No live pose — start the twin and twin-bridge to watch Robot {selectedRobot} animate in real time.
          </div>
        )}

        <p
          className="absolute bottom-2 left-3 rounded px-2 py-1 text-[0.65rem]"
          style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }}
        >
          Real live joint angles from the twin's DH kinematics, shown in the robot's own base frame. Same q as
          Factory's viewport; rail position is a separate real value in the Inspector.
        </p>
      </div>
    </PanelCard>
  );
}
