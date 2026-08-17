import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import type { MaterialRecord } from "../materialsApi";

const UNLOCATED_GROUP = "Location not recorded";

/** Grouped by real location -- same "group by the field that actually organizes this data" choice AssetsBrowse makes with category, LogisticsBrowse's own Storage zone makes implicitly by being one zone. */
function toBrowseItems(materials: MaterialRecord[]): BrowseListItem[] {
  const byLocation = new Map<string, MaterialRecord[]>();
  for (const m of materials) {
    const key = m.location ?? UNLOCATED_GROUP;
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key)!.push(m);
  }
  return Array.from(byLocation.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([location, rows]) => ({
      id: `location:${location}`,
      title: `${location} (${rows.length})`,
      children: rows
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({ id: m.id, title: m.name })),
    }));
}

export default function MaterialsBrowse({ materials }: { materials: MaterialRecord[] }) {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "materials" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Materials" className="h-full">
      {materials.length === 0 ? (
        <p className="p-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real materials yet.
        </p>
      ) : (
        <BrowseList
          items={toBrowseItems(materials)}
          activeId={activeId}
          onSelect={(id) => {
            const material = materials.find((m) => m.id === id);
            if (!material) return;
            setSelected({
              feature: "materials",
              objectType: "Material",
              objectId: material.id,
              payload: { name: material.name, quantity: material.quantity, location: material.location },
            });
          }}
        />
      )}
    </PanelCard>
  );
}
