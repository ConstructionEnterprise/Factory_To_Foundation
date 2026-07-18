import { PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import { dataProvenance, type DataProvenanceStatus } from "./dataProvenance";

const STATUS_LABEL: Record<DataProvenanceStatus, string> = {
  "real-live": "Real — Live",
  "real-static": "Real — Static",
  "real-structure-fixture-values": "Real Structure, Fixture Values",
  fixture: "Fixture",
};

const STATUS_TONE: Record<DataProvenanceStatus, StatusTone> = {
  "real-live": "positive",
  "real-static": "positive",
  "real-structure-fixture-values": "warning",
  fixture: "critical",
};

/**
 * Real data-provenance table — the honest replacement for the original
 * Administration spec's fabricated Users/Roles/Permissions/Security/Audit
 * Logs concept, which assumes a real auth/user system this app doesn't
 * have. This operationalizes what CLAUDE.md's §4 table and §6 gap list
 * already state in prose into real, live UI, sourced from one small
 * config file (dataProvenance.ts) instead of duplicated here.
 */
export default function DataProvenanceTable() {
  return (
    <PanelCard title="Data Provenance — All 8 Live Features">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "2px solid var(--ff-panel-border)" }}>
              <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                Feature
              </th>
              <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                Status
              </th>
              <th className="py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                What's real, what isn't
              </th>
            </tr>
          </thead>
          <tbody>
            {dataProvenance.map((row) => (
              <tr key={row.feature} style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
                <td className="py-3 pr-4 align-top font-semibold whitespace-nowrap" style={{ color: "var(--ff-text-primary)" }}>
                  {row.feature}
                </td>
                <td className="py-3 pr-4 align-top whitespace-nowrap">
                  <StatusBadge label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />
                </td>
                <td className="py-3 align-top">
                  <p style={{ color: "var(--ff-text-primary)" }}>{row.summary}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--ff-text-muted)" }}>
                    Source: <span className="font-mono">{row.source}</span>
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
}
