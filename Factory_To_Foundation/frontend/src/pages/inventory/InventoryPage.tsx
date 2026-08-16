import { useEffect, useState } from "react";

import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  AssetsBrowse,
  AssetsInspector,
  AssetsMap,
  AssetsToolbar,
} from "@/features/assets";
import { fetchAssets } from "@/features/assets/assetsApi";
import { getAssetSummary, layoutAssets, type AssetNodeData } from "@/features/assets/assetsData";

import {
  GenealogyBrowser,
  GenealogyToolbar,
  RelationshipGraph,
  SelectedObject,
} from "@/features/genealogy";
import { getGenealogyKpis } from "@/features/genealogy/genealogySummary";
import { ensureGenealogyGraphLoaded, useGenealogyGraph } from "@/features/genealogy/genealogyStore";

type InventoryMode = "assets" | "genealogy";

/**
 * Real Inventory domain (Phase 2, 2026-08-15; UX corrected same day).
 * Per the FF standing UI rule (sidebar = domain, CommandRibbon =
 * capability, workspace = view): Inventory is the sidebar domain; Assets
 * and Genealogy are capabilities reached via real ribbon capability
 * switches (CommandRibbon.tsx's `onClick`/`active` RibbonMenu shape,
 * added specifically for this — the same mechanism Fleet-in-Logistics
 * needs); the workspace renders the exact same real components the
 * standalone /assets and Genealogy (/) pages already use — not a
 * second, different presentation of the same data. Switching capability
 * shows the identical real map/browse/inspector or node-graph a user
 * already knows from those pages, just reached from Inventory's own
 * ribbon instead of the sidebar.
 *
 * `/assets` and Genealogy's own route stay completely untouched and
 * fully live — this page is an additional real entry point into the same
 * real data (fetched independently, no shared state with those routes),
 * not a replacement.
 */
export default function InventoryPage() {
  const [mode, setMode] = useState<InventoryMode>("assets");

  const [assets, setAssets] = useState<AssetNodeData[]>([]);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets()
      .then((records) => setAssets(layoutAssets(records)))
      .catch((err) => setAssetsError(err instanceof Error ? err.message : String(err)));
  }, []);

  const { nodes: genealogyNodes, edges: genealogyEdges } = useGenealogyGraph();

  useEffect(() => {
    ensureGenealogyGraphLoaded();
  }, []);

  const extraMenus = [
    { label: "Assets", onClick: () => setMode("assets"), active: mode === "assets" },
    { label: "Genealogy", onClick: () => setMode("genealogy"), active: mode === "genealogy" },
  ];

  if (mode === "genealogy") {
    return (
      <FeaturePage
        pageLabel="Inventory"
        pageSubtitle="Genealogy — End-to-End Traceability & Object Relationships"
        extraMenus={extraMenus}
        kpis={<KpiList kpis={getGenealogyKpis(genealogyNodes, genealogyEdges)} />}
        toolbar={<GenealogyToolbar />}
        left={<GenealogyBrowser />}
        center={<RelationshipGraph />}
        right={<SelectedObject />}
      />
    );
  }

  const summary = getAssetSummary(assets);
  const assetsKpis: KpiDefinition[] = [
    { title: "Total Assets", value: String(summary.total) },
    { title: "Active", value: String(summary.active) },
    { title: "In Maintenance", value: String(summary.maintenance) },
    { title: "Retired", value: String(summary.retired) },
  ];

  return (
    <FeaturePage
      pageLabel="Inventory"
      pageSubtitle={assetsError ? `Assets — Enterprise Asset Management — ${assetsError}` : "Assets — Enterprise Asset Management"}
      extraMenus={extraMenus}
      kpis={<KpiList kpis={assetsKpis} />}
      toolbar={<AssetsToolbar />}
      left={<AssetsBrowse assetNodes={assets} />}
      center={<AssetsMap assetNodes={assets} />}
      right={<AssetsInspector />}
    />
  );
}
