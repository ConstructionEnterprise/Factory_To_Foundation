import DetailRow from "./DetailRow";
import type { KpiDefinition } from "./KpiRow";

type KpiListProps = {
  kpis: KpiDefinition[];
};

/**
 * Compact vertical KPI list — label/value rows, for display inside a
 * dropdown panel. KpiRow's card grid is built for open page space; this
 * is the same KpiDefinition data rendered for a narrow floating panel.
 */
export default function KpiList({ kpis }: KpiListProps) {
  return (
    <div className="min-w-[220px]">
      {kpis.map((kpi) => (
        <DetailRow key={kpi.title} label={kpi.title} value={kpi.value} />
      ))}
    </div>
  );
}
