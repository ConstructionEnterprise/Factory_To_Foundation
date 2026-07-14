import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  AssetsBrowse,
  AssetsInspector,
  AssetsMap,
  AssetsToolbar,
} from "@/features/assets";

const assetsKpis: KpiDefinition[] = [
  { title: "Total Assets", value: "4" },
  { title: "Active", value: "3" },
  { title: "In Maintenance", value: "1" },
];

export default function AssetsPage() {
  return (
    <FeaturePage
      pageLabel="Assets"
      pageSubtitle="Enterprise Asset Management"
      kpis={<KpiList kpis={assetsKpis} />}
      toolbar={<AssetsToolbar />}
      left={<AssetsBrowse />}
      center={<AssetsMap />}
      right={<AssetsInspector />}
    />
  );
}
