import { useRef, useState } from "react";

import { ToolbarButton, ToolbarShell } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";
import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";
import { usePermission } from "@/context/AuthContext";
import { useTwinManifest } from "@/features/factory/useTwinManifest";
import { BLENDER_BRIDGE_URL } from "@/lib/env";

import { generateInstructionSet } from "../instructionGeneration";
import { bumpManufacturingModelVersion } from "../manufacturingModel";

const BLENDER_BRIDGE_CONVERT_URL = `${BLENDER_BRIDGE_URL}/convert`;

type UploadState =
  | { phase: "idle" }
  | { phase: "converting"; filename: string }
  | { phase: "done"; filename: string; totalObjectCount: number; meshObjectCount: number; hiddenRenderCount: number; exportedNodeCount: number }
  | { phase: "error"; message: string };

/**
 * Real upload UI: picks a real `.blend` file, POSTs its real bytes to
 * `blender-bridge` (a local service, separate from this repo — see
 * blender-bridge/server.mjs), which converts it with real headless
 * Blender and replaces whatever model was loaded (replace semantics, not
 * a multi-asset library). Reports real findings back — object/mesh
 * counts, hidden-object count — never a fabricated "success" summary.
 * A network-level failure (the bridge isn't running) gets the same
 * honesty standard as Factory's "Twin Offline" state, not a silent
 * failure or a guessed cause.
 *
 * "Generate Shop Drawings & Instructions" is a separate, pre-existing
 * feature (see instructionGeneration.ts) — untouched here beyond reading
 * the now-generic selection payload instead of Garden-Lofts-specific
 * unit/level fields.
 */
export default function ManufacturingToolbar() {
  const { selected } = useSelection();
  const { connected, manifest } = useTwinManifest();
  const { setInstructionSet } = useManufacturingOutput();
  const [message, setMessage] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Phase 3c — UX/honesty gating only. blender-bridge (localhost:4200) has
  // NO auth of its own — unlike Construction's real backend-enforced
  // controls, disabling this button is the entire extent of any
  // protection here, not a nicety layered on top of a real check.
  const uploadPermission = usePermission("manufacturing", "update");

  const manufacturingSel = selected?.feature === "manufacturing" ? selected : undefined;
  const scopeLabel = manufacturingSel?.payload.name ?? "the loaded model (representative element)";

  function handleGenerate() {
    if (!connected || !manifest || manifest.length === 0) {
      setInstructionSet(null);
      setMessage("Twin manifest not reachable — cannot generate real subsystem-grounded instructions right now.");
      return;
    }

    const target = manufacturingSel
      ? { sourceObjectId: manufacturingSel.objectId }
      : { sourceObjectId: "representative-element" };

    const result = generateInstructionSet(target, manifest);
    if (!result.ok) {
      setInstructionSet(null);
      setMessage(result.reason);
      return;
    }

    setInstructionSet(result.instructionSet);
    setMessage(`Generated ${result.instructionSet.steps.length}-step planning draft for ${scopeLabel}. View it on Factory's Instructions menu.`);
  }

  async function handleFileChosen(file: File) {
    setUpload({ phase: "converting", filename: file.name });
    try {
      const res = await fetch(BLENDER_BRIDGE_CONVERT_URL, {
        method: "POST",
        credentials: "include",
        headers: { "X-Filename": file.name },
        body: file,
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setUpload({ phase: "error", message: body.error ?? `Conversion failed (HTTP ${res.status}).` });
        return;
      }
      bumpManufacturingModelVersion();
      setUpload({
        phase: "done",
        filename: file.name,
        totalObjectCount: body.totalObjectCount,
        meshObjectCount: body.meshObjectCount,
        hiddenRenderCount: body.hiddenRenderCount,
        exportedNodeCount: body.exportedNodeCount,
      });
    } catch {
      setUpload({
        phase: "error",
        message: `blender-bridge not reachable at ${BLENDER_BRIDGE_URL} — start it with: node blender-bridge/server.mjs`,
      });
    }
  }

  return (
    <ToolbarShell>
      <input
        ref={fileInputRef}
        type="file"
        accept=".blend"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFileChosen(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={upload.phase === "converting" || !uploadPermission.allowed}
        className="rounded-[0.2rem] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--ff-accent)" }}
        title={
          uploadPermission.reason ??
          "Upload a .blend file — converts via a local Blender bridge and replaces the loaded model"
        }
      >
        {upload.phase === "converting" ? "Converting…" : "Import .blend File"}
      </button>

      {upload.phase === "idle" && (
        <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Upload a .blend file to replace the loaded model.
        </span>
      )}
      {upload.phase === "converting" && (
        <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Converting {upload.filename} via real headless Blender…
        </span>
      )}
      {upload.phase === "done" && (
        <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          {upload.filename} — {upload.totalObjectCount} real objects ({upload.hiddenRenderCount} hidden, not exported), {upload.meshObjectCount} meshes, {upload.exportedNodeCount} nodes in the loaded model.
        </span>
      )}
      {upload.phase === "error" && (
        <span className="text-xs font-medium" style={{ color: "var(--ff-status-critical)" }}>
          {upload.message}
        </span>
      )}

      <ToolbarButton onClick={handleGenerate} title={`Generate for: ${scopeLabel}`}>
        Generate Shop Drawings &amp; Instructions
      </ToolbarButton>

      {message && (
        <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          {message}
        </span>
      )}
    </ToolbarShell>
  );
}
