import { useMemo, useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import AddFlowPointForm from "./AddFlowPointForm";
import { ensureLogisticsFlowLoaded, selectFlowPoint, useLogisticsFlowState } from "./logisticsFlowStore";

/** Real FlowPoint list, grouped by each point's own real `type` value — not a fixed taxonomy, since type is intentionally open-ended (see logisticsFlowApi.ts). Mirrors ManufacturingBrowse.tsx's real-tree-shape-not-invented-hierarchy discipline. */
export default function LogisticsFlowBrowse() {
  const { points, selection } = useLogisticsFlowState();
  const createPermission = usePermission("logistics", "create");
  const [showAddForm, setShowAddForm] = useState(false);

  ensureLogisticsFlowLoaded();

  const items: BrowseListItem[] = useMemo(() => {
    const byType = new Map<string, typeof points>();
    for (const p of points) {
      if (!byType.has(p.type)) byType.set(p.type, []);
      byType.get(p.type)!.push(p);
    }
    return Array.from(byType.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, typePoints]) => ({
        id: `type:${type}`,
        title: `${type} (${typePoints.length})`,
        children: typePoints
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({ id: p.id, title: p.name })),
      }));
  }, [points]);

  const activeId = selection?.kind === "point" ? selection.id : undefined;

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
      </div>

      {points.length === 0 ? (
        <p className="p-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No flow points yet.
        </p>
      ) : (
        <BrowseList items={items} activeId={activeId} onSelect={(id) => (points.some((p) => p.id === id) ? selectFlowPoint(id) : undefined)} />
      )}

      {showAddForm && <AddFlowPointForm onClose={() => setShowAddForm(false)} />}
    </PanelCard>
  );
}
