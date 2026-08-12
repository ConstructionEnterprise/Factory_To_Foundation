import type { FastifyInstance } from "fastify";

// Real cross-service call, the first one this backend has ever made (see
// this route's own header comment in app.ts registration) — backend is
// the one authoritative composer of "is FF ready", the same "one source
// of truth, everyone else asks it" discipline twin-bridge already applies
// to auth (it asks backend's own /auth/me rather than duplicating
// role_permission logic). Env-driven so this doesn't hardcode localhost
// into a value that has to change for any real deployment.
const TWIN_BRIDGE_URL = process.env.TWIN_BRIDGE_URL ?? "http://localhost:4100";

// Only set in production — ff-app-host's nginx rejects any request to the
// public /twin-bridge-api path lacking this header (real gate, independent
// of CloudFront routing; see ff-app-host-bridges nginx site), since this
// server-to-server call reaches the host directly, not through CloudFront.
// Absent locally, where factory-runtime has no such check.
const TWIN_BRIDGE_ORIGIN_VERIFY = process.env.TWIN_BRIDGE_ORIGIN_VERIFY;

// Self-reported environment identity — added after the 2026-08-11/12
// shared-dev/prod-database incident (CE_Forge/ENVIRONMENT.md has the full
// record): nothing let a client ask "which database am I actually talking
// to" before writing, so a locally-running process pointed at the real
// prod RDS instance looked indistinguishable from a safe dev target.
// Deliberately fails closed, never guessed: unset reports "unknown", not
// "development" or "production" — a caller that requires an exact match
// (e.g. CE Forge's own preflight) aborts on anything but the value it
// explicitly expects, including "unknown".
const FF_TARGET_ENV = process.env.FF_TARGET_ENV ?? "unknown";

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
      headers: TWIN_BRIDGE_ORIGIN_VERIFY ? { "X-Origin-Verify": TWIN_BRIDGE_ORIGIN_VERIFY } : {},
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
      environment: FF_TARGET_ENV,
      twin,
      reasons,
    };
  });
}
