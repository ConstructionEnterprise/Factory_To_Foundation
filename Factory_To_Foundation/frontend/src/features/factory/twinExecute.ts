import type { InstructionStep } from "@/context/ManufacturingOutputContext";
import type { TwinState } from "./useTwinState";
import { TWIN_BRIDGE_URL } from "@/lib/env";

/**
 * Real, human-triggered dispatch of one InstructionStep's real command(s)
 * to the twin's actual command_queue.json, via twin-bridge's new
 * /twin-command endpoint (Track B, Phase B4 — Option 1: generate only,
 * manual dispatch, no auto-run, per the explicit go-ahead). Never called
 * automatically — always the direct result of a real Execute click.
 *
 * A step's `dispatch` array can hold more than one real command (e.g. the
 * gantry pickup step: hook_grab -> move_x -> move_y -> hook_release) —
 * these are sent strictly in order, each waited on for its own real
 * completion (or failure) before the next is sent, matching
 * command_queue.json's real one-command-at-a-time contract. A failure
 * stops the remaining commands in this step rather than firing them
 * against a twin state that didn't reach what the next command assumes.
 */
const BRIDGE_BASE = TWIN_BRIDGE_URL;
const POLL_INTERVAL_MS = 200;
const TIMEOUT_MS = 20000;
// Real settle delay before the first poll — guarantees at least one real
// advance() tick has run since dispatch before we trust an absent
// manual_moves key as "done" rather than "not picked up yet". The twin's
// own write cadence is ~100-150ms with rendering (Step 0 investigation);
// the headless driver with no rendering can plausibly tick faster, so
// this errs generous rather than tight.
const SETTLE_MS = 400;

export type CommandExecutionResult = {
  command: string;
  params: Record<string, unknown>;
  ok: boolean;
  reason?: string;
};

export type StepExecutionResult = {
  ok: boolean;
  commands: CommandExecutionResult[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchState(): Promise<TwinState | null> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/twin-state`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as TwinState;
  } catch {
    return null;
  }
}

/**
 * Real subsystem key a given command's completion shows up under in
 * state.json's real `manual_moves` map — null for a real instant command
 * (gantry_hook_grab/release, tool_pickup/return/verify, pin_extend/retract,
 * atc_rack_home) that mutates state directly with no multi-tick move to
 * wait out (confirmed directly against advance()'s real dispatch code).
 */
function manualMoveKeyFor(command: string, params: Record<string, unknown>): string | null {
  if (["robot_execute_point", "robot_move_rail", "robot_move_j", "robot_move_l", "robot_home"].includes(command)) {
    return typeof params.robot_id === "string" ? params.robot_id : null;
  }
  if (command === "roller_move") return "roller";
  if (command === "tilt_move") return "tilt";
  if (["gantry_move_x", "gantry_move_y", "gantry_move_z"].includes(command)) return "gantry";
  return null;
}

function sameError(a: TwinState["_last_error"], b: TwinState["_last_error"]): boolean {
  if (a === null || b === null) return a === b;
  return a.command === b.command && a.target === b.target && a.reason === b.reason && a.frame === b.frame;
}

/**
 * Exported so single-command controls (e.g. the Robotics jog panel's
 * `robot_move_j` sends) can reuse this exact dispatch + poll-until-settle
 * logic without going through the InstructionStep/`executeStep` shape,
 * which assumes a whole ordered `dispatch[]` array.
 */
export async function dispatchOne(command: string, params: Record<string, unknown>): Promise<CommandExecutionResult> {
  // Real baseline, captured BEFORE dispatch: while the twin is paused
  // (the real precondition for every manual command), cell.tick is frozen,
  // so a genuinely new rejection can share the exact same frame number as
  // an old, unrelated one already sitting in _last_error — frame alone
  // can't tell them apart. Comparing the full real error object catches a
  // stale leftover instead of misreporting it as this dispatch's failure.
  const baselineState = await fetchState();
  const baselineError = baselineState?._last_error ?? null;

  try {
    const res = await fetch(`${BRIDGE_BASE}/twin-command`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, params }),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) {
      return { command, params, ok: false, reason: body.reason ?? `dispatch failed (HTTP ${res.status})` };
    }
  } catch {
    return { command, params, ok: false, reason: `twin-bridge not reachable at ${TWIN_BRIDGE_URL} — start it with: node twin-bridge/server.mjs` };
  }

  await sleep(SETTLE_MS);
  const key = manualMoveKeyFor(command, params);
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const state = await fetchState();
    if (!state) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (state._last_error && state._last_error.command === command && !sameError(state._last_error, baselineError)) {
      return { command, params, ok: false, reason: state._last_error.reason };
    }
    if (key === null) {
      // Real instant command with no fresh _last_error for it — real success.
      return { command, params, ok: true };
    }
    // No "must have observed it present first" requirement: a real
    // multi-tick move can register AND complete between two of our polls
    // (confirmed live — a fast real gantry_move_x did exactly this), so
    // requiring a prior sighting of `key` in manual_moves before trusting
    // its absence just times out on a move that already finished. Absence
    // + no fresh error, after a real settle delay long enough to guarantee
    // at least one real advance() tick has run, IS the real completion
    // signal — the twin always either registers the move or sets
    // _last_error, never neither.
    const present = key in (state.manual_moves ?? {});
    if (!present) {
      return { command, params, ok: true };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { command, params, ok: false, reason: "timed out waiting for real completion" };
}

/** Dispatches every real command in `step.dispatch`, in order, stopping at the first real failure. */
export async function executeStep(step: InstructionStep): Promise<StepExecutionResult> {
  const commands = step.dispatch ?? [];
  const results: CommandExecutionResult[] = [];
  for (const { command, params } of commands) {
    const result = await dispatchOne(command, params);
    results.push(result);
    if (!result.ok) break;
  }
  return { ok: results.length === commands.length && results.every((r) => r.ok), commands: results };
}
