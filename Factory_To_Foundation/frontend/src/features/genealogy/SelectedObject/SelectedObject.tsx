import { QRCodeSVG } from "qrcode.react";

import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard } from "@/framework/ui";

import { canBeFinishedProduct } from "../genealogyRegistry";
import { graphNodes, type GraphNodeData } from "../graphData";
import { getChildren, getParents, getSiblings } from "../relationships";

/** The one real project-tier node in the current thread — genuinely "Cedarwood Flats" today, derived from the real data rather than hardcoded, so a future second-project thread wouldn't silently keep showing a stale name. */
function findRealProjectTitle(): string | undefined {
  return graphNodes.find((n) => n.tier === "project")?.title;
}

function RelatedNodeList({
  title,
  nodes,
  onSelect,
}: {
  title: string;
  nodes: GraphNodeData[];
  onSelect: (node: GraphNodeData) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
        {title} ({nodes.length})
      </p>
      {nodes.length === 0 ? (
        <p className="mt-1 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          None.
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onSelect(node)}
                className="w-full rounded px-2 py-1 text-left text-xs"
                style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
              >
                {node.title}
                <span className="ml-1.5" style={{ color: "var(--ff-text-muted)" }}>
                  {node.subtitle}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Real "Multi-Directional Relationship Explorer" detail panel (A6) —
 * real QR rendering (an actual scannable QR image, qrcode.react, of the
 * already-real QR string genealogyRegistry.ts produces — previously shown
 * as plain monospace text, never a real code), and real Parents/Children/
 * Siblings derived views (pure filters over the real graphEdges DAG,
 * relationships.ts — no new schema). The old fabricated "Project:
 * Cedarwood Flats" / "Status: Installed" / "Active" badge are gone: the
 * project name is now genuinely derived from the one real project-tier
 * node, and no real per-node status data exists anywhere in this thread
 * to back a status field — shown honestly instead of invented.
 */
export default function SelectedObject() {
  const { selected, setSelected } = useSelection();

  const genealogySelection = selected?.feature === "genealogy" ? selected : undefined;

  const node = genealogySelection ? graphNodes.find((n) => n.id === genealogySelection.objectId) : undefined;

  function selectNode(target: GraphNodeData) {
    setSelected({
      feature: "genealogy",
      objectType: target.subtitle,
      objectId: target.id,
      payload: { name: target.title },
    });
  }

  return (
    <PanelCard title="Selected Object" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-5">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {genealogySelection?.payload.name ?? "Nothing Selected"}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {genealogySelection?.objectType ?? "Select an object"}
        </p>
      </div>

      <div className="mt-6 space-y-1">
        <DetailRow label="Object ID" value={genealogySelection?.objectId ?? "--"} />
        <DetailRow label="Name" value={genealogySelection?.payload.name ?? "--"} />
        <DetailRow label="Type" value={genealogySelection?.objectType ?? "--"} />
        <DetailRow label="Project" value={findRealProjectTitle() ?? "--"} />
        <DetailRow label="Finished Product" value={node ? (canBeFinishedProduct(node.tier) ? "Yes" : "No") : "--"} />
      </div>

      {!node && (
        <p className="mt-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real per-node install/lifecycle status exists in this data yet — not shown here rather
          than invented.
        </p>
      )}

      {node && (
        <>
          <RelatedNodeList title="Parents" nodes={getParents(node.id)} onSelect={selectNode} />
          <RelatedNodeList title="Children" nodes={getChildren(node.id)} onSelect={selectNode} />
          <RelatedNodeList title="Siblings" nodes={getSiblings(node.id)} onSelect={selectNode} />
        </>
      )}

      <div className="mt-8 flex flex-col items-center">
        {node?.qr ? (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded p-2" style={{ border: "1.5px solid var(--ff-panel-border)", borderRadius: "var(--ff-radius)", background: "white" }}>
              <QRCodeSVG value={node.qr} size={96} />
            </div>
            <p className="font-mono text-[10px]" style={{ color: "var(--ff-text-muted)" }}>
              {node.qr}
            </p>
          </div>
        ) : (
          <div
            className="flex h-24 w-24 items-center justify-center text-center text-xs"
            style={{ border: "1.5px dashed var(--ff-panel-border)", borderRadius: "var(--ff-radius)", color: "var(--ff-text-muted)" }}
          >
            {node ? "No real QR built for this tier yet" : "QR CODE"}
          </div>
        )}

        <button
          className="mt-4 px-3.5 py-2 text-sm font-medium text-white"
          style={{ background: "var(--ff-accent)", borderRadius: "0.2rem" }}
        >
          View Full Object Record
        </button>
      </div>
    </PanelCard>
  );
}
