// Minimal, read-only bridge: polls the real digital twin's state.json and
// serves the latest known-good snapshot over HTTP for the FF frontend to
// consume. Never writes to, or otherwise touches, any twin file — the twin
// project's "extensions wrap, never alter" rule applies here too, even
// though this script lives outside that codebase.
//
// Dev-time only. Run manually alongside `npm run dev`:
//   node twin-bridge/server.mjs

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const STATE_PATH = "C:\\Users\\jchap\\Dev\\Construction_Enterprises\\state\\state.json";
const MANIFEST_PATH = "C:\\Users\\jchap\\Dev\\Construction_Enterprises\\state\\cell_manifest.json";
const PORT = 4100;
const ALLOWED_ORIGIN = "http://localhost:5173";

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

const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
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
