import { FeaturePage } from "@/framework/ui";

import {
  GeometryViewport,
  ManufacturingBrowse,
  ManufacturingInspector,
  ManufacturingToolbar,
} from "@/features/manufacturing";

/**
 * No Metrics dropdown here — real decomposed geometry is ingested now
 * (see GeometryViewport/gardenLoftsModel.ts), but nothing has been
 * scoped into KPI-shaped numbers yet; inventing a rollup would
 * misrepresent the page's actual state.
 */
export default function ManufacturingPage() {
  return (
    <FeaturePage
      pageLabel="Manufacturing"
      pageSubtitle="Geometry Ingestion & Module Assembly"
      toolbar={<ManufacturingToolbar />}
      left={<ManufacturingBrowse />}
      center={<GeometryViewport />}
      right={<ManufacturingInspector />}
    />
  );
}
