import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import type { InventoryItem } from "../inventoryApi";

const KIND_LABEL: Record<InventoryItem["kind"], string> = {
  asset: "Assets",
  genealogy_node: "Genealogy",
};

function toSelectionPayload(item: InventoryItem) {
  if (item.kind === "asset" && item.asset) {
    return {
      kind: "asset" as const,
      title: item.title,
      category: item.asset.category,
      family: item.asset.family,
      status: item.asset.status,
      location: item.location,
      manufacturer: item.asset.manufacturer,
      model: item.asset.model,
      serialNumber: item.asset.serialNumber,
      assetTag: item.asset.assetTag,
      acquisitionDate: item.asset.acquisitionDate,
      lastService: item.asset.lastService,
      nextService: item.asset.nextService,
      notes: item.asset.notes,
    };
  }
  return {
    kind: "genealogy_node" as const,
    title: item.title,
    tier: item.genealogyNode?.tier ?? "unknown",
    qr: item.genealogyNode?.qr ?? null,
    location: item.location,
  };
}

/**
 * Real Inventory Browse — one shared list over Inventory's identity layer
 * (InventoryItem), grouped by real `kind` (Assets / Genealogy), not a
 * fixed taxonomy. Same `children`-grouped BrowseList pattern
 * LogisticsFlowBrowse.tsx already uses for its own real, open-ended
 * `type` groupings.
 */
export default function InventoryBrowse({ items, loading, error }: { items: InventoryItem[]; loading: boolean; error: string | null }) {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "inventory" ? selected.objectId : undefined;

  const byKind = new Map<InventoryItem["kind"], InventoryItem[]>();
  for (const item of items) {
    if (!byKind.has(item.kind)) byKind.set(item.kind, []);
    byKind.get(item.kind)!.push(item);
  }

  const groupedItems: BrowseListItem[] = Array.from(byKind.entries()).map(([kind, kindItems]) => ({
    id: `kind:${kind}`,
    title: `${KIND_LABEL[kind]} (${kindItems.length})`,
    children: kindItems
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((item) => ({ id: item.id, title: item.title })),
  }));

  return (
    <PanelCard title="Browse Inventory" className="h-full">
      {error && (
        <p className="p-4 text-xs" style={{ color: "var(--ff-status-critical)" }}>
          Couldn't load real inventory ({error})
        </p>
      )}
      {!error && loading && (
        <p className="p-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Loading real inventory…
        </p>
      )}
      {!error && !loading && items.length === 0 && (
        <p className="p-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real inventory items visible to your role.
        </p>
      )}
      {!error && !loading && items.length > 0 && (
        <BrowseList
          items={groupedItems}
          activeId={activeId}
          onSelect={(id) => {
            const item = items.find((i) => i.id === id);
            if (!item) return;
            setSelected({
              feature: "inventory",
              objectType: KIND_LABEL[item.kind],
              objectId: item.id,
              payload: toSelectionPayload(item),
            });
          }}
        />
      )}
    </PanelCard>
  );
}
