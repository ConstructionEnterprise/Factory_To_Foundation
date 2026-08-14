import { DetailRow, PanelCard, StatusBadge } from "@/framework/ui";
import type { StatusTone } from "@/framework/ui";

import { robotLibraryCatalog } from "./robotLibraryCatalog";
import type { EngineeringAssetStatus } from "./engineeringAssetTypes";

const STATUS_TONE: Record<EngineeringAssetStatus, StatusTone> = {
  previewable: "positive",
  launchable: "positive",
  not_ready: "neutral",
  "protected-reference": "warning",
};

const STATUS_LABEL: Record<EngineeringAssetStatus, string> = {
  previewable: "Previewable",
  launchable: "Launchable",
  not_ready: "Not ready",
  "protected-reference": "Protected reference",
};

type RobotLibraryInspectorProps = {
  selectedId?: string;
};

/**
 * Right panel: provenance and verification -- the part of the honest-
 * status model that distinguishes "we recovered documentation about this"
 * from "we verified this actually runs" from "this is executable." Every
 * field here traces to something Phase 1-4.5 actually did, not aspiration.
 */
export default function RobotLibraryInspector({ selectedId }: RobotLibraryInspectorProps) {
  const asset = robotLibraryCatalog.find((a) => a.id === selectedId);

  if (!asset) {
    return (
      <PanelCard title="Verification & Provenance" className="h-full">
        <div className="p-4 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Nothing selected.
        </div>
      </PanelCard>
    );
  }

  const { source, visualization, verification } = asset;

  return (
    <PanelCard title="Verification & Provenance" className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "var(--ff-text-muted)" }}>Status</span>
          <StatusBadge label={STATUS_LABEL[asset.status]} tone={STATUS_TONE[asset.status]} />
        </div>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ff-text-muted)" }}>Source</h4>
          <DetailRow label="Repository" value={source.repository} />
          <DetailRow label="Path" value={source.path} />
          <DetailRow label="Immutable" value={source.immutable ? "Yes -- protected" : "No"} />
          {source.lineage && <p className="mt-1.5 text-[11px]" style={{ color: "var(--ff-text-muted)" }}>{source.lineage}</p>}
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ff-text-muted)" }}>Renderer / migration</h4>
          <DetailRow label="Original renderer" value={visualization.currentRenderer} />
          {visualization.pyvista && (
            <>
              <DetailRow
                label="PyVista path"
                value={visualization.pyvista.status === "verified" ? "Verified" : "Not migrated"}
              />
              {visualization.pyvista.status === "verified" && (
                <p className="mt-1 text-[11px]" style={{ color: "var(--ff-text-muted)" }}>
                  {visualization.pyvista.verifiedBy}
                </p>
              )}
            </>
          )}
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ff-text-muted)" }}>Verification</h4>
          <DetailRow label="Engineering recovery" value={verification.engineeringRecoveryStatus} />
          <DetailRow label="Runtime status" value={verification.runtimeStatus} />
          <DetailRow label="Live-twin correlation" value={verification.liveTwinCorrelation} />
        </section>

        {verification.knownLimitations.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ff-text-muted)" }}>Known limitations</h4>
            <ul className="space-y-1 list-disc list-inside text-[11px]" style={{ color: "var(--ff-text-muted)" }}>
              {verification.knownLimitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <button
            type="button"
            disabled
            title="Not available yet -- read-only browse phase, no load/compose actions built"
            className="w-full rounded-md px-3 py-2 text-xs font-medium cursor-not-allowed opacity-50"
            style={{ background: "var(--ff-content-bg)", color: "var(--ff-text-muted)" }}
          >
            {asset.immutable ? "Load (unavailable -- protected source)" : "Load (not yet implemented)"}
          </button>
        </section>
      </div>
    </PanelCard>
  );
}
