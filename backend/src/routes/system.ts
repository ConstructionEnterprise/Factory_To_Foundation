import type { FastifyInstance } from "fastify";
import { request as httpsRequest } from "node:https";

// Real cross-service call, the first one this backend has ever made (see
// this route's own header comment in app.ts registration) — backend is
// the one authoritative composer of "is FF ready", the same "one source
// of truth, everyone else asks it" discipline twin-bridge already applies
// to auth (it asks backend's own /auth/me rather than duplicating
// role_permission logic). Env-driven so this doesn't hardcode localhost
// into a value that has to change for any real deployment.
//
// This is the TLS identity, not necessarily the network destination: its
// hostname is what SNI and certificate hostname validation use, because
// that's the name ff-app-host's real Let's Encrypt cert is actually issued
// for. See TWIN_BRIDGE_NETWORK_HOST below for why these can differ.
const TWIN_BRIDGE_URL = process.env.TWIN_BRIDGE_URL ?? "http://localhost:4100";

// Only set in production — ff-app-host's nginx rejects any request to the
// public /twin-bridge-api path lacking this header (real gate, independent
// of CloudFront routing; see ff-app-host-bridges nginx site), since this
// server-to-server call reaches the host directly, not through CloudFront.
// Absent locally, where factory-runtime has no such check.
const TWIN_BRIDGE_ORIGIN_VERIFY = process.env.TWIN_BRIDGE_ORIGIN_VERIFY;

// Production only. ff-app-host has no stable public hostname of its own —
// its cert is for 52-14-82-76.sslip.io, a name tied to the instance's
// current IP, and an NLB's amazonaws.com hostname can't get a real cert
// (that domain isn't ours to prove to Let's Encrypt). ff-twinbridge-nlb
// (2026-08-13) gives this backend a stable *route* to ff-app-host without
// either problem: connect to the NLB's own DNS name (AWS keeps it live,
// never hardcoded here as an IP), but keep presenting TWIN_BRIDGE_URL's
// hostname as the TLS SNI — the NLB is pure TCP passthrough and never
// inspects it, so nginx still serves its real sslip.io cert and Node still
// validates the connection against that same name, normally, unweakened.
// Unset locally, where TWIN_BRIDGE_URL is reachable directly.
const TWIN_BRIDGE_NETWORK_HOST = process.env.TWIN_BRIDGE_NETWORK_HOST;

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

const UNREACHABLE: TwinLiveResponse = { bridgeReachable: false, driverAlive: false, stateAdvancing: false, paused: false };

/**
 * Connects to `networkHost` (the NLB's DNS name) but presents `url`'s own
 * hostname as the TLS SNI/servername — Node's default certificate check
 * validates the peer cert against `servername`, not against the address it
 * dialed, so this gets a stable route and a normal, fully-validated TLS
 * handshake at once. node:https directly, not undici/fetch, because fetch
 * has no supported way to separate "where to connect" from "what name to
 * validate the cert against."
 */
function fetchViaNetworkHost(
  url: URL,
  networkHost: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: networkHost,
        port: url.port ? Number(url.port) : 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        servername: url.hostname,
        headers: { ...headers, Host: url.hostname },
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("twin bridge request timed out")));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Real, honest failure handling: any fetch failure (bridge process down,
 * connection refused, timeout) reports the same as "bridge unreachable" —
 * indistinguishable from the caller's perspective, and that's fine, since
 * the honest response is identical either way. Never throws.
 */
async function fetchTwinLiveness(): Promise<TwinLiveResponse> {
  try {
    const headers: Record<string, string> = TWIN_BRIDGE_ORIGIN_VERIFY ? { "X-Origin-Verify": TWIN_BRIDGE_ORIGIN_VERIFY } : {};
    const url = new URL(`${TWIN_BRIDGE_URL}/twin-control/live`);

    let status: number;
    let body: string;
    if (TWIN_BRIDGE_NETWORK_HOST) {
      ({ status, body } = await fetchViaNetworkHost(url, TWIN_BRIDGE_NETWORK_HOST, headers, TWIN_LIVE_TIMEOUT_MS));
    } else {
      const res = await fetch(url, { signal: AbortSignal.timeout(TWIN_LIVE_TIMEOUT_MS), headers });
      status = res.status;
      body = res.ok ? await res.text() : "";
    }

    if (status < 200 || status >= 300 || !body) return UNREACHABLE;
    const data = JSON.parse(body) as Partial<TwinLiveResponse>;
    return {
      bridgeReachable: data.bridgeReachable === true,
      driverAlive: data.driverAlive === true,
      stateAdvancing: data.stateAdvancing === true,
      paused: data.paused === true,
    };
  } catch {
    return UNREACHABLE;
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
