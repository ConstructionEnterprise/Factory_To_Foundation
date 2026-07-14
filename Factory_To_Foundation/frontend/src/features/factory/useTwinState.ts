import { useEffect, useState } from "react";

const BRIDGE_URL = "http://localhost:4100/twin-state";

// Browser-side poll cadence — deliberately slower than the twin's own
// ~100-150ms write cadence (confirmed in Step 0). A first UI slice doesn't
// need to track the twin any faster than a human can perceive.
const POLL_MS = 750;

/**
 * The full real state.json schema, confirmed against both a live read and
 * the exact write code in CE_Integrated_Cell_V3_0-6.py's advance() (HOOK
 * B) — nothing speculative added. Notably: `robots.*.x` is rail-travel
 * position (a single linear DOF), not a screen/joint coordinate, and
 * `tool_idx` is an explicitly-decoupled legacy cosmetic color-cycle, not
 * real tool identity (per the twin project's own CLAUDE.md). Neither
 * ATC/tool state nor rail position as a first-class field exists in
 * state.json yet — only what's below is real.
 */
export type TwinLastError = {
  command: string;
  target: string;
  reason: string;
  frame: number;
};

export type TwinGantryState = {
  state: string;
  cycles: number;
  bridge_x: number;
  trolley_y: number;
  hook_z: number;
  carrying: boolean;
  panel_ang: number;
};

export type TwinRollerState = {
  state: string;
  cycles: number;
  panel_x: number;
  travel_pct: number;
  speed: number;
};

export type TwinTiltState = {
  state: string;
  cycles: number;
  angle_deg: number;
  pin_extended: boolean;
};

export type TwinRobotState = {
  state: string;
  x: number;
  cycles: number;
  tool_idx: number;
};

export type TwinState = {
  frame: number;
  master_phase: string;
  module_done: boolean;
  placed_walls: string[];
  paused: boolean;
  _paused_by: string;
  _paused_at: string | null;
  _last_error: TwinLastError | null;
  gantry: TwinGantryState;
  roller: TwinRollerState;
  tilt: TwinTiltState;
  robots: {
    A1: TwinRobotState;
    A2: TwinRobotState;
    B1: TwinRobotState;
    B2: TwinRobotState;
  };
};

export type UseTwinStateResult = {
  connected: boolean;
  state: TwinState | null;
};

/** Polls the local twin-bridge server (see /twin-bridge/server.mjs, run separately) — never talks to the twin's files directly. */
export function useTwinState(): UseTwinStateResult {
  const [result, setResult] = useState<UseTwinStateResult>({ connected: false, state: null });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(BRIDGE_URL);
        if (!res.ok) throw new Error(`bridge responded ${res.status}`);
        const data = (await res.json()) as TwinState;
        if (!cancelled) setResult({ connected: true, state: data });
      } catch {
        if (!cancelled) setResult({ connected: false, state: null });
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return result;
}
