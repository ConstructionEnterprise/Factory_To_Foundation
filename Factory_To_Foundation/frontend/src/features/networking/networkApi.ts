import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real Networking client (backend/src/routes/network.ts) — the real
 * factory IT/OT device inventory + VLAN topology, seeded from the real
 * Cisco Packet Tracer diagram CE_Factory_Production_LAN. Genuinely distinct
 * from Permissions' rbacDirectoryApi.ts — this module used to share the
 * "networking" name with the RBAC subsystem by mistake; that subsystem was
 * renamed to Permissions so this id could mean networking for the first
 * time.
 */
const API_BASE = BACKEND_URL;

export type NetworkVlan = {
  id: string;
  number: number;
  name: string;
  subnet: string;
};

export type NetworkDevice = {
  id: string;
  name: string;
  role: string;
  model: string | null;
  ipAddress: string | null;
  vlanId: string | null;
  uplinkDeviceId: string | null;
};

export type NetworkTopology = {
  vlans: NetworkVlan[];
  devices: NetworkDevice[];
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

export async function fetchNetworkTopology(): Promise<NetworkTopology> {
  const res = await authFetch(`${API_BASE}/network-topology`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json();
}
