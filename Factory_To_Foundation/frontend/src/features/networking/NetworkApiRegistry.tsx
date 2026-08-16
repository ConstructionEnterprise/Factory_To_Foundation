import { PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

/**
 * Real integration registry, honest V1 (Phase 1D, 2026-08-15) — the
 * architecture Networking → API needed, not five fabricated working
 * integrations. Every provider below is genuinely "Not Configured" today
 * (confirmed: no Revit/Navisworks/Bluebeam/ForemanAI/n8n client, credential,
 * or endpoint exists anywhere in this backend) — shown as such rather than
 * invented "Connected" badges, same disclosure discipline as Assets'
 * lifecycle map or Logistics' Dock Utilization ("No dock model yet").
 * Real work (a working Bluebeam client, a real webhook endpoint, etc.)
 * upgrades a row's real status here; this file is the registry, not a
 * fake integration layer pretending to be one.
 */

export type ApiIntegrationStatus = "connected" | "available" | "planned" | "not_configured";

export type ApiIntegration = {
  provider: string;
  purpose: string;
  status: ApiIntegrationStatus;
};

export const API_INTEGRATIONS: ApiIntegration[] = [
  { provider: "Revit", purpose: "Geometry / model ingestion", status: "planned" },
  { provider: "Navisworks", purpose: "Coordination / model data", status: "planned" },
  { provider: "Bluebeam", purpose: "Document / markup workflows", status: "planned" },
  { provider: "ForemanAI", purpose: "Field / construction intelligence", status: "planned" },
  { provider: "n8n", purpose: "Automation / orchestration", status: "not_configured" },
];

const STATUS_LABEL: Record<ApiIntegrationStatus, string> = {
  connected: "Connected",
  available: "Available",
  planned: "Planned",
  not_configured: "Not Configured",
};

const STATUS_TONE: Record<ApiIntegrationStatus, StatusTone> = {
  connected: "positive",
  available: "positive",
  planned: "warning",
  not_configured: "neutral",
};

function ProviderRow({ integration }: { integration: ApiIntegration }) {
  return (
    <tr style={{ borderTop: "1px solid var(--ff-panel-border)" }}>
      <td className="py-2 pr-3 text-sm font-medium" style={{ color: "var(--ff-text-primary)" }}>
        {integration.provider}
      </td>
      <td className="py-2 pr-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        {integration.purpose}
      </td>
      <td className="py-2">
        <StatusBadge label={STATUS_LABEL[integration.status]} tone={STATUS_TONE[integration.status]} />
      </td>
    </tr>
  );
}

export default function NetworkApiRegistry() {
  const connectedCount = API_INTEGRATIONS.filter((i) => i.status === "connected").length;

  return (
    <div className="flex flex-col gap-6">
      <PanelCard title="Overview" toolbar={<StatusBadge label={`${connectedCount} / ${API_INTEGRATIONS.length} Connected`} tone="neutral" />}>
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Real integration registry — the architecture for external system connections, not a live
          integration layer yet. Every provider below is honestly disclosed as not-yet-connected;
          nothing here fabricates a working connection. Real Connections/Endpoints/Health data
          appears once a provider's real client/credential/endpoint is actually built.
        </p>
      </PanelCard>

      <PanelCard title="Providers">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--ff-text-muted)" }}>
              <th className="py-1 pr-3 font-medium">Provider</th>
              <th className="py-1 pr-3 font-medium">Purpose</th>
              <th className="py-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {API_INTEGRATIONS.map((integration) => (
              <ProviderRow key={integration.provider} integration={integration} />
            ))}
          </tbody>
        </table>
      </PanelCard>

      <PanelCard title="Connections">
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real connections exist yet — this real gap closes as each provider above moves from
          Planned/Not Configured to a real credential and a real established session.
        </p>
      </PanelCard>

      <PanelCard title="Endpoints">
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real inbound/outbound endpoints are registered yet for these providers — FF's own real
          API namespace (see frontend/CLAUDE.md §31.4) is where any real webhook or callback route
          for a connected provider would live once built.
        </p>
      </PanelCard>

      <PanelCard title="Health">
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real health checks run yet — nothing to poll until a provider has a real connection.
          Same honest-absence pattern as FF's own <span className="font-mono">/system/ready</span>{" "}
          composition elsewhere in this app.
        </p>
      </PanelCard>
    </div>
  );
}
