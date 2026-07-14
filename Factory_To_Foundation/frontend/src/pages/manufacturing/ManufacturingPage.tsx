import { FeaturePage } from "@/framework/ui";

import {
  ManufacturingBrowse,
  ManufacturingInspector,
  ManufacturingToolbar,
  ManufacturingViewport,
} from "@/features/manufacturing";

/**
 * No Metrics dropdown here — there's no real geometry-ingestion data
 * yet to summarize into KPIs, and inventing numbers for an empty
 * pipeline would misrepresent the page's actual state.
 */
export default function ManufacturingPage() {
  return (
    <FeaturePage
      pageLabel="Manufacturing"
      pageSubtitle="Geometry Ingestion & Module Assembly"
      toolbar={<ManufacturingToolbar />}
      left={<ManufacturingBrowse />}
      center={<ManufacturingViewport />}
      right={<ManufacturingInspector />}
    />
  );
}
