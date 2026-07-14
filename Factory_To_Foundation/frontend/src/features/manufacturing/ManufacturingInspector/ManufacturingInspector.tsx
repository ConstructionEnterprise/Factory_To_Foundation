import { PanelCard } from "@/framework/ui";

export default function ManufacturingInspector() {
  return (
    <PanelCard title="Selected Geometry" className="h-[560px]" bodyClassName="flex-1 overflow-auto p-5">
      <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-400">
        <p>Nothing selected.</p>
        <p className="mt-1">Object properties will appear here once geometry is imported and selected.</p>
      </div>
    </PanelCard>
  );
}
