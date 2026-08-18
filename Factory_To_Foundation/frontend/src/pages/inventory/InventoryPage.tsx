import { useEffect, useState } from "react";

import { FeaturePage } from "@/framework/ui";

import { AssetsBrowse, AssetsInspector, AssetsMap } from "@/features/assets";
import { fetchAssets } from "@/features/assets/assetsApi";
import { layoutAssets, type AssetNodeData } from "@/features/assets/assetsData";

import { GenealogyBrowser, RelationshipGraph, SelectedObject } from "@/features/genealogy";
import { ensureGenealogyGraphLoaded } from "@/features/genealogy/genealogyStore";

import { MaterialsBrowse, MaterialsInspector, MaterialsSummary } from "@/features/materials";
import { fetchMaterials, type MaterialRecord } from "@/features/materials/materialsApi";

type InventoryMode = "assets" | "materials" | "genealogy";

/**
 * Real Inventory domain (Phase 2, 2026-08-15; UX corrected same day;
 * Materials capability added Phase 3, 2026-08-17). Per the FF standing UI
 * rule (sidebar = domain, CommandRibbon = capability, workspace = view):
 * Inventory is the sidebar domain; Asset/Materials/Genealogy are
 * capabilities reached via real ribbon capability switches
 * (CommandRibbon.tsx's `onClick`/`active` RibbonMenu shape); the workspace
 * renders real components (Assets/Genealogy reuse the exact same ones
 * their own standalone /assets and Genealogy (/) routes use; Materials is
 * new, no standalone route existed for it before this phase).
 *
 * Materials was promoted here from being a Logistics-only concept (Phase
 * 3 audit finding): LogisticsMaterial was the one real Inventory-adjacent
 * object type NOT wired into InventoryItem's shared identity layer that
 * Asset/GenealogyNode/Vehicle/LogisticsModule already share — see
 * schema.prisma's InventoryItemKind enum. Creation stays in Logistics
 * (LogisticsMaterialForm, where the real physical intake event happens —
 * the "Storage" zone of LogisticsBrowse), matching the same real-world
 * distinction Phase 4 drew for LogisticsFlow vs. CostAssembly: this page
 * is a real, honest READ projection of the same authoritative rows, not a
 * duplicate creation path.
 *
 * `/assets` and Genealogy's own route stay completely untouched and
 * fully live — this page is an additional real entry point into the same
 * real data (fetched independently, no shared state with those routes),
 * not a replacement.
 *
 * Metrics/Filters removed (Phase 10, 2026-08-18) per Joshua's explicit
 * "remove metrics and filters from every command ribbon" instruction --
 * AssetsToolbar/GenealogyToolbar were both confirmed decorative (no
 * onClick/onChange anywhere); this also closes the real "Filters vanishes
 * on Materials but not Assets/Genealogy" inconsistency found earlier the
 * same phase, since none of the three branches show it anymore.
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

  useEffect(() => {
    ensureGenealogyGraphLoaded();
  }, []);

  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  useEffect(() => {
    fetchMaterials()
      .then(setMaterials)
      .catch((err) => setMaterialsError(err instanceof Error ? err.message : String(err)));
  }, []);

  const extraMenus = [
    { label: "Assets", onClick: () => setMode("assets"), active: mode === "assets" },
    { label: "Materials", onClick: () => setMode("materials"), active: mode === "materials" },
    { label: "Genealogy", onClick: () => setMode("genealogy"), active: mode === "genealogy" },
  ];

  if (mode === "materials") {
    return (
      <FeaturePage
        pageLabel="Inventory"
        pageSubtitle={materialsError ? `Materials — Stock & Location — ${materialsError}` : "Materials — Stock & Location"}
        extraMenus={extraMenus}
        left={<MaterialsBrowse materials={materials} />}
        center={<MaterialsSummary materials={materials} />}
        right={<MaterialsInspector />}
      />
    );
  }

  if (mode === "genealogy") {
    return (
      <FeaturePage
        pageLabel="Inventory"
        pageSubtitle="Genealogy — End-to-End Traceability & Object Relationships"
        extraMenus={extraMenus}
        left={<GenealogyBrowser />}
        center={<RelationshipGraph />}
        right={<SelectedObject />}
      />
    );
  }

  return (
    <FeaturePage
      pageLabel="Inventory"
      pageSubtitle={assetsError ? `Assets — Enterprise Asset Management — ${assetsError}` : "Assets — Enterprise Asset Management"}
      extraMenus={extraMenus}
      left={<AssetsBrowse assetNodes={assets} />}
      center={<AssetsMap assetNodes={assets} />}
      right={<AssetsInspector />}
    />
  );
}
