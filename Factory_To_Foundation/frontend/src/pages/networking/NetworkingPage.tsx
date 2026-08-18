import { useEffect, useState } from "react";

import { FeaturePage, KpiRow } from "@/framework/ui";
import { fetchNetworkTopology, type NetworkDevice, type NetworkVlan } from "@/features/networking/networkApi";
import NetworkTopologyTree from "@/features/networking/NetworkTopologyTree";
import NetworkVlanTable from "@/features/networking/NetworkVlanTable";
import NetworkApiRegistry from "@/features/networking/NetworkApiRegistry";

type NetworkingCapability = "topology" | "api";

/**
 * Networking — the real factory IT/OT network-infrastructure module,
 * genuinely distinct from Permissions (which used to hold this module's
 * "networking" id/name by mistake — see the Permissions Migration report).
 * Real device inventory + VLAN topology, sourced from the real Cisco Packet
 * Tracer diagram CE_Factory_Production_LAN (a screenshot, not a parseable
 * .pkt file — every device name/IP/VLAN/subnet below is real, read
 * directly from that diagram). Static, read-only visualization only, per
 * the brief's explicit scope: no live SNMP/telemetry polling, no switch
 * monitoring, no firewall management, no PLC communications — all
 * disclosed future work, not built here.
 *
 * "API" is a real, peer capability added 2026-08-15 (Phase 1D of the
 * Inventory/Fleet/Analytics/Reports rollout plan) — external system
 * integration architecture (Revit/Navisworks/Bluebeam/ForemanAI/n8n).
 * Real command-ribbon correction (Phase 10, 2026-08-18): Topology/API used
 * to be a hand-rolled inline button pair with no CommandRibbon at all --
 * both are genuine first-class capabilities that swap the whole workspace,
 * so this page now adopts FeaturePage/CommandRibbon like every other
 * multi-capability domain, with real onClick/active buttons instead of a
 * bespoke toggle.
 */
export default function NetworkingPage() {
  const [capability, setCapability] = useState<NetworkingCapability>("topology");
  const [vlans, setVlans] = useState<NetworkVlan[] | null>(null);
  const [devices, setDevices] = useState<NetworkDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNetworkTopology()
      .then((topology) => {
        setVlans(topology.vlans);
        setDevices(topology.devices);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real network topology"));
  }, []);

  const extraMenus = [
    { label: "Topology", onClick: () => setCapability("topology"), active: capability === "topology" },
    { label: "API", onClick: () => setCapability("api"), active: capability === "api" },
  ];

  return (
    <FeaturePage
      pageLabel="Networking"
      pageSubtitle="Factory IT/OT Network Infrastructure — Device Inventory & VLAN Topology"
      extraMenus={extraMenus}
      workspace={
        <div className="flex flex-col gap-6">
          {capability === "api" ? (
            <NetworkApiRegistry />
          ) : (
            <>
              {error && (
                <p className="text-sm" style={{ color: "var(--ff-status-critical)" }}>
                  {error}
                </p>
              )}

              {!devices || !vlans ? (
                !error && (
                  <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
                    Loading real network topology…
                  </p>
                )
              ) : (
                <>
                  <KpiRow
                    kpis={[
                      { title: "Real Devices", value: String(devices.length) },
                      { title: "Real VLANs", value: String(vlans.length) },
                      { title: "Core Switches", value: String(devices.filter((d) => d.role === "core_switch" || d.role === "distribution_switch" || d.role === "access_switch").length) },
                    ]}
                  />

                  <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                    Real, disclosed gap: the source diagram's own Packet Tracer topology-summary panel totals 31 devices by its
                    internal device-type categories; 29 could be directly confirmed by name/IP from the screenshot at the
                    resolution available and are seeded here. Static representation only — no live SNMP/telemetry, switch
                    monitoring, firewall management, or PLC communications (future work).
                  </p>

                  <NetworkTopologyTree devices={devices} />
                  <NetworkVlanTable vlans={vlans} devices={devices} />
                </>
              )}
            </>
          )}
        </div>
      }
    />
  );
}
