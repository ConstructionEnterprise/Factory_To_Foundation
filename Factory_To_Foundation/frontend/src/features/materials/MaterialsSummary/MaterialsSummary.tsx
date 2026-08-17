import { useSelection } from "@/context/SelectionContext";
import { PanelCard } from "@/framework/ui";

import type { MaterialRecord } from "../materialsApi";

/**
 * Real center-panel view -- same role Assets' Map plays (a different real
 * projection of the same real data, not a second data source). Materials
 * has no geo-position concept, so this is a real per-location quantity
 * rollup instead of a map: every number here is computed live from the
 * same `materials` list Browse/Inspector already use, nothing fabricated.
 */
export default function MaterialsSummary({ materials }: { materials: MaterialRecord[] }) {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "materials" ? selected.objectId : undefined;

  const byLocation = new Map<string, { count: number; quantity: number }>();
  let totalQuantity = 0;
  let unspecifiedQuantity = 0;
  for (const m of materials) {
    const key = m.location ?? "Location not recorded";
    const entry = byLocation.get(key) ?? { count: 0, quantity: 0 };
    entry.count += 1;
    if (m.quantity != null) {
      entry.quantity += m.quantity;
      totalQuantity += m.quantity;
    } else {
      unspecifiedQuantity += 1;
    }
    byLocation.set(key, entry);
  }
  const rows = Array.from(byLocation.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <PanelCard title="Materials by Location" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mb-5 flex gap-6">
        <div>
          <div className="text-2xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
            {materials.length}
          </div>
          <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
            Real materials
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
            {totalQuantity.toLocaleString()}
          </div>
          <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
            Total quantity{unspecifiedQuantity > 0 ? ` (${unspecifiedQuantity} unspecified)` : ""}
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
            {byLocation.size}
          </div>
          <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
            Real locations
          </div>
        </div>
      </div>

      {materials.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real materials yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase" style={{ color: "var(--ff-text-muted)" }}>
              <th className="pb-2">Location</th>
              <th className="pb-2 text-right">Materials</th>
              <th className="pb-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([location, stats]) => (
              <tr
                key={location}
                className="cursor-pointer border-t"
                style={{ borderColor: "var(--ff-panel-border)" }}
                onClick={() => {
                  const first = materials.find((m) => (m.location ?? "Location not recorded") === location);
                  if (!first) return;
                  setSelected({
                    feature: "materials",
                    objectType: "Material",
                    objectId: first.id,
                    payload: { name: first.name, quantity: first.quantity, location: first.location },
                  });
                }}
              >
                <td className="py-1.5" style={{ color: activeId ? "var(--ff-text-secondary)" : "var(--ff-text-primary)" }}>
                  {location}
                </td>
                <td className="py-1.5 text-right">{stats.count}</td>
                <td className="py-1.5 text-right">{stats.quantity.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PanelCard>
  );
}
