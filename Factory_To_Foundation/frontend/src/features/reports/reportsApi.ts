import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";
import type { ModuleSequenceStatus } from "@/features/construction/Sequencing/moduleSequenceApi";

/**
 * Real End-to-End Unit Lifecycle report client
 * (backend/src/routes/productionRuns.ts's `GET /production-outputs/factory-flow`,
 * `factoryFlowService.getUnitLifecycleReport()`) — the same real Factory
 * Flow chain as `productionApi.ts`'s `fetchFactoryFlow()`, unscoped from
 * any one run.
 */
export type UnitLifecycleRow = {
  productionOutputId: string;
  serialNumber: string;
  qcStatus: "pending" | "passed" | "failed";
  logisticsModuleId: string | null;
  dispatchStatus: string | null;
  sequenceEntryId: string | null;
  sequenceStatus: ModuleSequenceStatus | null;
  sequenceBlocked: boolean;
  blockedByLabel: string | null;
  endToEndComplete: boolean;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

export async function fetchUnitLifecycleReport(): Promise<UnitLifecycleRow[]> {
  const res = await authFetch(`${BACKEND_URL}/production-outputs/factory-flow`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json();
}
