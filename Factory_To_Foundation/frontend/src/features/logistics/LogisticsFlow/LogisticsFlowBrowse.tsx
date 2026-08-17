import { useEffect, useMemo, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";
import { constructionProjects } from "@/features/construction/constructionData";

import AddFlowPointForm from "./AddFlowPointForm";
import { ensureLogisticsFlowLoaded, selectFlow, selectFlowPoint, useLogisticsFlowState } from "./logisticsFlowStore";

const FLOW_GROUP_PREFIX = "flow:";

function projectTitle(id: string): string {
  return constructionProjects.find((p) => p.id === id)?.title ?? id;
}

/**
 * Real FlowPoint list, grouped first by each point's real, authoritative
 * `LogisticsFlow` (shown by its real project title, Phase 4.1, 2026-08-17
 * — a flow is a project-scoped instance, not shared reference data), then
 * by each point's own real `type` value within that flow — type stays an
 * open-ended taxonomy, not a fixed enum (see logisticsFlowApi.ts).
 */
export default function LogisticsFlowBrowse() {
  const { flows, points, selection, selectedFlowId } = useLogisticsFlowState();
  const createPermission = usePermission("logistics", "create");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    ensureLogisticsFlowLoaded();
  }, []);

  const items: BrowseListItem[] = useMemo(() => {
    const byFlow = new Map<string, typeof points>();
    for (const p of points) {
      if (!byFlow.has(p.flowId)) byFlow.set(p.flowId, []);
      byFlow.get(p.flowId)!.push(p);
    }
    return flows
      .slice()
      .sort((a, b) => projectTitle(a.constructionProjectId).localeCompare(projectTitle(b.constructionProjectId)))
      .map((flow) => {
        const flowPoints = byFlow.get(flow.id) ?? [];
        const byType = new Map<string, typeof points>();
        for (const p of flowPoints) {
          if (!byType.has(p.type)) byType.set(p.type, []);
          byType.get(p.type)!.push(p);
        }
        return {
          id: `${FLOW_GROUP_PREFIX}${flow.id}`,
          title: `${projectTitle(flow.constructionProjectId)} (${flowPoints.length})`,
          children: Array.from(byType.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([type, typePoints]) => ({
              id: `type:${flow.id}:${type}`,
              title: `${type} (${typePoints.length})`,
              children: typePoints
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => ({ id: p.id, title: p.name })),
            })),
        };
      });
  }, [flows, points]);

  const activeId = selection?.kind === "point" ? selection.id : selectedFlowId ? `${FLOW_GROUP_PREFIX}${selectedFlowId}` : undefined;

  return (
    <PanelCard title="Browse Logistics Flow" className="h-full" bodyClassName="flex flex-col flex-1">
      <div className="border-b border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          disabled={!createPermission.allowed}
          title={createPermission.reason}
          className="w-full rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--ff-accent)" }}
        >
          + Add Point
        </button>
        {selectedFlowId && (
          <button
            type="button"
            onClick={() => selectFlow(null)}
            className="mt-2 w-full rounded px-3 py-1 text-[0.7rem]"
            style={{ color: "var(--ff-text-muted)" }}
          >
            ← Back to all flows
          </button>
        )}
      </div>

      {points.length === 0 ? (
        <p className="p-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No flow points yet.
        </p>
      ) : (
        <BrowseList
          items={items}
          activeId={activeId}
          onSelect={(id) => {
            if (id.startsWith(FLOW_GROUP_PREFIX)) {
              selectFlow(id.slice(FLOW_GROUP_PREFIX.length));
            } else if (points.some((p) => p.id === id)) {
              selectFlowPoint(id);
            }
          }}
        />
      )}

      {showAddForm && <AddFlowPointForm onClose={() => setShowAddForm(false)} />}
    </PanelCard>
  );
}
