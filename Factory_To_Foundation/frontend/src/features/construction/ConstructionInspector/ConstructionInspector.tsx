import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, PreviewBox } from "@/framework/ui";

export default function ConstructionInspector() {
  const { selected } = useSelection();
  const sel = selected?.feature === "construction" ? selected : undefined;

  return (
    <PanelCard title="Selected Object" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
      <PreviewBox />

      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>{sel?.payload.name ?? "Nothing Selected"}</h2>
        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>{sel?.objectType ?? "Select an object"}</p>
      </div>

      <div className="mt-5 space-y-0.5">
        <DetailRow label="Progress" value={sel?.payload.progress ?? "--"} />
        <DetailRow label="Trade" value={sel?.payload.trade ?? "--"} />
        <DetailRow label="Inspector" value={sel?.payload.inspector ?? "--"} />
        <DetailRow label="Punch List" value={sel?.payload.punchListCount ?? "--"} />
      </div>
    </PanelCard>
  );
}
