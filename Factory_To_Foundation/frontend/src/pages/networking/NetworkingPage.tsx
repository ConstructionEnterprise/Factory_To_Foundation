import { useEffect, useState } from "react";

import { KpiRow, SimplePage } from "@/framework/ui";
import { fetchNetworkTopology, type NetworkDevice, type NetworkVlan } from "@/features/networking/networkApi";
import NetworkTopologyTree from "@/features/networking/NetworkTopologyTree";
import NetworkVlanTable from "@/features/networking/NetworkVlanTable";
import NetworkApiRegistry from "@/features/networking/NetworkApiRegistry";

type NetworkingMode = "topology" | "api";

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
 * "API" is a real, peer mode added 2026-08-15 (Phase 1D of the Inventory/
 * Fleet/Analytics/Reports rollout plan) — external system integration
 * architecture (Revit/Navisworks/Bluebeam/ForemanAI/n8n), same simple
 * two-mode toggle pattern Logistics already uses for Operations/Logistics
 * Flow, not a nested route.
 */
export default function NetworkingPage() {
  const [mode, setMode] = useState<NetworkingMode>("topology");
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

  return (
    <SimplePage pageLabel="Networking" pageSubtitle="Factory IT/OT Network Infrastructure — Device Inventory & VLAN Topology">
      <div className="flex flex-col gap-6">
        <div className="flex overflow-hidden rounded-[0.2rem] border self-start" style={{ borderColor: "var(--ff-panel-border)" }}>
          <button
            type="button"
            onClick={() => setMode("topology")}
            className="px-3 py-2 text-sm font-medium"
            style={{
              background: mode === "topology" ? "var(--ff-accent)" : "transparent",
              color: mode === "topology" ? "white" : "var(--ff-text-primary)",
            }}
          >
            Topology
          </button>
          <button
            type="button"
            onClick={() => setMode("api")}
            className="px-3 py-2 text-sm font-medium"
            style={{
              background: mode === "api" ? "var(--ff-accent)" : "transparent",
              color: mode === "api" ? "white" : "var(--ff-text-primary)",
            }}
          >
            API
          </button>
        </div>

        {mode === "api" ? (
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
    </SimplePage>
  );
}
