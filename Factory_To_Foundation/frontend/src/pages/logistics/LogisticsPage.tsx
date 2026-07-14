import { FeaturePage, KpiList, type KpiDefinition } from "@/framework/ui";

import {
  LogisticsBrowse,
  LogisticsInspector,
  LogisticsLayout,
  LogisticsToolbar,
} from "@/features/logistics";

const logisticsKpis: KpiDefinition[] = [
  { title: "Modules Staged", value: "14" },
  { title: "In Transit", value: "2" },
  { title: "Dock Utilization", value: "68%" },
  { title: "Deliveries (MTD)", value: "37" },
];

export default function LogisticsPage() {
  return (
    <FeaturePage
      pageLabel="Logistics"
      pageSubtitle="Material & Module Flow"
      kpis={<KpiList kpis={logisticsKpis} />}
      toolbar={<LogisticsToolbar />}
      left={<LogisticsBrowse />}
      center={<LogisticsLayout />}
      right={<LogisticsInspector />}
    />
  );
}
