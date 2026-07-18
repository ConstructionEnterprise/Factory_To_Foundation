import { useState } from "react";

import { ToolbarButton, ToolbarShell } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";
import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";
import { useTwinManifest } from "@/features/factory/useTwinManifest";

import { generateInstructionSet } from "../instructionGeneration";

/**
 * "Import .blend File" is still not wired to a live upload — conversion
 * from the source .blend to glTF is a manual/offline Blender step (see
 * FF_Frontend_OS_Handoff §Manufacturing), not something this button
 * triggers. The status text is honest about that: the asset currently
 * shown was ingested that way, not through this button.
 *
 * "Generate Shop Drawings & Instructions" is real: it builds a real,
 * readable planned sequence (see instructionGeneration.ts) grounded in
 * the live twin manifest and writes it to ManufacturingOutputContext for
 * Factory to read. It never touches command_queue.json — see that
 * module's docs for why.
 */
export default function ManufacturingToolbar() {
  const { selected } = useSelection();
  const { connected, manifest } = useTwinManifest();
  const { setInstructionSet } = useManufacturingOutput();
  const [message, setMessage] = useState<string | null>(null);

  const manufacturingSelection = selected?.feature === "manufacturing" ? selected.payload : undefined;
  const scopeLabel =
    manufacturingSelection?.kind === "unit" ? manufacturingSelection.name : "Garden Lofts (representative unit)";

  function handleGenerate() {
    if (!connected || !manifest || manifest.length === 0) {
      setInstructionSet(null);
      setMessage("Twin manifest not reachable — cannot generate real subsystem-grounded instructions right now.");
      return;
    }

    const target =
      manufacturingSelection?.kind === "unit"
        ? {
            sourceObjectId: manufacturingSelection.objectName,
            unitTypeLabel: manufacturingSelection.typeLabel,
            level: manufacturingSelection.level,
          }
        : { sourceObjectId: "GardenLofts_Tower" };

    const result = generateInstructionSet(target, manifest);
    if (!result.ok) {
      setInstructionSet(null);
      setMessage(result.reason);
      return;
    }

    setInstructionSet(result.instructionSet);
    setMessage(`Generated ${result.instructionSet.steps.length}-step planning draft for ${scopeLabel}. View it on Factory's Instructions menu.`);
  }

  return (
    <ToolbarShell>
      <button
        type="button"
        className="rounded-[0.2rem] px-3.5 py-2 text-sm font-medium text-white"
        style={{ background: "var(--ff-accent)" }}
        disabled
        title="Not wired — conversion from .blend to glTF is a manual offline step"
      >
        Import .blend File
      </button>
      <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
        garden-lofts-exterior.glb — ingested via offline Blender export
      </span>

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
