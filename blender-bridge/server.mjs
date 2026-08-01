// Real local conversion service — separate from twin-bridge, which is
// read-only telemetry. This one does one real thing: take an uploaded
// source file, convert it to glTF via real headless Blender, upload the
// result to S3 at a fixed key (replace semantics — the new upload
// replaces whatever was loaded, no multi-asset library — Phase 3
// portability rewrite; used to write straight to the frontend's local
// public/models path, which only worked because this bridge and the
// Vite dev server shared a filesystem), and report real generic findings
// about what it found.
//
// `.blend` is the only real source format with a conversion path today.
// convert_to_gltf.py is the one place that knows anything Blender-specific
// — everything below it (temp file handling, HTTP, findings from the
// exported glTF itself) has no opinion about the source format, so a
// future IFC/Revit/Navisworks conversion step could plug in without
// touching the shape of this service.
//
// Dev-time only. Run manually alongside `npm run dev`:
//   node blender-bridge/server.mjs

import "dotenv/config";
import { createServer } from "node:http";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { jwtVerify } from "jose";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Real auth (Responsive UI milestone, "expose the twin properly" pass) —
// same real mechanism as twin-bridge's own copy of this: reuses the
// backend's exact JWT (same JWT_SECRET, same ff_access_token cookie, same
// `jose` library) for authentication, and the backend's own real /auth/me
// (forwarding the caller's real cookie) for the one real permission this
// bridge's write endpoint needs — no second role_permission lookup here.
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

// Configurable so this same code runs unchanged on this Windows dev
// machine (default below) and on a Linux container (BLENDER_EXE=/opt/blender/blender
// in the real Dockerfile) — out of Phase 3's original code-portability
// scope (that pass only redirected the *output*, not this path), fixed
// here since actually deploying to Linux makes it a real blocker.
const BLENDER_EXE = process.env.BLENDER_EXE ?? "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe";
const CONVERT_SCRIPT = join(__dirname, "convert_to_gltf.py");

// Phase 3 portability rewrite: the converted model no longer lands on the
// local frontend/public/models path (that only worked because this bridge
// and the Vite dev server happened to share a filesystem — not true once
// this runs as its own Fargate task, Phase 4). Same real S3 pattern as
// backend/src/lib/s3.ts (plain S3Client + PutObjectCommand, no new upload
// mechanism invented) — real fixed key, same "replace semantics, no
// multi-asset library" behavior the old local path had.
function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.example`);
  return value;
}
const S3_BUCKET_NAME = requireEnv("S3_BUCKET_NAME");
// Scale-readiness audit finding (CLAUDE.md §24) — same real reasoning as
// backend/src/lib/s3.ts: explicit keys are optional now, used only when
// both are actually set (local dev); the real deployed instance omits
// them and the SDK's default credential chain picks up the attached EC2
// instance role instead.
const explicitAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const explicitSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const s3Client = new S3Client({
  region: requireEnv("AWS_REGION"),
  ...(explicitAccessKeyId && explicitSecretAccessKey
    ? { credentials: { accessKeyId: explicitAccessKeyId, secretAccessKey: explicitSecretAccessKey } }
    : {}),
});
// Real fixed key — must stay in sync with backend/src/routes/manufacturingModel.ts's
// own copy of this same literal (separate processes, can't share a constant
// directly) and features/manufacturing/manufacturingModel.ts for the read side.
const MANUFACTURING_MODEL_S3_KEY = "manufacturing-models/manufacturing-model.glb";

const PORT = 4200;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";
const CONVERT_TIMEOUT_MS = 180_000;

function runBlender(inputBlendPath, outputGlbPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(BLENDER_EXE, [
      "--background",
      inputBlendPath,
      "--python",
      CONVERT_SCRIPT,
      "--",
      outputGlbPath,
    ]);

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Blender conversion timed out after ${CONVERT_TIMEOUT_MS}ms`));
    }, CONVERT_TIMEOUT_MS);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Could not start Blender at ${BLENDER_EXE}: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // Blender's own Python tracebacks (e.g. an unrecognized exporter
        // kwarg on a given Blender version - confirmed live, not
        // hypothetical) print to stdout under --python, not stderr -
        // reporting stderr alone here previously hid the real cause.
        reject(new Error(`Blender exited with code ${code}. stdout: ${stdout.slice(-2000)} stderr: ${stderr.slice(-2000)}`));
        return;
      }
      const start = stdout.indexOf("===BLENDER_BRIDGE_REPORT_START===");
      const end = stdout.indexOf("===BLENDER_BRIDGE_REPORT_END===");
      if (start === -1 || end === -1) {
        reject(new Error("Blender finished but did not report real findings — conversion output not trusted."));
        return;
      }
      const jsonLine = stdout.slice(start + "===BLENDER_BRIDGE_REPORT_START===".length, end).trim();
      try {
        resolve(JSON.parse(jsonLine));
      } catch (err) {
        reject(new Error(`Could not parse Blender's findings report: ${err.message}`));
      }
    });
  });
}

// Real findings read back from the exported glTF itself — independent of
// what Blender self-reported, since the glTF is the actual thing the
// frontend will load.
function inspectGlb(buf) {
  const jsonChunkLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonChunkLen).toString("utf8"));
  return {
    exportedNodeCount: json.nodes?.length ?? 0,
    exportedMeshCount: json.meshes?.length ?? 0,
    nodesWithExtrasCount: json.nodes?.filter((n) => n.extras).length ?? 0,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleConvert(req, res) {
  const filename = req.headers["x-filename"] || "upload.blend";
  let tmpDir;
  try {
    const body = await readBody(req);
    if (body.length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "No file data received." }));
      return;
    }

    tmpDir = await mkdtemp(join(tmpdir(), "blender-bridge-"));
    const inputPath = join(tmpDir, `${randomUUID()}.blend`);
    const outputPath = join(tmpDir, `${randomUUID()}.glb`);

    await writeFile(inputPath, body);

    const blenderReport = await runBlender(inputPath, outputPath);
    const glbBuf = await readFile(outputPath);
    const glbReport = inspectGlb(glbBuf);

    // Replace semantics: this upload is the only thing that changes what
    // the frontend loads (same fixed key every time). Happens only after a
    // real, verified-successful conversion — a failed upload never
    // touches the currently-loaded model in S3.
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: MANUFACTURING_MODEL_S3_KEY,
        Body: glbBuf,
        ContentType: "model/gltf-binary",
      })
    );

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        sourceFilename: filename,
        ...blenderReport,
        ...glbReport,
      })
    );
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-Filename, Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Real liveness probe stays open — no real data behind it, matches every
  // other service's own unauthenticated /health convention.
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/convert") {
    const caller = await authenticateRequest(req);
    if (!caller) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not authenticated" }));
      return;
    }
    if (!(await hasPermission(req, "manufacturing", "update"))) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Role "${caller.roleName}" lacks the "manufacturing:update" permission` }));
      return;
    }
    handleConvert(req, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  console.log(`[blender-bridge] Blender: ${BLENDER_EXE}`);
  console.log(`[blender-bridge] uploads converted models to: s3://${S3_BUCKET_NAME}/${MANUFACTURING_MODEL_S3_KEY}`);
  console.log(`[blender-bridge] GET  http://localhost:${PORT}/health`);
  console.log(`[blender-bridge] POST http://localhost:${PORT}/convert  (body: raw file bytes, header X-Filename)`);
});
