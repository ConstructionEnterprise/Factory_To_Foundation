import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/** Real GenealogyNode/GenealogyEdge shape from GET /genealogy-nodes, /genealogy-edges -- no x/y (position was never a real twin/registry attribute, it's a frontend layout decision, see genealogyLayout.ts). Tier values match the real Prisma enum (underscore, e.g. "framing_package"), translated to the frontend's own GraphTier at the layout boundary. */
export type GenealogyNodeRecord = {
  id: string;
  title: string;
  tier: string;
  qr: string | null;
};

export type GenealogyEdgeRecord = {
  id: string;
  fromId: string;
  toId: string;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string): Promise<T> {
  const res = await authFetch(`${BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<T>;
}

export function fetchGenealogyNodes(): Promise<GenealogyNodeRecord[]> {
  return requestJson("/genealogy-nodes");
}

export function fetchGenealogyEdges(): Promise<GenealogyEdgeRecord[]> {
  return requestJson("/genealogy-edges");
}
