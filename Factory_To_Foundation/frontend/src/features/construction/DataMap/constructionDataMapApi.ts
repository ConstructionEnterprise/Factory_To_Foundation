import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

export type ConstructionTreeNodeRecord = {
  id: string;
  parentId: string | null;
  title: string;
  objectType: string;
  progress: string | null;
  trade: string | null;
  inspector: string | null;
  punchListCount: string | null;
};

export type ConstructionDispatchSummary = {
  id: string;
  status: string;
  route: string | null;
  eta: string | null;
  miles: number | null;
  dispatchedAt: string;
  truckIdentifier: string;
  driverName: string;
  vehicle: { id: string; identifier: string; vehicleClass: string } | null;
};

export type ConstructionProjectRelationships = {
  projectId: string;
  projectTitle: string;
  site: { address: string | null; coordsX: number | null; coordsZ: number | null } | null;
  treeNodes: ConstructionTreeNodeRecord[];
  fileCount: number;
  dispatches: ConstructionDispatchSummary[];
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

export async function fetchProjectRelationships(projectId: string): Promise<ConstructionProjectRelationships> {
  const res = await authFetch(`${BACKEND_URL}/construction-projects/${projectId}/relationships`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<ConstructionProjectRelationships>;
}
