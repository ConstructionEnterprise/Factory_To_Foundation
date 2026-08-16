import { useEffect } from "react";

import { useSelection } from "@/context/SelectionContext";
import { PanelCard } from "@/framework/ui";
import { ensureGenealogyGraphLoaded, useGenealogyGraph } from "@/features/genealogy/genealogyStore";
import { getChildren, getParents } from "@/features/genealogy/relationships";

import type { InventoryItem } from "../inventoryApi";

/**
 * Real Relationships panel — only `genealogy_node`-kind items have real
 * parent/child relationship data (the real GenealogyEdge DAG, same source
 * genealogyStore.ts already loads for the Genealogy page). `asset`-kind
 * items honestly show no relationship data rather than fabricating one —
 * no relationship model exists for Assets in this schema.
 *
 * Real bug fixed live during Phase 2.5 verification: `sel.objectId` is the
 * real InventoryItem id (what Browse Inventory's list and `activeId`
 * highlight are keyed on), NOT the real GenealogyNode id the DAG traversal
 * needs — those are two different id spaces (InventoryItem rows were
 * created fresh by the Phase 2.2 backfill; GenealogyNode ids are the
 * original real thread ids like "lgs-0050"). `items` (the same real list
 * InventoryBrowse already has) is what lets this panel translate between
 * the two consistently in both directions — current selection's real
 * GenealogyNode id, and a clicked parent/child's real GenealogyNode id
 * back to the InventoryItem id Browse's highlight expects.
 */
export default function InventoryRelationships({ items }: { items: InventoryItem[] }) {
  const { selected, setSelected } = useSelection();
  const sel = selected?.feature === "inventory" ? selected : undefined;
  const { nodes, edges } = useGenealogyGraph();

  useEffect(() => {
    ensureGenealogyGraphLoaded();
  }, []);

  const selectedInventoryItem = sel ? items.find((i) => i.id === sel.objectId) : undefined;
  const realGenealogyNodeId = selectedInventoryItem?.genealogyNode?.id;

  const isGenealogy = sel?.payload.kind === "genealogy_node" && !!realGenealogyNodeId;
  const parents = isGenealogy ? getParents(nodes, edges, realGenealogyNodeId!) : [];
  const children = isGenealogy ? getChildren(nodes, edges, realGenealogyNodeId!) : [];

  function selectGenealogyNode(realNodeId: string, title: string) {
    // Real GenealogyNode id -> its real wrapping InventoryItem, so
    // objectId stays consistently "InventoryItem.id" everywhere (matches
    // Browse Inventory's own selection/highlight convention).
    const wrappingItem = items.find((i) => i.genealogyNode?.id === realNodeId);
    if (!wrappingItem) return; // real gap: a DAG neighbor with no InventoryItem link yet (shouldn't happen post-backfill, not silently faked if it does)
    const node = nodes.find((n) => n.id === realNodeId);
    setSelected({
      feature: "inventory",
      objectType: "Genealogy",
      objectId: wrappingItem.id,
      payload: { kind: "genealogy_node", title, tier: node?.tier ?? "unknown", qr: node?.qr ?? null, location: wrappingItem.location },
    });
  }

  return (
    <PanelCard title="Relationships" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      {!sel && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Select an inventory item.
        </p>
      )}

      {sel && sel.payload.kind === "asset" && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real relationship data exists for Assets in this schema — not shown here rather than
          invented.
        </p>
      )}

      {sel && isGenealogy && (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
              Parents ({parents.length})
            </p>
            {parents.length === 0 ? (
              <p className="mt-1 text-xs" style={{ color: "var(--ff-text-muted)" }}>
                None.
              </p>
            ) : (
              <ul className="mt-1 space-y-1">
                {parents.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selectGenealogyNode(p.id, p.title)}
                      className="w-full rounded px-2 py-1 text-left text-xs"
                      style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
                    >
                      {p.title}
                      <span className="ml-1.5" style={{ color: "var(--ff-text-muted)" }}>
                        {p.subtitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
              Children ({children.length})
            </p>
            {children.length === 0 ? (
              <p className="mt-1 text-xs" style={{ color: "var(--ff-text-muted)" }}>
                None.
              </p>
            ) : (
              <ul className="mt-1 space-y-1">
                {children.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectGenealogyNode(c.id, c.title)}
                      className="w-full rounded px-2 py-1 text-left text-xs"
                      style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
                    >
                      {c.title}
                      <span className="ml-1.5" style={{ color: "var(--ff-text-muted)" }}>
                        {c.subtitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </PanelCard>
  );
}
