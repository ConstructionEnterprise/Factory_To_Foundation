import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

export type ModuleSequenceStatus =
  | "pending"
  | "site_arrival"
  | "site_acceptance"
  | "installation"
  | "placement"
  | "complete";

export type ModuleSequenceEntry = {
  id: string;
  inventoryItemId: string;
  itemTitle: string;
  constructionProjectId: string;
  buildingTreeNodeId: string;
  buildingTitle: string;
  status: ModuleSequenceStatus;
  sequencePosition: number | null;
  sourceDispatchId: string | null;
  notes: string | null;
  blockedByCount: number;
  createdAt: string;
  updatedAt: string;
};

export type EligibleModule = {
  inventoryItemId: string;
  title: string;
  buildingTreeNodeId: string | null;
  buildingTitle: string | null;
};

/** Real transitive-blockage overlay (Phase 7) -- see moduleSequenceStatusService.ts. */
export type SequenceEffectiveState = "ready" | "blocked";

export type ModuleSequenceGraphEntry = ModuleSequenceEntry & {
  effectiveState: SequenceEffectiveState;
  blockedByChain: string[];
};

export type ModuleSequenceEvent = {
  id: string;
  sequenceEntryId: string;
  fromStatus: ModuleSequenceStatus | null;
  toStatus: ModuleSequenceStatus;
  changedById: string;
  changedAt: string;
  notes: string | null;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${BACKEND_URL}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json() as Promise<T>;
}

export function fetchModuleSequences(projectId: string): Promise<ModuleSequenceEntry[]> {
  return requestJson(`/construction-projects/${projectId}/module-sequences`);
}

export function fetchEligibleModules(projectId: string): Promise<EligibleModule[]> {
  return requestJson(`/construction-projects/${projectId}/eligible-sequence-modules`);
}

/** Real live-monitor payload (Phase 7) -- entries plus the pure transitive-blockage overlay. Construction's own Sequencing viewport uses this; Scheduling/Analytics' read-only projections keep using the plain fetchModuleSequences() above -- they don't need monitor semantics. */
export function fetchModuleSequenceGraph(projectId: string): Promise<{ entries: ModuleSequenceGraphEntry[] }> {
  return requestJson(`/construction-projects/${projectId}/module-sequences/graph`);
}

export function createModuleSequenceEntry(
  projectId: string,
  inventoryItemId: string
): Promise<ModuleSequenceEntry> {
  return requestJson(`/construction-projects/${projectId}/module-sequences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inventoryItemId }),
  });
}

export function transitionModuleSequenceStatus(
  entryId: string,
  toStatus: ModuleSequenceStatus,
  notes?: string
): Promise<ModuleSequenceEntry> {
  return requestJson(`/module-sequences/${entryId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toStatus, notes }),
  });
}

export function updateModuleSequencePosition(
  entryId: string,
  sequencePosition: number | null
): Promise<ModuleSequenceEntry> {
  return requestJson(`/module-sequences/${entryId}/position`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequencePosition }),
  });
}

export function fetchModuleSequenceEvents(entryId: string): Promise<ModuleSequenceEvent[]> {
  return requestJson(`/module-sequences/${entryId}/events`);
}

export async function addModuleSequenceDependency(
  blockedEntryId: string,
  blockingEntryId: string
): Promise<void> {
  const res = await authFetch(`${BACKEND_URL}/module-sequences/${blockedEntryId}/dependencies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockingEntryId }),
  });
  if (!res.ok) throw new Error(await describeResponseError(res));
}
