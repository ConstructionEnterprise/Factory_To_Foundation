import { useCallback, useEffect, useState } from "react";

import { TWIN_BRIDGE_URL } from "@/lib/env";

const CONTROL_BASE = `${TWIN_BRIDGE_URL}/twin-control`;
const STATUS_POLL_MS = 2000;

/**
 * Real process-lifecycle status for the twin, from twin-bridge's new
 * /twin-control/* endpoints (see twin-bridge/server.mjs). Three honest
 * states, not a boolean: "not_running", "running" with `bridgeOwned: true`
 * (this button can stop it), and "running" with `bridgeOwned: false` (some
 * other process — a manually-run terminal instance — owns it; this button
 * can start-refuse but cannot stop it, and says so).
 */
export type TwinControlStatus = {
  status: "not_running" | "running";
  bridgeOwned: boolean;
  pid: number | null;
  frame: number | null;
  /** Real liveness: frame genuinely advancing within the bridge's liveness window — the one signal safe to gate a "READY" state on. A process existing (`status: "running"`) does not imply this. */
  live: boolean;
  /** Narrower than `live` — true only when the bridge's disk read of state.json is itself currently failing (file missing/locked for several cycles). A cleanly-dead driver leaves a readable, frozen file behind, so this stays false in that case; `live` is what catches that. */
  stateReadStale: boolean;
  frameAgeMs: number | null;
  restartAttempts: number;
  recentRestarts: { at: string; code: number | null; signal: string | null; attempt: number }[];
};

export type UseTwinControlResult = {
  /** Whether the bridge itself answered — separate from whether the twin process is running. */
  bridgeReachable: boolean;
  control: TwinControlStatus | null;
  starting: boolean;
  stopping: boolean;
  /** Set only after a real rejected/failed call (e.g. duplicate-start refused) — cleared on the next successful call. */
  lastError: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

/** Polls the twin's real process status and exposes real start/stop actions — never optimistic-updates local state ahead of what the bridge actually confirms. */
export function useTwinControl(): UseTwinControlResult {
  const [bridgeReachable, setBridgeReachable] = useState(false);
  const [control, setControl] = useState<TwinControlStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${CONTROL_BASE}/status`, { credentials: "include" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as TwinControlStatus;
      setBridgeReachable(true);
      setControl(data);
    } catch {
      setBridgeReachable(false);
      setControl(null);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const res = await fetch(`${CONTROL_BASE}/start`, { method: "POST", credentials: "include" });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setLastError(body.reason ?? `start failed (HTTP ${res.status})`);
      } else {
        setLastError(null);
      }
      await poll();
    } catch {
      setLastError(`twin-bridge not reachable at ${TWIN_BRIDGE_URL} — start it with: node twin-bridge/server.mjs`);
    } finally {
      setStarting(false);
    }
  }, [poll]);

  const stop = useCallback(async () => {
    setStopping(true);
    try {
      const res = await fetch(`${CONTROL_BASE}/stop`, { method: "POST", credentials: "include" });
      const body = await res.json();
      setLastError(body.note ?? null);
      await poll();
    } catch {
      setLastError(`twin-bridge not reachable at ${TWIN_BRIDGE_URL} — start it with: node twin-bridge/server.mjs`);
    } finally {
      setStopping(false);
    }
  }, [poll]);

  return { bridgeReachable, control, starting, stopping, lastError, start, stop };
}
