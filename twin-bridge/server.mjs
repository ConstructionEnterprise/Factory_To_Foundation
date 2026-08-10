// Mostly-read-only bridge: polls the real digital twin's state.json and
// serves the latest known-good snapshot over HTTP for the FF frontend to
// consume. Never writes to, or otherwise touches, any twin FILE it doesn't
// own the contract for — the twin project's "extensions wrap, never alter"
// rule still applies to the twin's own codebase. Two exceptions:
// /twin-control/*, which manages the twin as a PROCESS (start/stop/status)
// by launching the durable headless driver (twin_headless_driver.py, in
// this same directory); and /twin-command (Track B, Phase B4), which
// writes to the twin's own real command_queue.json — the twin's own
// documented, always-been-writable-by-an-external-controller file (that's
// the entire point of HOOK A's real command/state contract), not a file
// this bridge is inventing write access to. Both are new bridge
// capabilities, not twin-code edits.
//
// Real auth (Responsive UI milestone, "expose the twin properly" pass):
// this bridge now requires a real, valid FF session before doing anything
// beyond an OPTIONS preflight — reuses the exact same JWT the backend
// issues (same JWT_SECRET, same ff_access_token cookie, same `jose`
// library) rather than inventing a second auth mechanism. The three
// state-changing endpoints (/twin-control/start, /twin-control/stop,
// /twin-command) additionally require the real `factory:execute` grant,
// checked by asking the backend's own /auth/me (forwarding the caller's
// real cookie) rather than duplicating role_permission logic here or
// giving this bridge its own database connection — the real
// role_permission table stays the one source of truth.
//
// Run manually alongside `npm run dev`:
//   node twin-bridge/server.mjs

import "dotenv/config";
import { createServer } from "node:http";
import { readFile, writeFile, rename, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { jwtVerify } from "jose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4300";

function getJwtSecret() {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error("JWT_SECRET is not set — this bridge cannot authenticate real requests without it");
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

// Configurable so this same code runs unchanged on this Windows dev machine
// (default below) and on wherever it eventually deploys (Linux EC2 — see
// FF_Frontend_OS_Handoff/CLAUDE.md's AWS migration roadmap) — a real env
// var, not a second hardcoded path for the new target.
const STATE_DIR =
  process.env.TWIN_STATE_DIR ?? "C:\\Users\\jchap\\Dev\\Construction_Enterprises\\state";
const STATE_PATH = path.join(STATE_DIR, "state.json");
const MANIFEST_PATH = path.join(STATE_DIR, "cell_manifest.json");
// Real path, confirmed directly against the twin's own _CMD_FILE
// (CE_Integrated_Cell_V3_0-6.py: os.path.join(_STATE_DIR, "command_queue.json"))
// -- same real state dir as STATE_PATH/MANIFEST_PATH above.
const COMMAND_PATH = path.join(STATE_DIR, "command_queue.json");
const COMMAND_TMP_PATH = COMMAND_PATH + ".tmp";
const DRIVER_PATH = path.join(__dirname, "twin_headless_driver.py");
const PORT = 4100;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

// Real strings the twin can be launched as — matched against a live
// process's real command line to detect it whether it was started by
// this bridge, by the GUI script directly, or by an older ad-hoc driver
// copy. Substring match on the real, not-guessed file names.
// run_twin_headless.py added -- the twin's own documented canonical way
// to run it (Chappell_Robotics/CLAUDE.md's Environment section), missed
// here originally; a manually-started instance via that real entry
// point was going undetected by /twin-control/start's duplicate guard.
const TWIN_PROCESS_MARKERS = ["CE_Integrated_Cell_V3_0-6.py", "twin_headless_driver.py", "run_twin_headless.py"];

// Confirmed write cadence (Step 0 investigation): twin writes every
// _WRITE_EVERY=10 advance() calls, _TICK_S=0.01 nominal -> ~100ms nominal,
// ~135ms measured live. Poll a bit faster than that so we don't
// systematically lag a full write cycle behind.
const POLL_MS = 100;

// cell_manifest.json is only rewritten by a manually-run twin-side export
// script, not every frame like state.json — polling it at 100ms would be
// pure waste. A slower interval still picks up a manual re-run without
// requiring the bridge itself to be restarted.
const MANIFEST_POLL_MS = 2000;

// Matches the same write-in-progress race the twin's own readers
// (pyvista_render.py's read_state()) tolerate: a mid-replace read can
// surface as the file briefly missing, an incomplete JSON parse, or
// (Windows-specific) a sharing-violation EPERM/EBUSY. None of these are
// real errors — they just mean "try again next poll." We always have a
// last-known-good cached value to serve in the meantime.
const TOLERATED_READ_CODES = new Set(["ENOENT", "EPERM", "EBUSY"]);

// Real liveness window: the frame counter must have advanced at least once
// within this many ms for the twin to count as genuinely alive. A process
// that's running but stuck (or a state.json frozen on a stale cached read)
// must NOT read as live just because the HTTP call succeeded — that's the
// exact false-positive that let a dead production driver look healthy.
const LIVENESS_WINDOW_MS = 3000;

// A read counts as "cached" (stale, not fresh this cycle) once this many
// consecutive poll cycles have gone by without a successful state.json
// read — a couple of missed cycles is the normal Windows write-in-progress
// race (see TOLERATED_READ_CODES above), not real staleness.
const CACHE_STALE_AFTER_MS = POLL_MS * 3;

let latestState = null;
let latestManifest = null;
let lastObservedFrame = null; // last frame number actually seen in state.json
let lastFrameChangeAt = null; // when lastObservedFrame last actually changed
let lastReadSucceededAt = null; // when pollState() last got a real, fresh read

// Real state of a process THIS bridge spawned — null whenever nothing is
// tracked (never started, already stopped, or exited/crashed on its own).
let trackedChild = null; // { proc, pid, startedAt }

// Auto-restart-with-backoff state. `deliberateStop` distinguishes a human
// calling /twin-control/stop (never auto-restart) from an unexpected exit
// (crash, killed process, host reboot of just this child — always
// auto-restart). Twin *service* lifecycle (this) is deliberately separate
// from simulation run/pause state: the operator-facing "Stop Simulation"
// control no longer calls /twin-control/stop at all (see twin-command's
// pause/resume below) -- it dispatches `pause`, which leaves this process
// running. /twin-control/stop stays reachable for genuine service-down
// maintenance, which is now rare, not the everyday path self-healing has
// to fight. Backoff is exponential, capped, and never gives up permanently.
let deliberateStop = false;
let restartAttempts = 0;
let restartTimer = null;
const RESTART_BACKOFF_BASE_MS = 2000;
const RESTART_BACKOFF_MAX_MS = 60000;
// If the twin survives this long, treat it as a real recovery and reset the
// backoff counter — otherwise a twin that's merely flaky (dies every few
// minutes) would keep climbing toward the max backoff forever.
const RESTART_BACKOFF_RESET_AFTER_MS = 5 * 60 * 1000;

// Small bounded history so a demo-day "why did it restart" question can be
// answered from the API instead of requiring log access.
const RECENT_RESTARTS_MAX = 5;
let recentRestarts = []; // [{ at, code, signal, attempt }]

/**
 * Real liveness check: frame genuinely advancing, not just a successful
 * HTTP read -- OR the twin is deliberately paused (pause is a real command,
 * not a crash, and jogging requires it) AND the bridge still owns a real
 * tracked child process AND state reads are still fresh. Without that
 * carve-out, pausing (required to jog) would itself make the twin read as
 * NOT READY, since pause intentionally freezes the frame counter -- the
 * exact same observable a dead driver leaves behind. The carve-out doesn't
 * reopen that false-positive: a driver that dies while paused still loses
 * `trackedChild` (its exit handler clears it) and, once state.json goes
 * unreadable, `isStateReadStale()` too -- so a genuinely dead paused driver
 * still reports NOT READY, just via those two checks instead of frame-age.
 * Narrower known gap: an externally-started (not bridge-owned) driver that
 * gets paused won't get this carve-out, since `trackedChild` is null for
 * it -- disclosed, not fixed here, since bridge-owned start (now the
 * default via auto-start-on-boot) is the supported path.
 */
function isLive() {
  if (lastFrameChangeAt !== null && Date.now() - lastFrameChangeAt <= LIVENESS_WINDOW_MS) return true;
  if (latestState?.paused === true && trackedChild !== null && !isStateReadStale()) return true;
  return false;
}

/**
 * Narrower than `isLive()` — this is only about disk I/O: is the bridge
 * currently failing to get a fresh read of state.json at all (file
 * missing/locked for several cycles running). A driver that died cleanly
 * still leaves a perfectly readable, frozen state.json behind, so this
 * stays false in that case — `isLive()`'s frame-advance check is what
 * catches that "stale content still reads fine" scenario. This field
 * exists to separately surface the rarer "the bridge can't even read the
 * file right now" failure mode (e.g. state dir permissions, disk issue).
 */
function isStateReadStale() {
  return lastReadSucceededAt === null || Date.now() - lastReadSucceededAt > CACHE_STALE_AFTER_MS;
}

function frameAgeMs() {
  return lastFrameChangeAt === null ? null : Date.now() - lastFrameChangeAt;
}

/**
 * Real duplicate-start guard: scans live Windows processes (via
 * Get-CimInstance, since WMIC is deprecated) for a python.exe whose real
 * command line references the twin script or the driver — catches a
 * manually-started terminal instance the bridge never spawned and so
 * couldn't otherwise know about. Returns the real match or null. Costs a
 * real PowerShell spawn per call, so callers only run it when trackedChild
 * is null (a bridge-owned child needs no external scan).
 */
function detectExternalTwinProcessWindows() {
  return new Promise((resolve) => {
    const ps = spawn("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
    ]);
    let out = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.on("error", () => resolve(null)); // powershell itself failed to launch — honest "couldn't check", not "found nothing"
    ps.on("close", () => {
      try {
        const parsed = out.trim() ? JSON.parse(out) : [];
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        const match = rows.find(
          (r) => r && typeof r.CommandLine === "string" && TWIN_PROCESS_MARKERS.some((m) => r.CommandLine.includes(m))
        );
        resolve(match ? { pid: match.ProcessId, commandLine: match.CommandLine } : null);
      } catch {
        resolve(null); // real parse failure — honest "couldn't confirm", not a fabricated positive/negative
      }
    });
  });
}

/**
 * Linux equivalent of the Windows scan above: reads /proc directly rather
 * than shelling out to anything (no ps/pgrep dependency needed — /proc is
 * a real kernel-provided filesystem on every Linux target). Same
 * contract: returns the real match or null, never throws. A process can
 * legitimately exit between readdir() and the read of its own /proc/<pid>
 * entry — that's not an error, just means it's no longer a candidate.
 */
async function detectExternalTwinProcessLinux() {
  let entries;
  try {
    entries = await readdir("/proc");
  } catch {
    return null; // /proc not readable — honest "couldn't check", not "found nothing"
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
      continue; // process exited mid-scan, or unreadable — skip, not an error
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

/**
 * Schedules an auto-restart with exponential backoff. No-op if a deliberate
 * stop is in progress, or a restart is already pending. Deliberate stop
 * here means a genuine take-the-service-down action (e.g. maintenance) --
 * the normal operator "Stop Simulation" control no longer calls this path
 * at all (see twin-command's pause/resume), so this stays rare in practice
 * rather than something self-healing needs to routinely fight.
 */
function scheduleRestart(code, signal) {
  if (deliberateStop) return;
  if (restartTimer) return;
  restartAttempts += 1;
  recordRestart(code, signal, restartAttempts);
  const delay = Math.min(RESTART_BACKOFF_BASE_MS * 2 ** (restartAttempts - 1), RESTART_BACKOFF_MAX_MS);
  console.log(
    `[twin-bridge] twin exited unexpectedly (code=${code}, signal=${signal}) — auto-restart attempt ${restartAttempts} in ${delay}ms`
  );
  restartTimer = setTimeout(async () => {
    restartTimer = null;
    if (trackedChild) return; // something else already started it — don't double-start
    const external = await detectExternalTwinProcess();
    if (external) {
      console.log(`[twin-bridge] auto-restart skipped — external twin process already running (pid ${external.pid})`);
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
  // A twin that stays up long enough counts as a real recovery — reset the
  // backoff counter so a later, unrelated failure starts from the fast end
  // of the backoff curve instead of wherever a previous flaky episode left it.
  const backoffResetTimer = setTimeout(() => {
    if (trackedChild?.pid === proc.pid) restartAttempts = 0;
  }, RESTART_BACKOFF_RESET_AFTER_MS);
  proc.on("error", (err) => {
    console.error(`[twin-bridge] failed to spawn twin process (${pythonBin}):`, err.message);
    clearTimeout(backoffResetTimer);
    if (trackedChild?.pid === proc.pid) trackedChild = null;
    scheduleRestart(null, `spawn-error: ${err.message}`);
  });
  proc.on("exit", (code, signal) => {
    console.log(`[twin-bridge] tracked twin process exited (code=${code}, signal=${signal})`);
    clearTimeout(backoffResetTimer);
    if (trackedChild?.pid === proc.pid) trackedChild = null;
    if (deliberateStop) {
      deliberateStop = false; // consume the flag — a clean, intentional stop
      restartAttempts = 0; // resets backoff so the next unrelated failure starts fresh
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
  // Windows has no real POSIX signals — kill() unconditionally terminates
  // the process here; there is no graceful-shutdown path to offer instead.
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
      return; // keep serving the last-known-good cached value
    }
    console.error("[twin-bridge] unexpected state read error:", err);
  }
}

async function pollManifest() {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf-8");
    latestManifest = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError || TOLERATED_READ_CODES.has(err.code)) {
      return; // keep serving the last-known-good cached value
    }
    console.error("[twin-bridge] unexpected manifest read error:", err);
  }
}

setInterval(pollState, POLL_MS);
pollState();
setInterval(pollManifest, MANIFEST_POLL_MS);
pollManifest();

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  // Required for every real fetch() using credentials: "include" (every
  // real call site in this frontend, since auth needs the session cookie
  // sent cross-origin) -- without this, the browser completes the real
  // HTTP request (visible with a real status code in the Network tab,
  // confirmed live during the Phase 2.5 investigation this fixed) but
  // refuses to hand the response to JS at all, so fetch() rejects with a
  // generic "Failed to fetch", indistinguishable from the bridge being
  // genuinely unreachable. Same class of bug as the Allow-Headers fix
  // below, found the same way.
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // Required for the browser's CORS preflight on /twin-command's real
  // POST + Content-Type: application/json body -- without this, the
  // preflight OPTIONS response is missing the one header Chrome checks
  // before allowing the real POST through, and fetch() fails with a
  // generic network error indistinguishable from "bridge not running".
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Real auth gate — every real route below needs a genuine, currently
  // valid FF session. Checked once here, not per-route, since there is no
  // real route in this bridge an unauthenticated caller should ever reach.
  const caller = await authenticateRequest(req);
  if (!caller) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not authenticated" }));
    return;
  }

  if (req.method === "POST" && req.url === "/twin-control/start") {
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
          reason: "already running externally — not started by this bridge, refusing to start a second instance",
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
    if (!(await hasPermission(req, "factory", "execute"))) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Role "${caller.roleName}" lacks the "factory:execute" permission` }));
      return;
    }
    const stopped = stopTwin();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        stopped ? { ok: true } : { ok: true, note: "nothing to stop — not started by this bridge" }
      )
    );
    return;
  }

  if (req.method === "GET" && req.url === "/twin-control/status") {
    // `live` is the one authoritative READY signal: real frame-advance
    // within LIVENESS_WINDOW_MS, independent of whether this bridge, an
    // external process, or nothing at all owns the child. A process that
    // exists but is frozen (or a bridge only serving cached state) reports
    // live:false here — never a false "Live Twin Data".
    const readiness = {
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
    // Real, honest params validation: params must be a real object (matching
    // command_queue.json's own {"command":..., "params":{...}} contract) --
    // never silently coerced from something else.
    const params = parsed.params ?? {};
    if (typeof params !== "object" || params === null || Array.isArray(params)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: "params must be a real object" }));
      return;
    }
    const payload = JSON.stringify({ command: parsed.command, params });
    try {
      // Atomic write (temp + rename) -- same real discipline the twin's own
      // HOOK B write uses for state.json (os.replace(_STATE_TMP, _STATE_FILE)),
      // so the twin's next read of this file never sees a partial write.
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
    // Underscore-prefixed fields are bridge-computed metadata, not real twin
    // data — same convention state.json itself uses for its own
    // bridge/driver-added fields (_paused_by, _paused_at, _last_error).
    // `_live` is what callers must check before trusting this as "live" —
    // a 200 response alone no longer implies that; it may be a stale cached
    // snapshot of a driver that has since died.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ...latestState,
        _live: isLive(),
        _stateReadStale: isStateReadStale(),
        _frameAgeMs: frameAgeMs(),
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
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(latestManifest));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, async () => {
  console.log(`[twin-bridge] polling ${STATE_PATH} every ${POLL_MS}ms`);
  console.log(`[twin-bridge] polling ${MANIFEST_PATH} every ${MANIFEST_POLL_MS}ms`);
  console.log(`[twin-bridge] GET http://localhost:${PORT}/twin-state`);
  console.log(`[twin-bridge] GET http://localhost:${PORT}/twin-manifest`);

  // Auto-start on boot: the driver has no start-on-its-own mechanism of its
  // own (it's a plain script), and until now nothing ever launched it
  // automatically — it only ever ran when a human clicked Start. Skip if
  // something external is already running so we never spawn a duplicate.
  const external = await detectExternalTwinProcess();
  if (external) {
    console.log(`[twin-bridge] found existing external twin process on boot (pid ${external.pid}) — not auto-starting a second instance`);
  } else {
    console.log("[twin-bridge] auto-starting twin driver on boot");
    startTwin();
  }
});
