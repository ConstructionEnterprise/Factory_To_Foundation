import { Suspense, useState } from "react";
import { useGLTF } from "@react-three/drei";

import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import {
  measureNode,
  metersLabel,
  useManufacturingModelUrl,
  useManufacturingTree,
  type ManufacturingNode,
  type ManufacturingTree,
} from "../manufacturingModel";

/**
 * Mirrors the tree's own real shape exactly — a node's row title is its
 * real name, whatever that name is; a node's children become the row's
 * children, however many levels deep that really goes. No assumption a
 * "building"/"level"/"unit" concept exists.
 */
function toBrowseItems(nodes: ManufacturingNode[]): BrowseListItem[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.name,
    children: node.children.length > 0 ? toBrowseItems(node.children) : undefined,
  }));
}

function ObjectsTree() {
  const { selected, setSelected } = useSelection();
  const tree = useManufacturingTree();
  const activeId = selected?.feature === "manufacturing" ? selected.objectId : undefined;

  return (
    <BrowseList
      items={toBrowseItems(tree.roots)}
      activeId={activeId}
      onSelect={(id) => {
        const node = tree.nodesById.get(id);
        if (!node) return;
        setSelected({
          feature: "manufacturing",
          objectType: node.children.length > 0 ? "Group" : "Object",
          objectId: node.id,
          payload: { name: node.name, extras: node.extras },
        });
      }}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-xs" style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
      <dt style={{ color: "var(--ff-text-muted)" }}>{label}</dt>
      <dd className="text-right font-medium" style={{ color: "var(--ff-text-primary)" }}>{value}</dd>
    </div>
  );
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * One sheet per real selectable element — whatever the tree's real nodes
 * actually are for this file, not "one per unit" or "one per module".
 * Real bounding-box dimensions always shown; real extras shown generically,
 * whatever keys this specific node happens to carry; absence of extras is
 * an honest, expected state, not an error.
 */
function ElementSheet({ node, onBack }: { node: ManufacturingNode; onBack: () => void }) {
  const { scene } = useGLTF(useManufacturingModelUrl());
  const size = measureNode(scene, node.id);
  const extraEntries = Object.entries(node.extras);

  return (
    <div className="p-4 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-xs font-medium"
        style={{ color: "var(--ff-accent)" }}
      >
        ← Back to sheets
      </button>

      <h3 className="text-base font-bold" style={{ color: "var(--ff-text-primary)" }}>
        {node.name}
      </h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Structured spec sheet — real data only, not a rendered dimensioned CAD drawing.
      </p>

      <dl className="mt-3 space-y-1.5">
        <Row label="Object Name" value={node.name} />
        {size ? (
          <>
            <Row label="Width (X)" value={metersLabel(size.x)} />
            <Row label="Height (Y)" value={metersLabel(size.y)} />
            <Row label="Depth (Z)" value={metersLabel(size.z)} />
          </>
        ) : (
          <Row label="Bounding Box" value="No geometry on this node — not confirmed" />
        )}
        {extraEntries.length > 0 ? (
          extraEntries.map(([key, value]) => <Row key={key} label={humanizeKey(key)} value={String(value)} />)
        ) : (
          <Row label="Metadata" value="None in the source file for this element — not confirmed" />
        )}
      </dl>
    </div>
  );
}

function ShopDrawingsTree({ tree }: { tree: ManufacturingTree }) {
  const { setSelected } = useSelection();
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);

  if (openSheetId) {
    const node = tree.nodesById.get(openSheetId);
    if (node) {
      return <ElementSheet node={node} onBack={() => setOpenSheetId(null)} />;
    }
  }

  return (
    <BrowseList
      items={toBrowseItems(tree.roots)}
      onSelect={(id) => {
        const node = tree.nodesById.get(id);
        if (!node) return;
        setOpenSheetId(id);

        // Also drives the real global selection (Inspector + GeometryViewport
        // both react) — one identity scheme, not two parallel mechanisms.
        setSelected({
          feature: "manufacturing",
          objectType: node.children.length > 0 ? "Group" : "Object",
          objectId: node.id,
          payload: { name: node.name, extras: node.extras },
        });
      }}
    />
  );
}

function ShopDrawingsTreeLoaded() {
  const tree = useManufacturingTree();
  return <ShopDrawingsTree tree={tree} />;
}

/**
 * Real tree, exactly as the currently-loaded model's own hierarchy is
 * authored — no fabricated grouping level, no naming-pattern assumption.
 * A deeply flat file (hundreds of same-level siblings) and a shallow one
 * both render through this identical path; see manufacturingModel.ts.
 *
 * A second mode, "Shop Drawings" (toggled via the PanelCard header), shows
 * the same real tree but clicking opens one structured spec-sheet per
 * node — self-contained master/detail local to this panel, also driving
 * the real global SelectionContext so the viewport/Inspector stay in sync.
 */
export default function ManufacturingBrowse() {
  const [mode, setMode] = useState<"objects" | "drawings">("objects");

  const toggle = (
    <div className="flex gap-1">
      {(["objects", "drawings"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className="rounded-[0.2rem] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide"
          style={{
            background: mode === m ? "var(--ff-accent)" : "transparent",
            color: mode === m ? "white" : "var(--ff-text-muted)",
          }}
        >
          {m === "objects" ? "Objects" : "Shop Drawings"}
        </button>
      ))}
    </div>
  );

  return (
    <PanelCard title="Browse Models" toolbar={toggle} className="h-[560px]">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading geometry…</div>
        }
      >
        {mode === "objects" ? <ObjectsTree /> : <ShopDrawingsTreeLoaded />}
      </Suspense>
    </PanelCard>
  );
}
