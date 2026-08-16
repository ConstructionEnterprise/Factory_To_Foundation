import { useEffect } from "react";

import { useSelection } from "@/context/SelectionContext";
import { PanelCard } from "@/framework/ui";
import { ensureGenealogyGraphLoaded, useGenealogyGraph } from "@/features/genealogy/genealogyStore";
import { getChildren, getParents } from "@/features/genealogy/relationships";

/**
 * Real Relationships panel — only `genealogy_node`-kind items have real
 * parent/child relationship data (the real GenealogyEdge DAG, same source
 * genealogyStore.ts already loads for the Genealogy page). `asset`-kind
 * items honestly show no relationship data rather than fabricating one —
 * no relationship model exists for Assets in this schema.
 */
export default function InventoryRelationships() {
  const { selected, setSelected } = useSelection();
  const sel = selected?.feature === "inventory" ? selected : undefined;
  const { nodes, edges } = useGenealogyGraph();

  useEffect(() => {
    ensureGenealogyGraphLoaded();
  }, []);

  const isGenealogy = sel?.payload.kind === "genealogy_node";
  const parents = isGenealogy ? getParents(nodes, edges, sel!.objectId) : [];
  const children = isGenealogy ? getChildren(nodes, edges, sel!.objectId) : [];

  function selectGenealogyNode(id: string, title: string) {
    const node = nodes.find((n) => n.id === id);
    setSelected({
      feature: "inventory",
      objectType: "Genealogy",
      objectId: id,
      payload: { kind: "genealogy_node", title, tier: node?.tier ?? "unknown", qr: node?.qr ?? null, location: null },
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
