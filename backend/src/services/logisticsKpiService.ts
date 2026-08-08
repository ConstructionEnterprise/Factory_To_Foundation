import * as repo from "../repositories/logisticsKpiRepository";

export type LogisticsKpisDto = {
  modulesStaged: number;
  modulesInTransit: number;
  deliveriesThisMonth: number;
};

/**
 * Real Logistics KPI row (closes gap #4 from the Phase 8 Browse Logistics
 * build — the KPI row above Browse was left on its original fixture
 * numbers). Only "Modules Staged"/"Modules In Transit"/"Deliveries (MTD)"
 * are computed here; "Dock Utilization" stays a disclosed, honest
 * non-value on the frontend — no dock/capacity concept exists anywhere in
 * this schema (no LogisticsReceiving model either, per LogisticsBrowse.tsx's
 * own doc comment), and inventing one just to fill a percentage would be
 * fabrication, not a real KPI.
 */
export async function getLogisticsKpis(): Promise<LogisticsKpisDto> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [modulesStaged, modulesInTransit, deliveriesThisMonth] = await Promise.all([
    repo.countModulesStaged(),
    repo.countModulesInTransit(),
    repo.countDeliveriesSince(startOfMonth),
  ]);

  return { modulesStaged, modulesInTransit, deliveriesThisMonth };
}
