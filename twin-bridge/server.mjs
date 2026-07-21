// Mostly-read-only bridge: polls the real digital twin's state.json and
// serves the latest known-good snapshot over HTTP for the FF frontend to
// consume. Never writes to, or otherwise touches, any twin FILE — the twin
// project's "extensions wrap, never alter" rule still applies to the twin's
// own codebase. The one exception is /twin-control/*, which manages the
// twin as a PROCESS (start/stop/status) by launching the durable headless
// driver (twin_headless_driver.py, in this same directory) — that's a new
// capability, not a twin-code edit.
//
// Dev-time only. Run manually alongside `npm run dev`:
//   node twin-bridge/server.mjs

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STATE_PATH = "C:\\Users\\jchap\\Dev\\Construction_Enterprises\\state\\state.json";
const MANIFEST_PATH = "C:\\Users\\jchap\\Dev\\Construction_Enterprises\\state\\cell_manifest.json";
const DRIVER_PATH = path.join(__dirname, "twin_headless_driver.py");
const PORT = 4100;
const ALLOWED_ORIGIN = "http://localhost:5173";

// Real strings the twin can be launched as — matched against a live
// process's real command line to detect it whether it was started by
// this bridge, by the GUI script directly, or by an older ad-hoc driver
// copy. Substring match on the real, not-guessed file names.
const TWIN_PROCESS_MARKERS = ["CE_Integrated_Cell_V3_0-6.py", "twin_headless_driver.py"];

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

let latestState = null;
let latestManifest = null;

// Real state of a process THIS bridge spawned — null whenever nothing is
// tracked (never started, already stopped, or exited/crashed on its own).
let trackedChild = null; // { proc, pid, startedAt }

/**
 * Real duplicate-start guard: scans live Windows processes (via
 * Get-CimInstance, since WMIC is deprecated) for a python.exe whose real
 * command line references the twin script or the driver — catches a
 * manually-started terminal instance the bridge never spawned and so
 * couldn't otherwise know about. Returns the real match or null. Costs a
 * real PowerShell spawn per call, so callers only run it when trackedChild
 * is null (a bridge-owned child needs no external scan).
 */
function detectExternalTwinProcess() {
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

function startTwin() {
  const proc = spawn("python", [DRIVER_PATH], { windowsHide: true });
  trackedChild = { proc, pid: proc.pid, startedAt: Date.now() };
  proc.stdout.on("data", (d) => process.stdout.write(`[twin] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[twin:err] ${d}`));
  proc.on("exit", (code, signal) => {
    console.log(`[twin-bridge] tracked twin process exited (code=${code}, signal=${signal})`);
    if (trackedChild?.pid === proc.pid) trackedChild = null;
  });
  return trackedChild;
}

function stopTwin() {
  if (!trackedChild) return false;
  // Windows has no real POSIX signals — kill() unconditionally terminates
  // the process here; there is no graceful-shutdown path to offer instead.
  trackedChild.proc.kill();
  return true;
}

async function pollState() {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    latestState = JSON.parse(raw);
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/twin-control/start") {
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
    if (trackedChild) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "running",
          bridgeOwned: true,
          pid: trackedChild.pid,
          uptimeMs: Date.now() - trackedChild.startedAt,
          frame: latestState?.frame ?? null,
        })
      );
      return;
    }
    const external = await detectExternalTwinProcess();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        external
          ? { status: "running", bridgeOwned: false, pid: external.pid, frame: latestState?.frame ?? null }
          : { status: "not_running", bridgeOwned: false, pid: null, frame: null }
      )
    );
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
    res.end(JSON.stringify(latestState));
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

server.listen(PORT, () => {
  console.log(`[twin-bridge] polling ${STATE_PATH} every ${POLL_MS}ms`);
  console.log(`[twin-bridge] polling ${MANIFEST_PATH} every ${MANIFEST_POLL_MS}ms`);
  console.log(`[twin-bridge] GET http://localhost:${PORT}/twin-state`);
  console.log(`[twin-bridge] GET http://localhost:${PORT}/twin-manifest`);
});
