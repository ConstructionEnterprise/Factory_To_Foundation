import { useRef, useState } from "react";

import { ErrorBoundary, FeaturePage } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";
import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";
import { usePermission } from "@/context/AuthContext";
import { useTwinManifest } from "@/features/factory/useTwinManifest";
import { BLENDER_BRIDGE_URL } from "@/lib/env";
import { generateInstructionSet } from "@/features/manufacturing/instructionGeneration";
import { bumpManufacturingModelVersion } from "@/features/manufacturing/manufacturingModel";

import {
  GeometryViewport,
  ManufacturingBrowse,
  ManufacturingInspector,
  type ManufacturingBrowseMode,
} from "@/features/manufacturing";

const BLENDER_BRIDGE_CONVERT_URL = `${BLENDER_BRIDGE_URL}/convert`;

type UploadState =
  | { phase: "idle" }
  | { phase: "converting"; filename: string }
  | { phase: "done"; filename: string; totalObjectCount: number; meshObjectCount: number; hiddenRenderCount: number; exportedNodeCount: number }
  | { phase: "error"; message: string };

/**
 * No Metrics dropdown here — real decomposed geometry is ingested now
 * (see GeometryViewport/manufacturingModel.ts), but nothing has been
 * scoped into KPI-shaped numbers yet; inventing a rollup would
 * misrepresent the page's actual state.
 *
 * Each panel gets its own `ErrorBoundary` rather than one around the
 * whole page — `ManufacturingBrowse` and `GeometryViewport` both call
 * the real `useManufacturingTree()`/`useGLTF()` loading path directly
 * (a real, previously-uncaught crash risk on this page specifically:
 * a genuine GLTF fetch/parse failure throws during render, and with no
 * boundary anywhere it silently blanked the whole app). Isolating per
 * panel means a real failure in that load shows a real error exactly
 * where it happened instead of taking down panels that don't depend on
 * it (Inspector, until something is actually selected).
 *
 * Real command-ribbon correction (Phase 10, 2026-08-18): real actions
 * ("Import .blend File", instruction generation) used to live inside
 * ManufacturingToolbar, only reachable via the "Filters" dropdown --
 * Joshua's own explicit friction complaint about the extra click for
 * each. Now direct always-visible ribbon actions instead (no browse/view/
 * detail surface of their own, so none get the onClick/active
 * capability-switch treatment either -- they're one-shot actions, not
 * navigable capabilities). With everything moved out, ManufacturingToolbar
 * has nothing real left to show, so the `toolbar` prop (and the "Filters"
 * dropdown it produced) is gone from this page entirely rather than left
 * empty.
 *
 * "Generate Shop Drawings & Instructions" was one button doing one real
 * thing (calling generateInstructionSet()) -- "shop drawing" wasn't a
 * separate real action at all, just a passive client-side projection
 * (ShopDrawingProjection) that already renders automatically when you
 * open an element's sheet. Split per Joshua's own correction: a model
 * arriving in FF does NOT come in with FF-readable shop drawings already
 * made, so creating them is a genuinely separate real step from creating
 * instructions, even though today's "creation" of one is just switching
 * ManufacturingBrowse to its real Shop Drawings view (lifted here so the
 * ribbon can drive it directly) rather than a persisted backend artifact.
 * "Create Instructions" keeps the original real generateInstructionSet()
 * call, unchanged.
 */
export default function ManufacturingPage() {
  const { selected } = useSelection();
  const { connected, manifest } = useTwinManifest();
  const { setInstructionSet } = useManufacturingOutput();
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [browseMode, setBrowseMode] = useState<ManufacturingBrowseMode>("objects");

  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Phase 3c — UX/honesty gating only. blender-bridge (localhost:4200) has
  // NO auth of its own — unlike Construction's real backend-enforced
  // controls, this check is the entire extent of any protection here, not
  // a nicety layered on top of a real one.
  const uploadPermission = usePermission("manufacturing", "update");

  const manufacturingSel = selected?.feature === "manufacturing" ? selected : undefined;
  const scopeLabel = manufacturingSel?.payload.name ?? "the loaded model (representative element)";

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

  function handleGenerate() {
    if (!connected || !manifest || manifest.length === 0) {
      setInstructionSet(null);
      setGenerateMessage("Twin manifest not reachable — cannot generate real subsystem-grounded instructions right now.");
      return;
    }

    const target = manufacturingSel
      ? { sourceObjectId: manufacturingSel.objectId }
      : { sourceObjectId: "representative-element" };

    const result = generateInstructionSet(target, manifest);
    if (!result.ok) {
      setInstructionSet(null);
      setGenerateMessage(result.reason);
      return;
    }

    setInstructionSet(result.instructionSet);
    setGenerateMessage(`Generated ${result.instructionSet.steps.length}-step planning draft for ${scopeLabel}. View it on Factory's Instructions menu.`);
  }

  const extraMenus = [
    {
      label: upload.phase === "converting" ? "Importing…" : "Import",
      onClick: () => {
        if (upload.phase === "converting" || !uploadPermission.allowed) return;
        fileInputRef.current?.click();
      },
    },
    { label: "Generate Shop Drawing", onClick: () => setBrowseMode("drawings") },
    { label: "Create Instructions", onClick: handleGenerate },
  ];

  return (
    <>
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

      <FeaturePage
        pageLabel="Manufacturing"
        pageSubtitle="Geometry Ingestion & Module Assembly"
        extraMenus={extraMenus}
        left={
          <ErrorBoundary label="Browse Models">
            <>
              {(upload.phase !== "idle" || generateMessage) && (
                <div className="mb-3 space-y-1 rounded-[0.2rem] p-2 text-xs" style={{ background: "var(--ff-chrome-bg)" }}>
                  {upload.phase === "converting" && (
                    <div style={{ color: "var(--ff-text-muted)" }}>Converting {upload.filename} via real headless Blender…</div>
                  )}
                  {upload.phase === "done" && (
                    <div style={{ color: "var(--ff-text-muted)" }}>
                      {upload.filename} — {upload.totalObjectCount} real objects ({upload.hiddenRenderCount} hidden, not exported), {upload.meshObjectCount} meshes, {upload.exportedNodeCount} nodes in the loaded model.
                    </div>
                  )}
                  {upload.phase === "error" && (
                    <div className="font-medium" style={{ color: "var(--ff-status-critical)" }}>{upload.message}</div>
                  )}
                  {generateMessage && <div style={{ color: "var(--ff-text-muted)" }}>{generateMessage}</div>}
                </div>
              )}
              <ManufacturingBrowse mode={browseMode} onModeChange={setBrowseMode} />
            </>
          </ErrorBoundary>
        }
        center={
          <ErrorBoundary label="Geometry Viewport">
            <GeometryViewport />
          </ErrorBoundary>
        }
        right={
          <ErrorBoundary label="Selected Geometry">
            <ManufacturingInspector />
          </ErrorBoundary>
        }
      />
    </>
  );
}
