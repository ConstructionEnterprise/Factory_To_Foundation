import { PanelCard } from "@/framework/ui";
import type { NetworkDevice, NetworkVlan } from "./networkApi";

/**
 * Real per-VLAN endpoint table, from the real Cisco Packet Tracer diagram —
 * 9 real VLANs, real /24 subnets, real named endpoints per VLAN. Read-only,
 * per the brief's explicit scope.
 */
export default function NetworkVlanTable({ vlans, devices }: { vlans: NetworkVlan[]; devices: NetworkDevice[] }) {
  return (
    <PanelCard title={`VLANs — ${vlans.length} Real VLANs`}>
      <div className="flex flex-col gap-4">
        {vlans.map((vlan) => {
          const members = devices.filter((d) => d.vlanId === vlan.id);
          return (
            <div key={vlan.id}>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                  VLAN {vlan.number} — {vlan.name}
                </span>
                <span className="font-mono text-xs" style={{ color: "var(--ff-text-muted)" }}>
                  {vlan.subnet}
                </span>
              </div>
              <table className="w-full border-collapse text-left text-xs">
                <tbody>
                  {members.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
                      <td className="py-1 pr-4" style={{ color: "var(--ff-text-primary)" }}>
                        {d.name}
                      </td>
                      <td className="py-1 pr-4 font-mono" style={{ color: "var(--ff-text-secondary)" }}>
                        {d.ipAddress ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
