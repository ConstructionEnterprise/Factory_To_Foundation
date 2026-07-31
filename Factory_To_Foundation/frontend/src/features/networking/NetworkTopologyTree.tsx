import { useState } from "react";

import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";
import type { NetworkDevice } from "./networkApi";

const ROLE_LABEL: Record<string, string> = {
  firewall: "Firewall",
  core_switch: "Core L3 Switch",
  distribution_switch: "Distribution Switch",
  access_switch: "Access Switch",
  server: "Server",
  workstation: "Workstation",
  plc: "PLC",
  remote_io: "Remote I/O",
  robot_controller: "Robot Controller",
  hmi: "HMI",
  vision_system: "Vision System",
  quality_station: "QC Station",
  scanner: "Scanner",
  shipping_pc: "Shipping PC",
  access_point: "Access Point",
  tablet: "Tablet",
  laptop: "Laptop",
  camera: "IP Camera",
  door_controller: "Door Controller",
  card_reader: "Card Reader",
  supervisor_pc: "Supervisor PC",
  printer: "Printer",
};

function deviceTitle(device: NetworkDevice): string {
  const parts = [device.name];
  if (device.ipAddress) parts.push(device.ipAddress);
  else if (device.model) parts.push(device.model);
  return parts.join(" — ");
}

/** Builds the real topology tree from the flat device list via each device's real uplinkDeviceId — the diagram's topology is a real tree (no redundant/mesh links), so a parent-pointer walk is sufficient. */
function buildTree(devices: NetworkDevice[]): BrowseListItem[] {
  const byUplink = new Map<string | null, NetworkDevice[]>();
  for (const d of devices) {
    const key = d.uplinkDeviceId;
    if (!byUplink.has(key)) byUplink.set(key, []);
    byUplink.get(key)!.push(d);
  }

  function build(parentId: string | null): BrowseListItem[] {
    const children = byUplink.get(parentId) ?? [];
    return children.map((d) => {
      const kids = build(d.id);
      return {
        id: d.id,
        title: deviceTitle(d),
        ...(kids.length > 0 ? { children: kids } : {}),
      };
    });
  }

  return build(null);
}

/**
 * Real topology tree (device inventory), from the real Cisco Packet Tracer
 * diagram — Internet -> Edge Firewall -> Core L3 Switch (Factory
 * Server/Engineering Workstation attach here directly) -> Production
 * Distribution Switch -> 3 Access Switches -> VLAN endpoints. Read-only
 * visualization only, per the brief's explicit scope — no live status, no
 * click-through action, matching this build's "static representation" ask.
 */
export default function NetworkTopologyTree({ devices }: { devices: NetworkDevice[] }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const tree = buildTree(devices);
  const selected = devices.find((d) => d.id === selectedId) ?? null;

  return (
    <PanelCard title={`Network Topology — ${devices.length} Real Devices`}>
      <div className="flex gap-4">
        <div className="flex-1 overflow-x-auto">
          <BrowseList items={tree} activeId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="w-64 shrink-0 border-l pl-4" style={{ borderColor: "var(--ff-panel-border)" }}>
          {selected ? (
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                {selected.name}
              </span>
              <span style={{ color: "var(--ff-text-muted)" }}>{ROLE_LABEL[selected.role] ?? selected.role}</span>
              {selected.model && <span style={{ color: "var(--ff-text-secondary)" }}>Model: {selected.model}</span>}
              {selected.ipAddress && <span style={{ color: "var(--ff-text-secondary)" }}>IP: {selected.ipAddress}</span>}
              {!selected.model && !selected.ipAddress && (
                <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                  No model/IP shown in the source diagram for this device.
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
              Select a device to see its real details.
            </p>
          )}
        </div>
      </div>
    </PanelCard>
  );
}
