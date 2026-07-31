import type { NetworkDevice, NetworkVlan } from "@prisma/client";

import * as repo from "../repositories/networkRepository";

export type NetworkVlanDto = {
  id: string;
  number: number;
  name: string;
  subnet: string;
};

export type NetworkDeviceDto = {
  id: string;
  name: string;
  role: string;
  model: string | null;
  ipAddress: string | null;
  vlanId: string | null;
  uplinkDeviceId: string | null;
};

function toVlanDto(row: NetworkVlan): NetworkVlanDto {
  return { id: row.id, number: row.number, name: row.name, subnet: row.subnet };
}

function toDeviceDto(row: NetworkDevice): NetworkDeviceDto {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    model: row.model,
    ipAddress: row.ipAddress,
    vlanId: row.vlanId,
    uplinkDeviceId: row.uplinkDeviceId,
  };
}

/**
 * Real Networking topology (device inventory + VLANs), seeded from the real
 * Cisco Packet Tracer diagram CE_Factory_Production_LAN — see
 * prisma/schema.prisma's own Networking section header for the full real
 * source/scope disclosure. Static, read-only visualization only, per the
 * brief's explicit scope: no live SNMP/telemetry, no switch monitoring, no
 * firewall management, no PLC communications.
 */
export async function getNetworkTopology(): Promise<{ vlans: NetworkVlanDto[]; devices: NetworkDeviceDto[] }> {
  const [vlans, devices] = await Promise.all([repo.findAllVlans(), repo.findAllDevices()]);
  return { vlans: vlans.map(toVlanDto), devices: devices.map(toDeviceDto) };
}
