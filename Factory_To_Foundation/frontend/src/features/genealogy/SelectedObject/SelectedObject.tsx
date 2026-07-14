import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard } from "@/framework/ui";

import { canBeFinishedProduct } from "../genealogyRegistry";
import { graphNodes } from "../graphData";

export default function SelectedObject() {
  const { selected } = useSelection();

  // Narrow to this feature's payload shape before reading it.
  const genealogySelection =
    selected?.feature === "genealogy" ? selected : undefined;

  // The selection envelope only carries {name} — look up the full node
  // (tier, real QR) from the same source of truth the graph renders from.
  const node = genealogySelection
    ? graphNodes.find((n) => n.id === genealogySelection.objectId)
    : undefined;

  return (
    <PanelCard
      title="Selected Object"
      className="h-[560px]"
      bodyClassName="flex-1 overflow-auto p-5"
    >

      {/* Preview */}

      <div className="h-36 flex items-center justify-center" style={{ background: "var(--ff-content-bg)", border: "1px solid var(--ff-panel-border)", borderRadius: "var(--ff-radius)", color: "var(--ff-text-muted)" }}>
        Preview Image
      </div>

      {/* Object Name */}

      <div className="mt-5">

        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {genealogySelection?.payload.name ?? "Nothing Selected"}
        </h2>

        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {genealogySelection?.objectType ?? "Select an object"}
        </p>

      </div>

      {/* Status */}

      <div className="mt-5">

        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "#e6efe7", color: "var(--ff-status-positive)" }}>
          Active
        </span>

      </div>

      {/* Details */}

      <div className="mt-6 space-y-1">

        <DetailRow
          label="Object ID"
          value={genealogySelection?.objectId ?? "--"}
        />

        <DetailRow
          label="Name"
          value={genealogySelection?.payload.name ?? "--"}
        />

        <DetailRow
          label="Type"
          value={genealogySelection?.objectType ?? "--"}
        />

        <DetailRow
          label="Project"
          value="Cedarwood Flats"
        />

        <DetailRow
          label="Status"
          value="Installed"
        />

        <DetailRow
          label="Finished Product"
          value={node ? (canBeFinishedProduct(node.tier) ? "Yes" : "No") : "--"}
        />

      </div>

      {/* QR */}

      <div className="mt-8 flex flex-col items-center">

        {node?.qr ? (
          <div
            className="flex h-24 w-24 items-center justify-center break-all px-2 text-center font-mono text-[11px]"
            style={{ border: "1.5px solid var(--ff-panel-border)", borderRadius: "var(--ff-radius)", color: "var(--ff-text-primary)" }}
          >
            {node.qr}
          </div>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center text-xs" style={{ border: "1.5px dashed var(--ff-panel-border)", borderRadius: "var(--ff-radius)", color: "var(--ff-text-muted)" }}>
            QR CODE
          </div>
        )}

        <button className="mt-4 px-3.5 py-2 text-sm font-medium text-white" style={{ background: "var(--ff-accent)", borderRadius: "0.2rem" }}>
          View Full Object Record
        </button>

      </div>

    </PanelCard>
  );
}
