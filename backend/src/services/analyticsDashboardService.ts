import type { AnalyticsWidgetType } from "@prisma/client";

import { isRealMetricKey, isRealSummaryWidgetKey } from "../lib/analyticsCatalog";
import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/analyticsDashboardRepository";
import type { DashboardWithWidgets } from "../repositories/analyticsDashboardRepository";

export type AnalyticsDashboardWidgetDto = {
  id: string;
  widgetType: AnalyticsWidgetType;
  metricKey: string | null;
  summaryWidgetKey: string | null;
  position: number;
};

export type AnalyticsDashboardDto = {
  id: string;
  title: string;
  isDefault: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  widgets: AnalyticsDashboardWidgetDto[];
};

function toDto(row: DashboardWithWidgets): AnalyticsDashboardDto {
  return {
    id: row.id,
    title: row.title,
    isDefault: row.isDefault,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    widgets: row.widgets.map((w) => ({
      id: w.id,
      widgetType: w.widgetType,
      metricKey: w.metricKey,
      summaryWidgetKey: w.summaryWidgetKey,
      position: w.position,
    })),
  };
}

async function requireDashboard(id: string): Promise<DashboardWithWidgets> {
  const row = await repo.findById(id);
  if (!row) throw new NotFoundError(`No real dashboard with id "${id}".`);
  return row;
}

export async function listDashboards(): Promise<AnalyticsDashboardDto[]> {
  const rows = await repo.findAll();
  return rows.map(toDto);
}

export async function createDashboard(title: string, createdById: string): Promise<AnalyticsDashboardDto> {
  if (!title.trim()) throw new ValidationError("Dashboard title is required.");
  const row = await repo.create(title.trim(), createdById);
  return toDto({ ...row, widgets: [] });
}

export async function updateDashboardTitle(id: string, title: string): Promise<AnalyticsDashboardDto> {
  await requireDashboard(id);
  if (!title.trim()) throw new ValidationError("Dashboard title is required.");
  await repo.updateTitle(id, title.trim());
  return toDto(await requireDashboard(id));
}

/** Real guard: the default dashboard is the permanent fallback (plan doc §3.2) -- deleting it would leave nothing to show a fresh reader. */
export async function deleteDashboard(id: string): Promise<void> {
  const existing = await requireDashboard(id);
  if (existing.isDefault) throw new ValidationError("Cannot delete the real default dashboard.");
  await repo.remove(id);
}

export type CreateWidgetInput = {
  widgetType: AnalyticsWidgetType;
  metricKey?: string | null;
  summaryWidgetKey?: string | null;
};

/**
 * Real type-specific validation -- a metric_graph widget must reference a
 * real catalog metric, an existing_summary widget must reference one of
 * the 12 real Phase 1 widget keys, events_feed needs neither. Never
 * accepts a key that doesn't resolve to something real.
 */
export async function addWidget(dashboardId: string, input: CreateWidgetInput): Promise<AnalyticsDashboardDto> {
  await requireDashboard(dashboardId);

  if (input.widgetType === "metric_graph") {
    if (!input.metricKey || !isRealMetricKey(input.metricKey)) {
      throw new ValidationError(`A metric_graph widget requires a real metricKey from the fixed catalog.`);
    }
  } else if (input.widgetType === "existing_summary") {
    if (!input.summaryWidgetKey || !isRealSummaryWidgetKey(input.summaryWidgetKey)) {
      throw new ValidationError(`An existing_summary widget requires a real summaryWidgetKey.`);
    }
  } else if (input.widgetType === "events_feed") {
    if (input.metricKey || input.summaryWidgetKey) {
      throw new ValidationError("An events_feed widget takes no metricKey or summaryWidgetKey.");
    }
  }

  const position = await repo.countWidgets(dashboardId);
  await repo.createWidget({
    dashboardId,
    widgetType: input.widgetType,
    metricKey: input.widgetType === "metric_graph" ? input.metricKey! : null,
    summaryWidgetKey: input.widgetType === "existing_summary" ? input.summaryWidgetKey! : null,
    position,
  });

  return toDto(await requireDashboard(dashboardId));
}

export async function deleteWidget(dashboardId: string, widgetId: string): Promise<AnalyticsDashboardDto> {
  const dashboard = await requireDashboard(dashboardId);
  const widget = dashboard.widgets.find((w) => w.id === widgetId);
  if (!widget) throw new NotFoundError(`No real widget with id "${widgetId}" on dashboard "${dashboardId}".`);

  await repo.deleteWidget(widgetId);
  return toDto(await requireDashboard(dashboardId));
}

/** Real bulk reorder -- the given id list must be exactly the dashboard's real widget ids, no more, no fewer, never a partial/guessed order. */
export async function reorderWidgets(dashboardId: string, orderedWidgetIds: string[]): Promise<AnalyticsDashboardDto> {
  const dashboard = await requireDashboard(dashboardId);
  const realIds = new Set(dashboard.widgets.map((w) => w.id));

  if (orderedWidgetIds.length !== realIds.size || !orderedWidgetIds.every((id) => realIds.has(id))) {
    throw new ValidationError("widgetIds must be exactly this dashboard's real widget ids, each exactly once.");
  }

  await repo.reorderWidgets(dashboardId, orderedWidgetIds);
  return toDto(await requireDashboard(dashboardId));
}
