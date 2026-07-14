import { PanelCard } from "@/framework/ui";

/**
 * No fabricated object tree here — this feature is scoped to ingest
 * real Blender geometry (.blend), not invented data. The browse list
 * populates once a file has actually been imported.
 */
export default function ManufacturingBrowse() {
  return (
    <PanelCard title="Browse Geometry" className="h-[560px]">
      <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-400">
        <p>No geometry imported yet.</p>
        <p className="mt-1">Import a .blend file to populate this tree.</p>
      </div>
    </PanelCard>
  );
}
