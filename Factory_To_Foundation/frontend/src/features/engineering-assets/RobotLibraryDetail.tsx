import { PanelCard } from "@/framework/ui";

import { robotLibraryCatalog } from "./robotLibraryCatalog";

type RobotLibraryDetailProps = {
  selectedId?: string;
};

/**
 * Center panel: the recovered engineering content itself -- geometry,
 * behavior, interfaces, relationships -- read from the Phase 1 recovery
 * records via the typed catalog, not re-derived here. No 3D viewport:
 * no committed preview asset or browser-loadable model exists for any
 * entry yet (see robotLibraryCatalog.ts's own header note), so this
 * panel is honest about showing engineering documentation, not a render.
 */
export default function RobotLibraryDetail({ selectedId }: RobotLibraryDetailProps) {
  const asset = robotLibraryCatalog.find((a) => a.id === selectedId);

  if (!asset) {
    return (
      <PanelCard title="Engineering Detail" className="h-full">
        <div className="p-6 text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Select an entry from the Robot Library to view its recovered engineering record.
        </div>
      </PanelCard>
    );
  }

  const { geometry, behavior, interfaces, relationships } = asset.engineering;

  return (
    <PanelCard title={asset.name} className="h-full">
      <div className="p-4 space-y-5 text-sm">
        {asset.immutable && (
          <div
            className="rounded-md px-3 py-2 text-xs font-medium"
            style={{ background: "#f3e0dd", color: "var(--ff-status-critical)" }}
          >
            Protected / immutable source. Read for cataloging only -- never modified, converted, or migrated.
          </div>
        )}

        {geometry && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ff-text-muted)" }}>
              Geometry
            </h4>
            <p style={{ color: "var(--ff-text-primary)" }}>{geometry.summary}</p>
            {geometry.keyConstants && (
              <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
                {Object.entries(geometry.keyConstants).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-mono" style={{ color: "var(--ff-text-muted)" }}>{k}</dt>
                    <dd style={{ color: "var(--ff-text-primary)" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}

        {behavior && (behavior.stateSequence || behavior.processFlow) && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ff-text-muted)" }}>
              Behavior
            </h4>
            {behavior.processFlow && <p style={{ color: "var(--ff-text-primary)" }}>{behavior.processFlow}</p>}
            {behavior.stateSequence && (
              <div className="mt-2 flex flex-wrap gap-1">
                {behavior.stateSequence.map((s, i) => (
                  <span
                    key={`${s}-${i}`}
                    className="rounded px-2 py-0.5 text-[11px] font-mono"
                    style={{ background: "var(--ff-content-bg)", color: "var(--ff-text-primary)" }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {interfaces && interfaces.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ff-text-muted)" }}>
              Interfaces
            </h4>
            <ul className="space-y-1.5">
              {interfaces.map((iface) => (
                <li key={iface.name} className="text-xs">
                  <span className="font-semibold">{iface.name}:</span>{" "}
                  <span style={{ color: "var(--ff-text-muted)" }}>{iface.description}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {relationships && relationships.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ff-text-muted)" }}>
              Relationships
            </h4>
            <ul className="space-y-1.5">
              {relationships.map((rel, i) => {
                const target = robotLibraryCatalog.find((a) => a.id === rel.relatedAssetId);
                return (
                  <li key={i} className="text-xs">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-mono mr-1.5" style={{ background: "var(--ff-accent-soft)", color: "var(--ff-accent)" }}>
                      {rel.kind}
                    </span>
                    <span className="font-semibold">{target?.name ?? rel.relatedAssetId}</span>
                    <span style={{ color: "var(--ff-text-muted)" }}> -- {rel.description}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <a
            className="text-xs underline"
            style={{ color: "var(--ff-accent)" }}
            href={`https://github.com/${asset.source.repository}/blob/main/${asset.engineering.recoveryDocPath}`}
            target="_blank"
            rel="noreferrer"
          >
            View full recovery record
          </a>
        </section>
      </div>
    </PanelCard>
  );
}
