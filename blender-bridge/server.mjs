// Real local conversion service — separate from twin-bridge, which is
// read-only telemetry. This one does one real thing: take an uploaded
// source file, convert it to glTF via real headless Blender, write the
// result to the frontend's fixed model path (replace semantics — the
// new upload replaces whatever was loaded, no multi-asset library), and
// report real generic findings about what it found.
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

import { createServer } from "node:http";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BLENDER_EXE = "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe";
const CONVERT_SCRIPT = join(__dirname, "convert_to_gltf.py");
// Fixed target the frontend always loads from — see
// features/manufacturing/manufacturingModel.ts's MANUFACTURING_MODEL_URL.
const TARGET_GLB_PATH =
  "C:\\Dev\\Factory_Foundation_design_pass\\Factory_To_Foundation\\frontend\\public\\models\\manufacturing-model.glb";

const PORT = 4200;
const ALLOWED_ORIGIN = "http://localhost:5173";
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
        reject(new Error(`Blender exited with code ${code}. stderr: ${stderr.slice(-2000)}`));
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

    // Replace semantics: this write is the only thing that changes what
    // the frontend loads. Happens only after a real, verified-successful
    // conversion — a failed upload never touches the currently-loaded model.
    await writeFile(TARGET_GLB_PATH, glbBuf);

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

const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-Filename, Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/convert") {
    handleConvert(req, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  console.log(`[blender-bridge] Blender: ${BLENDER_EXE}`);
  console.log(`[blender-bridge] writes converted models to: ${TARGET_GLB_PATH}`);
  console.log(`[blender-bridge] GET  http://localhost:${PORT}/health`);
  console.log(`[blender-bridge] POST http://localhost:${PORT}/convert  (body: raw file bytes, header X-Filename)`);
});
