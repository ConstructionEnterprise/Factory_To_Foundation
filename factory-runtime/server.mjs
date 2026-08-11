// Factory Runtime — the successor to twin-bridge/server.mjs, per
// ADR-001-factory-runtime-twin-lifecycle.md and
// FACTORY-RUNTIME-MIGRATION-PLAN.md (both in Factory_To_Foundation/frontend/).
// Per the migration plan's responsibility inventory (§2), almost everything
// below is a relocation of twin-bridge's already-working logic, not a
// rewrite — file polling, self-healing, liveness computation, route shapes,
// and auth all move unchanged. Two things are genuinely new here:
//
//   1. Readiness-gated boot (§3): in ACTIVE mode, this process does not
//      start accepting requests until it has confirmed the Twin driver is
//      spawned and state.json is readable — establishing "Factory Runtime is
//      up" and "the Twin is real" as the same fact (ADR-001 §7's governing
//      principle), not two facts that happen to usually agree.
//
//   2. FACTORY_RUNTIME_MODE (default "passive"): the passive-mode authority
//      rule (migration plan §7 step 2, a hard constraint, not a suggestion).
//      A passive instance is a compatibility/read-only validation mode only
//      — it reads the same files twin-bridge also reads (safe: many
//      readers, one writer, same as today), but never spawns a driver,
//      never writes to command_queue.json, and never claims ownership,
//      readiness, or authority over the Twin in any route response. Every
//      response below that reports Twin state carries `mode`/`authoritative`
//      (or `_mode`/`_authoritative`) so nothing downstream can mistake a
//      passive instance's read for a real ownership claim — the whole point
//      is to avoid recreating the distributed-status problem this migration
//      exists to eliminate, one layer earlier, during validation itself.
//      Only FACTORY_RUNTIME_MODE=active spawns/owns the Twin; that mode is
//      not exercised until cutover (migration plan §7 step 4), deliberately
//      not enabled by default.
//
// Real auth, CORS, and the file-contract paths/polling cadences are carried
// forward unchanged from twin-bridge — see that file's own header comment
// for the original reasoning, still accurate here.
//
// Run manually alongside `npm run dev` (backend + frontend) and twin-bridge:
//   node factory-runtime/server.mjs

import "dotenv/config";
import { createServer } from "node:http";
import { readFile, writeFile, rename, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { jwtVerify } from "jose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4300";

// "passive" (default) = read-only validation/compatibility instance, never
// owns the Twin. "active" = the real Factory Runtime, owns the driver end to
// end. See the passive-mode authority rule in the header comment above.
const MODE = process.env.FACTORY_RUNTIME_MODE ?? "passive";
const PASSIVE = MODE !== "active";

function getJwtSecret() {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error("JWT_SECRET is not set — this runtime cannot authenticate real requests without it");
  return new TextEncoder().encode(raw);
}

function readAccessTokenCookie(req) {
  const header = req.headers.cookie ?? "";
  const match = header.match(/(?:^|;\s*)ff_access_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Real authentication — verifies the real access token, returns the real caller or null. Never throws; callers decide how to respond. */
async function authenticateRequest(req) {
  const token = readAccessTokenCookie(req);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return { sub: payload.sub, roleId: payload.roleId, roleName: payload.roleName };
  } catch {
    return null;
  }
}

/**
 * Real permission check — asks the backend's own /auth/me, forwarding the
 * real request cookie, rather than a second role_permission lookup here.
 * A real backend-unreachable failure is an honest deny, not a silent allow.
 * (This is the residual Factory-Runtime-to-general-backend coupling ADR-001
 * §6 flagged and explicitly did not resolve — carried forward as-is.)
 */
async function hasPermission(req, moduleId, action) {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { cookie: req.headers.cookie ?? "" },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.permissions?.[moduleId]) && data.permissions[moduleId].includes(action);
  } catch {
    return false;
  }
}

// Same real state dir as twin-bridge — deliberately the SAME files, not a
// copy, per the passive-mode reasoning above (many readers, one writer).
const STATE_DIR =
  process.env.TWIN_STATE_DIR ?? "C:\\Users\\jchap\\Dev\\Construction_Enterprises\\state";
const STATE_PATH = path.join(STATE_DIR, "state.json");
const MANIFEST_PATH = path.join(STATE_DIR, "cell_manifest.json");
const COMMAND_PATH = path.join(STATE_DIR, "command_queue.json");
const COMMAND_TMP_PATH = COMMAND_PATH + ".tmp";
const DRIVER_PATH = path.join(__dirname, "twin_headless_driver.py");
const PORT = Number(process.env.FACTORY_RUNTIME_PORT ?? 4103);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

const TWIN_PROCESS_MARKERS = ["CE_Integrated_Cell_V3_0-6.py", "twin_headless_driver.py", "run_twin_headless.py"];

const POLL_MS = 100;
const MANIFEST_POLL_MS = 2000;
const TOLERATED_READ_CODES = new Set(["ENOENT", "EPERM", "EBUSY"]);
const LIVENESS_WINDOW_MS = 3000;
const CACHE_STALE_AFTER_MS = POLL_MS * 3;

let latestState = null;
let latestManifest = null;
let lastObservedFrame = null;
let lastFrameChangeAt = null;
let lastReadSucceededAt = null;

let trackedChild = null; // { proc, pid, startedAt }

let deliberateStop = false;
let restartAttempts = 0;
let restartTimer = null;
const RESTART_BACKOFF_BASE_MS = 2000;
const RESTART_BACKOFF_MAX_MS = 60000;
const RESTART_BACKOFF_RESET_AFTER_MS = 5 * 60 * 1000;

const RECENT_RESTARTS_MAX = 5;
let recentRestarts = [];

// --- Everything below through startTwin()/stopTwin() moves unchanged from
// twin-bridge/server.mjs (migration plan §2) — same logic, same reasoning,
// only the log prefix changed (factory-runtime, not twin-bridge). ---

function isLive() {
  if (lastFrameChangeAt !== null && Date.now() - lastFrameChangeAt <= LIVENESS_WINDOW_MS) return true;
  if (latestState?.paused === true && trackedChild !== null && !isStateReadStale()) return true;
  return false;
}

function isStateReadStale() {
  return lastReadSucceededAt === null || Date.now() - lastReadSucceededAt > CACHE_STALE_AFTER_MS;
}

function frameAgeMs() {
  return lastFrameChangeAt === null ? null : Date.now() - lastFrameChangeAt;
}

function detectExternalTwinProcessWindows() {
  return new Promise((resolve) => {
    const ps = spawn("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
    ]);
    let out = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.on("error", () => resolve(null));
    ps.on("close", () => {
      try {
        const parsed = out.trim() ? JSON.parse(out) : [];
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        const match = rows.find(
          (r) => r && typeof r.CommandLine === "string" && TWIN_PROCESS_MARKERS.some((m) => r.CommandLine.includes(m))
        );
        resolve(match ? { pid: match.ProcessId, commandLine: match.CommandLine } : null);
      } catch {
        resolve(null);
      }
    });
  });
}

async function detectExternalTwinProcessLinux() {
  let entries;
  try {
    entries = await readdir("/proc");
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const raw = await readFile(`/proc/${entry}/cmdline`, "utf-8");
      const commandLine = raw.split("\0").filter(Boolean).join(" ");
      if (TWIN_PROCESS_MARKERS.some((m) => commandLine.includes(m))) {
        return { pid: Number(entry), commandLine };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function detectExternalTwinProcess() {
  return process.platform === "win32" ? detectExternalTwinProcessWindows() : detectExternalTwinProcessLinux();
}

function recordRestart(code, signal, attempt) {
  recentRestarts.push({ at: new Date().toISOString(), code, signal, attempt });
  if (recentRestarts.length > RECENT_RESTARTS_MAX) recentRestarts.shift();
}

function scheduleRestart(code, signal) {
  if (deliberateStop) return;
  if (restartTimer) return;
  restartAttempts += 1;
  recordRestart(code, signal, restartAttempts);
  const delay = Math.min(RESTART_BACKOFF_BASE_MS * 2 ** (restartAttempts - 1), RESTART_BACKOFF_MAX_MS);
  console.log(
    `[factory-runtime] twin exited unexpectedly (code=${code}, signal=${signal}) — auto-restart attempt ${restartAttempts} in ${delay}ms`
  );
  restartTimer = setTimeout(async () => {
    restartTimer = null;
    if (trackedChild) return;
    const external = await detectExternalTwinProcess();
    if (external) {
      console.log(`[factory-runtime] auto-restart skipped — external twin process already running (pid ${external.pid})`);
      return;
    }
    startTwin();
  }, delay);
}

function startTwin() {
  const pythonBin = process.platform === "win32" ? "python" : "python3";
  const proc = spawn(pythonBin, [DRIVER_PATH], { windowsHide: true });
  trackedChild = { proc, pid: proc.pid, startedAt: Date.now() };
  proc.stdout.on("data", (d) => process.stdout.write(`[twin] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[twin:err] ${d}`));
  const backoffResetTimer = setTimeout(() => {
    if (trackedChild?.pid === proc.pid) restartAttempts = 0;
  }, RESTART_BACKOFF_RESET_AFTER_MS);
  proc.on("error", (err) => {
    console.error(`[factory-runtime] failed to spawn twin process (${pythonBin}):`, err.message);
    clearTimeout(backoffResetTimer);
    if (trackedChild?.pid === proc.pid) trackedChild = null;
    scheduleRestart(null, `spawn-error: ${err.message}`);
  });
  proc.on("exit", (code, signal) => {
    console.log(`[factory-runtime] tracked twin process exited (code=${code}, signal=${signal})`);
    clearTimeout(backoffResetTimer);
    if (trackedChild?.pid === proc.pid) trackedChild = null;
    if (deliberateStop) {
      deliberateStop = false;
      restartAttempts = 0;
    } else {
      scheduleRestart(code, signal);
    }
  });
  return trackedChild;
}

function stopTwin() {
  if (!trackedChild) return false;
  deliberateStop = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  trackedChild.proc.kill();
  return true;
}

async function pollState() {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    latestState = JSON.parse(raw);
    lastReadSucceededAt = Date.now();
    const frame = latestState?.frame;
    if (typeof frame === "number" && frame !== lastObservedFrame) {
      lastObservedFrame = frame;
      lastFrameChangeAt = Date.now();
    }
  } catch (err) {
    if (err instanceof SyntaxError || TOLERATED_READ_CODES.has(err.code)) {
      return;
    }
    console.error("[factory-runtime] unexpected state read error:", err);
  }
}

async function pollManifest() {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf-8");
    latestManifest = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError || TOLERATED_READ_CODES.has(err.code)) {
      return;
    }
    console.error("[factory-runtime] unexpected manifest read error:", err);
  }
}

/**
 * Readiness-gated establishment (migration plan §3, the one genuine
 * behavior change) — ACTIVE mode only, called before server.listen().
 * Spawns the driver (reusing startTwin() unchanged) and waits for the
 * first successful pollState() read. Distinguishes a real spawn failure
 * (fatal — e.g. Python unavailable, surfaces via the child's own "error"
 * event) from "driver not yet live" (transient — keep waiting, same as
 * pollState()'s own tolerated-read-race handling; no invented timeout,
 * same discipline the migration plan itself used for Test B rather than
 * asserting an undocumented SLA).
 */
async function establishTwin() {
  let spawnError = null;
  const external = await detectExternalTwinProcess();
  if (external) {
    console.log(`[factory-runtime] found existing external twin process on boot (pid ${external.pid}) — not auto-starting a second instance`);
  } else {
    console.log("[factory-runtime] establishing twin driver before accepting requests");
    const child = startTwin();
    // Additive, one-time observer alongside startTwin()'s own unchanged
    // error/exit handling — needed only so this establishment phase can
    // tell a real spawn failure apart from "not yet live".
    child.proc.once("error", (err) => {
      spawnError = err;
    });
  }
  while (true) {
    if (spawnError) throw new Error(`twin driver failed to spawn: ${spawnError.message}`);
    await pollState();
    if (latestState !== null && lastReadSucceededAt !== null) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Deliberately unauthenticated, same reasoning as twin-bridge's own
  // /twin-control/live and backend's GET /health — a liveness check gated
  // on auth defeats its own purpose. `mode`/`authoritative` are the
  // passive-mode self-disclosure fields (see header comment) — a caller
  // that ignores them and treats this as ownership is the one failure mode
  // this can't prevent by itself, which is exactly why cutover (migration
  // plan §7 step 4-5) repoints consumers explicitly rather than leaving
  // both instances simultaneously reachable at guessable URLs long-term.
  if (req.method === "GET" && req.url === "/twin-control/live") {
    const driverAlive = trackedChild !== null || (await detectExternalTwinProcess()) !== null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        mode: MODE,
        authoritative: !PASSIVE,
        bridgeReachable: true,
        driverAlive,
        stateAdvancing: isLive(),
        paused: latestState?.paused === true,
      })
    );
    return;
  }

  const caller = await authenticateRequest(req);
  if (!caller) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not authenticated" }));
    return;
  }

  if (req.method === "POST" && req.url === "/twin-control/start") {
    // Passive-mode authority rule (migration plan §7 step 2): a passive
    // instance must never claim ownership of the Twin — refused outright,
    // not just left as a no-op because trackedChild happens to be null.
    if (PASSIVE) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          reason: "this Factory Runtime instance is in passive/validation mode and does not own or control the Twin (see FACTORY-RUNTIME-MIGRATION-PLAN.md §7 step 2)",
        })
      );
      return;
    }
    if (!(await hasPermission(req, "factory", "execute"))) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Role "${caller.roleName}" lacks the "factory:execute" permission` }));
      return;
    }
    if (trackedChild) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: "already running (bridge-owned)", pid: trackedChild.pid }));
      return;
    }
    const external = await detectExternalTwinProcess();
    if (external) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          reason: "already running externally — not started by this runtime, refusing to start a second instance",
          pid: external.pid,
        })
      );
      return;
    }
    const started = startTwin();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, pid: started.pid }));
    return;
  }

  if (req.method === "POST" && req.url === "/twin-control/stop") {
    if (PASSIVE) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          reason: "this Factory Runtime instance is in passive/validation mode and does not own or control the Twin (see FACTORY-RUNTIME-MIGRATION-PLAN.md §7 step 2)",
        })
      );
      return;
    }
    if (!(await hasPermission(req, "factory", "execute"))) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Role "${caller.roleName}" lacks the "factory:execute" permission` }));
      return;
    }
    const stopped = stopTwin();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        stopped ? { ok: true } : { ok: true, note: "nothing to stop — not started by this runtime" }
      )
    );
    return;
  }

  if (req.method === "GET" && req.url === "/twin-control/status") {
    const readiness = {
      mode: MODE,
      authoritative: !PASSIVE,
      live: isLive(),
      stateReadStale: isStateReadStale(),
      frameAgeMs: frameAgeMs(),
      restartAttempts,
      recentRestarts,
    };
    if (trackedChild) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "running",
          bridgeOwned: true,
          pid: trackedChild.pid,
          uptimeMs: Date.now() - trackedChild.startedAt,
          frame: latestState?.frame ?? null,
          ...readiness,
        })
      );
      return;
    }
    const external = await detectExternalTwinProcess();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        external
          ? { status: "running", bridgeOwned: false, pid: external.pid, frame: latestState?.frame ?? null, ...readiness }
          : { status: "not_running", bridgeOwned: false, pid: null, frame: null, ...readiness }
      )
    );
    return;
  }

  if (req.method === "POST" && req.url === "/twin-command") {
    // Passive-mode authority rule extended to command dispatch: writing
    // command_queue.json is exerting control over the Twin just as much as
    // starting/stopping its process, and racing against another writer
    // (twin-bridge, still the real owner) is exactly the file-contention
    // failure mode this whole migration exists to avoid re-creating.
    if (PASSIVE) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          reason: "this Factory Runtime instance is in passive/validation mode and does not send commands to the Twin (see FACTORY-RUNTIME-MIGRATION-PLAN.md §7 step 2)",
        })
      );
      return;
    }
    if (!(await hasPermission(req, "factory", "execute"))) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Role "${caller.roleName}" lacks the "factory:execute" permission` }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: "invalid JSON body" }));
      return;
    }
    if (typeof parsed.command !== "string" || !parsed.command) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: "command must be a real, non-empty string" }));
      return;
    }
    const params = parsed.params ?? {};
    if (typeof params !== "object" || params === null || Array.isArray(params)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: "params must be a real object" }));
      return;
    }
    const payload = JSON.stringify({ command: parsed.command, params });
    try {
      await writeFile(COMMAND_TMP_PATH, payload, "utf-8");
      await rename(COMMAND_TMP_PATH, COMMAND_PATH);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: String(err) }));
    }
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (req.url === "/twin-state") {
    if (latestState === null) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "no twin state read yet" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ...latestState,
        _live: isLive(),
        _stateReadStale: isStateReadStale(),
        _frameAgeMs: frameAgeMs(),
        _mode: MODE,
        _authoritative: !PASSIVE,
      })
    );
    return;
  }

  if (req.url === "/twin-manifest") {
    if (latestManifest === null) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "no twin manifest read yet" }));
      return;
    }
    // Bare array, matching twin-bridge's original /twin-manifest shape and
    // the frontend's TwinManifest = TwinManifestEntry[] type exactly — an
    // earlier version spread the array into an object literal to attach
    // _mode/_authoritative, which silently turned it into a numeric-keyed
    // object and broke every .map() caller (manifest.map is not a
    // function). Mode/authority disclosure now rides in headers instead,
    // so the JSON contract with FF stays untouched.
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Factory-Runtime-Mode": MODE,
      "X-Factory-Runtime-Authoritative": String(!PASSIVE),
    });
    res.end(JSON.stringify(latestManifest));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

if (PASSIVE) {
  setInterval(pollState, POLL_MS);
  pollState();
  setInterval(pollManifest, MANIFEST_POLL_MS);
  pollManifest();

  server.listen(PORT, () => {
    console.log(`[factory-runtime] PASSIVE MODE — read-only validation/compatibility instance. Does NOT own, spawn, or claim authority over the Twin (FACTORY-RUNTIME-MIGRATION-PLAN.md §7 step 2). Set FACTORY_RUNTIME_MODE=active to change this.`);
    console.log(`[factory-runtime] polling ${STATE_PATH} every ${POLL_MS}ms (same file twin-bridge also reads)`);
    console.log(`[factory-runtime] polling ${MANIFEST_PATH} every ${MANIFEST_POLL_MS}ms`);
    console.log(`[factory-runtime] GET http://localhost:${PORT}/twin-state`);
    console.log(`[factory-runtime] GET http://localhost:${PORT}/twin-manifest`);
  });
} else {
  setInterval(pollState, POLL_MS);
  setInterval(pollManifest, MANIFEST_POLL_MS);
  pollManifest();

  try {
    await establishTwin();
  } catch (err) {
    console.error(`[factory-runtime] failed to establish Twin on boot — refusing to start serving requests: ${err.message}`);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`[factory-runtime] ACTIVE MODE — owns the Twin. Established and confirmed advancing before accepting requests (readiness-gated boot, migration plan §3).`);
    console.log(`[factory-runtime] polling ${STATE_PATH} every ${POLL_MS}ms`);
    console.log(`[factory-runtime] polling ${MANIFEST_PATH} every ${MANIFEST_POLL_MS}ms`);
    console.log(`[factory-runtime] GET http://localhost:${PORT}/twin-state`);
    console.log(`[factory-runtime] GET http://localhost:${PORT}/twin-manifest`);
  });
}
