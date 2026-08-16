import type { ComponentType } from "react";

import {
  AssetsWidget,
  ConstructionWidget,
  CostEstimatingWidget,
  DigitalTwinLifecycleWidget,
  FactoryWidget,
  GenealogyWidget,
  ManufacturingWidget,
  ProductionOutputWidget,
  QualityControlWidget,
  ScheduleCriticalPathWidget,
  SchedulingWidget,
  WorkCellPerformanceWidget,
} from "@/features/analytics/AnalyticsDashboard";
import type { InstructionExecutionHistoryEntry } from "@/features/factory/instructionExecutionsApi";

import { EXISTING_SUMMARY_WIDGET_KEYS, type ExistingSummaryWidgetKey } from "./existingSummaryWidgetKeys";

/**
 * Real key -> component registry for the 12 pre-existing Phase 1 widgets
 * (docs/decisions/2026-08-16-analytics-observability-phase3-plan.md §3.1/
 * §5). Every real key the backend's fixed catalog can emit is required
 * here (the `satisfies` below fails to compile if one is missing), so a
 * dashboard row referencing a key with no real component is impossible.
 */
export const SELF_CONTAINED_WIDGETS: Record<Exclude<ExistingSummaryWidgetKey, "productionOutput" | "workCellPerformance">, ComponentType> = {
  factory: FactoryWidget,
  genealogy: GenealogyWidget,
  manufacturing: ManufacturingWidget,
  construction: ConstructionWidget,
  costEstimating: CostEstimatingWidget,
  scheduling: SchedulingWidget,
  assets: AssetsWidget,
  scheduleCriticalPath: ScheduleCriticalPathWidget,
  digitalTwinLifecycle: DigitalTwinLifecycleWidget,
  qualityControl: QualityControlWidget,
};

export type ExecutionHistoryProps = {
  rows: InstructionExecutionHistoryEntry[] | null;
  error: string | null;
};

/**
 * The 2 real widgets that share the single real InstructionExecution
 * fetch (Phase 1's own "fetch once, not twice" precedent) -- DashboardView
 * lifts that fetch once and passes it down, rather than each widget
 * re-fetching independently.
 */
export const EXECUTION_DEPENDENT_WIDGETS: Record<"productionOutput" | "workCellPerformance", ComponentType<ExecutionHistoryProps>> = {
  productionOutput: ProductionOutputWidget,
  workCellPerformance: WorkCellPerformanceWidget,
};

export { EXISTING_SUMMARY_WIDGET_KEYS };
export type { ExistingSummaryWidgetKey };
