import { useEffect, useState } from "react";

import { PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import {
  fetchProjectRelationships,
  type ConstructionDispatchSummary,
  type ConstructionProjectRelationships,
  type ConstructionTreeNodeRecord,
} from "./constructionDataMapApi";

const DISPATCH_STATUS_TONE: Record<string, StatusTone> = {
  staged: "neutral",
  in_transit: "warning",
  delivered: "positive",
};

/** Real depth from parentId chains -- data is only ever Project->Building->Floor today, but this doesn't assume a fixed depth. */
function nodeDepth(node: ConstructionTreeNodeRecord, byId: Map<string, ConstructionTreeNodeRecord>): number {
  let depth = 0;
  let current = node;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

type ConstructionDataMapViewProps = {
  projectId: string | null;
  selectedDispatchId: string | null;
  onSelectDispatch: (dispatch: ConstructionDispatchSummary) => void;
};

/**
 * Real Construction Data Map relationship panel (Phase 1.1, 2026-08-16
 * rollout). Shows real site info, the real (previously orphaned)
 * ConstructionTreeNode hierarchy, real file count, and real inbound
 * dispatches resolved to their real vehicle -- every field traces to a
 * real FK on ConstructionProject. No fabricated graph layout.
 */
export default function ConstructionDataMapView({ projectId, selectedDispatchId, onSelectDispatch }: ConstructionDataMapViewProps) {
  const [data, setData] = useState<ConstructionProjectRelationships | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchProjectRelationships(projectId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <PanelCard title="Project Relationships" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      {!projectId && <p style={{ color: "var(--ff-text-muted)" }}>Select a project to see its real relationships.</p>}
      {projectId && loading && <p style={{ color: "var(--ff-text-muted)" }}>Loading…</p>}
      {projectId && error && <p style={{ color: "var(--ff-status-critical)" }}>{error}</p>}

      {projectId && !loading && !error && data && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--ff-text-primary)" }}>
              {data.projectTitle}
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--ff-text-muted)" }}>
              {data.site?.address ?? "No real site address set"} · {data.fileCount} real document
              {data.fileCount === 1 ? "" : "s"}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: "var(--ff-text-muted)" }}>
              Real Structure
            </h3>
            <div className="space-y-1">
              {(() => {
                const byId = new Map(data.treeNodes.map((n) => [n.id, n]));
                return data.treeNodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between rounded px-2 py-1 text-xs"
                    style={{ paddingLeft: `${nodeDepth(node, byId) * 16 + 8}px` }}
                  >
                    <span style={{ color: "var(--ff-text-primary)" }}>
                      {node.title} <span style={{ color: "var(--ff-text-muted)" }}>({node.objectType})</span>
                    </span>
                    {node.progress && <span style={{ color: "var(--ff-text-muted)" }}>{node.progress}</span>}
                  </div>
                ));
              })()}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: "var(--ff-text-muted)" }}>
              Real Inbound Logistics
            </h3>
            {data.dispatches.length === 0 && (
              <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                No real dispatches headed to this project yet.
              </p>
            )}
            <div className="space-y-2">
              {data.dispatches.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDispatch(d)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition"
                  style={{
                    border:
                      d.id === selectedDispatchId
                        ? "1px solid var(--ff-accent)"
                        : "1px solid var(--ff-content-bg)",
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                      {d.vehicle?.identifier ?? d.truckIdentifier} → {data.projectTitle}
                    </div>
                    <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                      {d.route ?? "No route recorded"} · Driver {d.driverName}
                      {d.miles !== null ? ` · ${d.miles} mi` : ""}
                    </div>
                  </div>
                  <StatusBadge label={d.status} tone={DISPATCH_STATUS_TONE[d.status] ?? "neutral"} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </PanelCard>
  );
}
