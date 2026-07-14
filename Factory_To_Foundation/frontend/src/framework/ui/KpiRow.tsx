import KpiCard from "./KpiCard";

export type KpiDefinition = {
  title: string;
  value: string;
};

type KpiRowProps = {
  kpis: KpiDefinition[];
};

/**
 * A row of KPI cards. Content is entirely prop-driven — different
 * features show different KPIs, this component just lays them out.
 * Column count follows however many KPIs are passed, rather than
 * assuming every feature has exactly six like Genealogy does.
 */
export default function KpiRow({ kpis }: KpiRowProps) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}
    >
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} title={kpi.title} value={kpi.value} />
      ))}
    </div>
  );
}
