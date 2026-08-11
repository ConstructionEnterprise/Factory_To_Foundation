import type { FastifyInstance } from "fastify";

// Real cross-service call, the first one this backend has ever made (see
// this route's own header comment in app.ts registration) — backend is
// the one authoritative composer of "is FF ready", the same "one source
// of truth, everyone else asks it" discipline twin-bridge already applies
// to auth (it asks backend's own /auth/me rather than duplicating
// role_permission logic). Env-driven so this doesn't hardcode localhost
// into a value that has to change for any real deployment.
const TWIN_BRIDGE_URL = process.env.TWIN_BRIDGE_URL ?? "http://localhost:4100";

// Real timeout, not indefinite — an unreachable twin-bridge must not make
// /system/ready itself hang. 2s comfortably exceeds twin-bridge's own
// 100ms poll cadence many times over; a real, live bridge always answers
// far faster than this.
const TWIN_LIVE_TIMEOUT_MS = 2000;

type TwinLiveResponse = {
  bridgeReachable: boolean;
  driverAlive: boolean;
  stateAdvancing: boolean;
  paused: boolean;
};

/**
 * Real, honest failure handling: any fetch failure (bridge process down,
 * connection refused, timeout) reports the same as "bridge unreachable" —
 * indistinguishable from the caller's perspective, and that's fine, since
 * the honest response is identical either way. Never throws.
 */
async function fetchTwinLiveness(): Promise<TwinLiveResponse> {
  try {
    const res = await fetch(`${TWIN_BRIDGE_URL}/twin-control/live`, {
      signal: AbortSignal.timeout(TWIN_LIVE_TIMEOUT_MS),
    });
    if (!res.ok) return { bridgeReachable: false, driverAlive: false, stateAdvancing: false, paused: false };
    const data = (await res.json()) as Partial<TwinLiveResponse>;
    return {
      bridgeReachable: data.bridgeReachable === true,
      driverAlive: data.driverAlive === true,
      stateAdvancing: data.stateAdvancing === true,
      paused: data.paused === true,
    };
  } catch {
    return { bridgeReachable: false, driverAlive: false, stateAdvancing: false, paused: false };
  }
}

export async function systemRoutes(app: FastifyInstance) {
  // Deliberately unauthenticated, same reasoning as GET /health: a
  // readiness check gated on auth defeats its own purpose, and the
  // real consumers that matter most (the frontend's app-level banner
  // before a session may exist yet, and any future external watchdog
  // like n8n's OPS-001) shouldn't need a session just to ask "is FF up."
  app.get("/system/ready", async () => {
    const twin = await fetchTwinLiveness();
    // Matches the agreed invariant exactly: a live-advancing twin OR a
    // genuinely, deliberately paused one both count as healthy — pause is
    // a real, intentional command (needed for jogging), not a failure.
    // twin-bridge's own isLive() already folds that carve-out into
    // stateAdvancing, so this composes it directly rather than
    // re-implementing the pause logic here.
    const ready = twin.bridgeReachable && twin.driverAlive && twin.stateAdvancing;

    const reasons: string[] = [];
    if (!twin.bridgeReachable) reasons.push("twin bridge unreachable");
    else if (!twin.driverAlive) reasons.push("twin driver not running");
    else if (!twin.stateAdvancing) reasons.push("twin state not advancing (and not deliberately paused)");

    return {
      ready,
      backend: { reachable: true },
      twin,
      reasons,
    };
  });
}
