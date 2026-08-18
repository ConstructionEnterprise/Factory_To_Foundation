import { useEffect, useState } from "react";

import { FeaturePage } from "@/framework/ui";

import { AssetsBrowse, AssetsInspector, AssetsMap } from "@/features/assets";
import { fetchAssets } from "@/features/assets/assetsApi";
import { layoutAssets, type AssetNodeData } from "@/features/assets/assetsData";

/**
 * Real fetch, same pattern as ScheduleGantt's fetchScheduleTaskDirectory --
 * loaded once here and passed down, rather than each of Browse/Map
 * independently importing the old static fixture. Real Asset records have
 * no x/y/width/height (frontend-only grid placement), applied via the same
 * layoutAssets() the fixture always used on itself.
 *
 * Metrics/Filters removed (Phase 10, 2026-08-18) per Joshua's explicit
 * "remove metrics and filters from every command ribbon" instruction --
 * AssetsToolbar was confirmed decorative (no onClick/onChange anywhere);
 * the KPI numbers were real but purely informational, not a functional
 * control, so nothing actionable was lost.
 */
export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetNodeData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets()
      .then((records) => setAssets(layoutAssets(records)))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <FeaturePage
      pageLabel="Assets"
      pageSubtitle={error ? `Enterprise Asset Management — ${error}` : "Enterprise Asset Management"}
      left={<AssetsBrowse assetNodes={assets} />}
      center={<AssetsMap assetNodes={assets} />}
      right={<AssetsInspector />}
    />
  );
}
