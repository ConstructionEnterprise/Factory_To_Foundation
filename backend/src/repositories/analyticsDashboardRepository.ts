import type { AnalyticsDashboard, AnalyticsDashboardWidget, AnalyticsWidgetType } from "@prisma/client";

import { prisma } from "../lib/prisma";

export type DashboardWithWidgets = AnalyticsDashboard & { widgets: AnalyticsDashboardWidget[] };

const widgetsOrdered = { widgets: { orderBy: { position: "asc" as const } } };

export function findAll(): Promise<DashboardWithWidgets[]> {
  return prisma.analyticsDashboard.findMany({ include: widgetsOrdered, orderBy: { createdAt: "asc" } });
}

export function findById(id: string): Promise<DashboardWithWidgets | null> {
  return prisma.analyticsDashboard.findUnique({ where: { id }, include: widgetsOrdered });
}

export function create(title: string, createdById: string): Promise<AnalyticsDashboard> {
  return prisma.analyticsDashboard.create({ data: { title, createdById } });
}

export function updateTitle(id: string, title: string): Promise<AnalyticsDashboard> {
  return prisma.analyticsDashboard.update({ where: { id }, data: { title } });
}

export function remove(id: string): Promise<AnalyticsDashboard> {
  return prisma.analyticsDashboard.delete({ where: { id } });
}

export function countWidgets(dashboardId: string): Promise<number> {
  return prisma.analyticsDashboardWidget.count({ where: { dashboardId } });
}

export type CreateWidgetInput = {
  dashboardId: string;
  widgetType: AnalyticsWidgetType;
  metricKey: string | null;
  summaryWidgetKey: string | null;
  position: number;
};

export function createWidget(input: CreateWidgetInput): Promise<AnalyticsDashboardWidget> {
  return prisma.analyticsDashboardWidget.create({ data: input });
}

export function findWidgetById(id: string): Promise<AnalyticsDashboardWidget | null> {
  return prisma.analyticsDashboardWidget.findUnique({ where: { id } });
}

export function deleteWidget(id: string): Promise<AnalyticsDashboardWidget> {
  return prisma.analyticsDashboardWidget.delete({ where: { id } });
}

/** Real bulk reorder -- sets position = index for each real widget id, in one transaction so no intermediate state has duplicate/gapped positions. */
export function reorderWidgets(dashboardId: string, orderedWidgetIds: string[]): Promise<unknown> {
  return prisma.$transaction(
    orderedWidgetIds.map((id, position) =>
      prisma.analyticsDashboardWidget.update({ where: { id, dashboardId }, data: { position } })
    )
  );
}
