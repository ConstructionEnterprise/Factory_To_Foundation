import { ErrorBoundary, FeaturePage } from "@/framework/ui";

import {
  GeometryViewport,
  ManufacturingBrowse,
  ManufacturingInspector,
  ManufacturingToolbar,
} from "@/features/manufacturing";

/**
 * No Metrics dropdown here — real decomposed geometry is ingested now
 * (see GeometryViewport/manufacturingModel.ts), but nothing has been
 * scoped into KPI-shaped numbers yet; inventing a rollup would
 * misrepresent the page's actual state.
 *
 * Each panel gets its own `ErrorBoundary` rather than one around the
 * whole page — `ManufacturingBrowse` and `GeometryViewport` both call
 * the real `useManufacturingTree()`/`useGLTF()` loading path directly
 * (a real, previously-uncaught crash risk on this page specifically:
 * a genuine GLTF fetch/parse failure throws during render, and with no
 * boundary anywhere it silently blanked the whole app). Isolating per
 * panel means a real failure in that load shows a real error exactly
 * where it happened instead of taking down panels that don't depend on
 * it (Inspector, until something is actually selected).
 */
export default function ManufacturingPage() {
  return (
    <FeaturePage
      pageLabel="Manufacturing"
      pageSubtitle="Geometry Ingestion & Module Assembly"
      toolbar={<ManufacturingToolbar />}
      left={
        <ErrorBoundary label="Browse Models">
          <ManufacturingBrowse />
        </ErrorBoundary>
      }
      center={
        <ErrorBoundary label="Geometry Viewport">
          <GeometryViewport />
        </ErrorBoundary>
      }
      right={
        <ErrorBoundary label="Selected Geometry">
          <ManufacturingInspector />
        </ErrorBoundary>
      }
    />
  );
}
