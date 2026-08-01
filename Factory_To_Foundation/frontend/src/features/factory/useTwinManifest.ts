import { useEffect, useState } from "react";

import { TWIN_BRIDGE_URL } from "@/lib/env";

const BRIDGE_URL = `${TWIN_BRIDGE_URL}/twin-manifest`;

// cell_manifest.json is only rewritten when the twin-side export script is
// manually re-run (see Construction_Enterprises) — the object graph is
// fixed/deterministic at IntegratedCell.__init__, nothing adds or removes
// subsystems at runtime today. Polling this as fast as state.json (750ms)
// would be pure waste; a slower interval still picks up a manual re-run
// without a page reload.
const POLL_MS = 3000;

/**
 * One real subsystem identity from the twin's manifest. `id` follows the
 * same dotted-path scheme state.json itself uses (e.g. "robots.A1"), so
 * looking up live data for an entry is a direct path lookup, not a second
 * name-mapping table that can drift from the first.
 */
export type TwinManifestEntry = {
  id: string;
  type: string;
  label: string;
};

export type TwinManifest = TwinManifestEntry[];

export type UseTwinManifestResult = {
  connected: boolean;
  manifest: TwinManifest | null;
};

/** Polls the local twin-bridge server's /twin-manifest endpoint (see /twin-bridge/server.mjs, run separately) — never reads twin files directly. */
export function useTwinManifest(): UseTwinManifestResult {
  const [result, setResult] = useState<UseTwinManifestResult>({ connected: false, manifest: null });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(BRIDGE_URL, { credentials: "include" });
        if (!res.ok) throw new Error(`bridge responded ${res.status}`);
        const data = (await res.json()) as TwinManifest;
        if (!cancelled) setResult({ connected: true, manifest: data });
      } catch {
        if (!cancelled) setResult({ connected: false, manifest: null });
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
