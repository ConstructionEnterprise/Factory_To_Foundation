import { useEffect, useState } from "react";

import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import { InventoryBrowse, InventoryInspector, InventoryRelationships, InventoryToolbar } from "@/features/inventory";
import { fetchInventoryItems, type InventoryItem } from "@/features/inventory/inventoryApi";

/**
 * Real Inventory domain (Phase 2, 2026-08-15) — the shared identity layer
 * over Asset and GenealogyNode (schema.prisma's InventoryItem). Per the
 * FF standing UI rule (sidebar = domain, CommandRibbon = capability,
 * workspace = view): Inventory is a real new sidebar domain; Search lives
 * in the Filters ribbon (InventoryToolbar), not a separate page.
 *
 * Deliberately NOT a wrapper around the existing /assets and Genealogy
 * pages — those keep working, completely untouched, while this real,
 * separate domain proves itself. Retiring them is a later, explicit
 * decision, not part of this build.
 */
export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchInventoryItems(activeQuery || undefined)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [activeQuery]);

  const assetCount = items.filter((i) => i.kind === "asset").length;
  const genealogyCount = items.filter((i) => i.kind === "genealogy_node").length;

  const kpis: KpiDefinition[] = [
    { title: "Real Inventory Items", value: String(items.length) },
    { title: "Assets", value: String(assetCount) },
    { title: "Genealogy", value: String(genealogyCount) },
  ];

  return (
    <FeaturePage
      pageLabel="Inventory"
      pageSubtitle={error ? `Enterprise Object Identity — ${error}` : "Enterprise Object Identity — Assets & Genealogy"}
      kpis={<KpiList kpis={kpis} />}
      toolbar={<InventoryToolbar query={queryInput} onQueryChange={setQueryInput} onSearch={() => setActiveQuery(queryInput)} />}
      left={<InventoryBrowse items={items} loading={loading} error={error} />}
      center={<InventoryInspector />}
      right={<InventoryRelationships items={items} />}
    />
  );
}
