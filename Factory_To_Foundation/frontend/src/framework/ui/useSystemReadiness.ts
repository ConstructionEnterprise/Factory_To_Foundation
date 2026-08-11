import { useEffect, useState } from "react";

import { BACKEND_URL } from "@/lib/env";

const READY_URL = `${BACKEND_URL}/system/ready`;

// Same poll cadence discipline as useTwinState.ts (features/factory) —
// this doesn't need to track state any faster than a human perceives a
// banner change, and this is a second independent poll loop, not a
// replacement for that hook's own (which still drives real Factory/
// Robotics twin data, not just the readiness verdict).
const POLL_MS = 3000;

export type SystemReadiness = {
  ready: boolean;
  backend: { reachable: boolean };
  twin: {
    bridgeReachable: boolean;
    driverAlive: boolean;
    stateAdvancing: boolean;
    /** Real, raw twin field — lets a UI distinguish "advancing" from "deliberately paused (still ready)" instead of collapsing both into one boolean. */
    paused: boolean;
  };
  reasons: string[];
};

const UNREACHABLE: SystemReadiness = {
  ready: false,
  backend: { reachable: false },
  twin: { bridgeReachable: false, driverAlive: false, stateAdvancing: false, paused: false },
  reasons: ["backend unreachable"],
};

/**
 * Polls GET /system/ready — the one authoritative composition of FF
 * readiness (backend reachable AND twin bridge reachable AND twin driver
 * alive AND (twin state advancing OR deliberately paused)). This is
 * deliberately the only thing that should be trusted for "is FF ready" at
 * the application level; per-page hooks like useTwinState still exist for
 * their own detailed data, but shouldn't be read as authoritative on
 * their own anymore.
 */
export function useSystemReadiness(): SystemReadiness {
  const [result, setResult] = useState<SystemReadiness>(UNREACHABLE);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(READY_URL);
        if (!res.ok) throw new Error(`readiness endpoint responded ${res.status}`);
        const data = (await res.json()) as SystemReadiness;
        if (!cancelled) setResult(data);
      } catch {
        if (!cancelled) setResult(UNREACHABLE);
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
