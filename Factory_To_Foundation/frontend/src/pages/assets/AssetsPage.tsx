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

/**
 * Real fetch, same pattern as ScheduleGantt's fetchScheduleTaskDirectory --
 * loaded once here and passed down, rather than each of Browse/Map
 * independently importing the old static fixture. Real Asset records have
 * no x/y/width/height (frontend-only grid placement), applied via the same
 * layoutAssets() the fixture always used on itself.
 */
export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetNodeData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets()
      .then((records) => setAssets(layoutAssets(records)))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const summary = getAssetSummary(assets);

  const assetsKpis: KpiDefinition[] = [
    { title: "Total Assets", value: String(summary.total) },
    { title: "Active", value: String(summary.active) },
    { title: "In Maintenance", value: String(summary.maintenance) },
    { title: "Retired", value: String(summary.retired) },
  ];

  return (
    <FeaturePage
      pageLabel="Assets"
      pageSubtitle={error ? `Enterprise Asset Management — ${error}` : "Enterprise Asset Management"}
      kpis={<KpiList kpis={assetsKpis} />}
      toolbar={<AssetsToolbar />}
      left={<AssetsBrowse assetNodes={assets} />}
      center={<AssetsMap assetNodes={assets} />}
      right={<AssetsInspector />}
    />
  );
}
