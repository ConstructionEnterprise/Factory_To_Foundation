import { PanelCard } from "@/framework/ui";
import { Viewport } from "@/framework/viewport";

/**
 * Reuses the same framework Viewport (camera/pan/zoom) as every other
 * feature — no second viewport implementation. Empty until real
 * geometry is imported; contentBounds is intentionally omitted since
 * there's nothing to fit to yet.
 */
export default function ManufacturingViewport() {
  return (
    <PanelCard title="Geometry Viewport" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="relative flex-1">
        <Viewport>
          <div className="flex h-full w-full items-center justify-center">
            <div className="max-w-xs rounded-lg border border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm font-medium text-gray-600">No geometry imported</p>
              <p className="mt-2 text-xs text-gray-400">
                Import a .blend file to view it here. This viewport uses the
                same pan/zoom camera as Genealogy and Factory.
              </p>
            </div>
          </div>
        </Viewport>
      </div>
    </PanelCard>
  );
}
