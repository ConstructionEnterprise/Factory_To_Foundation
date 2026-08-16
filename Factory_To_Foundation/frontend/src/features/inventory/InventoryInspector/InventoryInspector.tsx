import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

const ASSET_STATUS_TONE: Record<string, StatusTone> = {
  active: "positive",
  maintenance: "warning",
  retired: "neutral",
};

/**
 * Real Inventory detail — Lifecycle/Location/Service for `asset`-kind
 * items, Genealogy tier/QR for `genealogy_node`-kind items, resolved from
 * the same real InventoryItem selection payload (kind-discriminated, see
 * SelectionContext.tsx's InventoryPayload). One panel, two real shapes —
 * not two competing inspectors.
 */
export default function InventoryInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "inventory" ? selected : undefined;

  return (
    <PanelCard title="Inventory Item" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {sel?.payload.title ?? "Nothing Selected"}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {sel?.objectType ?? "Select an inventory item"}
        </p>
      </div>

      {sel?.payload.kind === "asset" && (
        <>
          <div className="mt-4">
            <StatusBadge label={sel.payload.status} tone={ASSET_STATUS_TONE[sel.payload.status] ?? "neutral"} />
          </div>
          <div className="mt-5 space-y-0.5">
            <DetailRow label="Category" value={sel.payload.category} />
            <DetailRow label="Family" value={sel.payload.family} />
            <DetailRow label="Location" value={sel.payload.location ?? "--"} />
            <DetailRow label="Manufacturer" value={sel.payload.manufacturer} />
            <DetailRow label="Model" value={sel.payload.model} />
            <DetailRow label="Serial Number" value={sel.payload.serialNumber} />
            <DetailRow label="Asset Tag" value={sel.payload.assetTag} />
            <DetailRow label="Acquired" value={new Date(sel.payload.acquisitionDate).toLocaleDateString()} />
            <DetailRow label="Last Service" value={new Date(sel.payload.lastService).toLocaleDateString()} />
            <DetailRow
              label="Next Service"
              value={sel.payload.nextService ? new Date(sel.payload.nextService).toLocaleDateString() : "--"}
            />
            <DetailRow label="Notes" value={sel.payload.notes ?? "--"} />
          </div>
        </>
      )}

      {sel?.payload.kind === "genealogy_node" && (
        <>
          <div className="mt-4">
            <StatusBadge label={sel.payload.tier} tone="neutral" />
          </div>
          <div className="mt-5 space-y-0.5">
            <DetailRow label="Tier" value={sel.payload.tier} />
            <DetailRow label="Location" value={sel.payload.location ?? "--"} />
            <DetailRow label="QR" value={sel.payload.qr ?? "No real QR built for this tier yet"} />
          </div>
        </>
      )}

      {!sel && (
        <p className="mt-5 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Click a real asset or genealogy object in Browse Inventory.
        </p>
      )}
    </PanelCard>
  );
}
