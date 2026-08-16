import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

export type AnalyticsWidgetType = "metric_graph" | "events_feed" | "existing_summary";

export type AnalyticsDashboardWidget = {
  id: string;
  widgetType: AnalyticsWidgetType;
  metricKey: string | null;
  summaryWidgetKey: string | null;
  position: number;
};

export type AnalyticsDashboard = {
  id: string;
  title: string;
  isDefault: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  widgets: AnalyticsDashboardWidget[];
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

export function fetchDashboards(): Promise<AnalyticsDashboard[]> {
  return requestJson("/analytics/dashboards");
}

export function createDashboard(title: string): Promise<AnalyticsDashboard> {
  return requestJson("/analytics/dashboards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function renameDashboard(id: string, title: string): Promise<AnalyticsDashboard> {
  return requestJson(`/analytics/dashboards/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function deleteDashboard(id: string): Promise<void> {
  const res = await authFetch(`${BACKEND_URL}/analytics/dashboards/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await describeResponseError(res));
}

export type AddWidgetInput = {
  widgetType: AnalyticsWidgetType;
  metricKey?: string;
  summaryWidgetKey?: string;
};

export function addWidget(dashboardId: string, input: AddWidgetInput): Promise<AnalyticsDashboard> {
  return requestJson(`/analytics/dashboards/${dashboardId}/widgets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function reorderWidgets(dashboardId: string, widgetIds: string[]): Promise<AnalyticsDashboard> {
  return requestJson(`/analytics/dashboards/${dashboardId}/widgets/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetIds }),
  });
}

export function deleteWidget(dashboardId: string, widgetId: string): Promise<AnalyticsDashboard> {
  return requestJson(`/analytics/dashboards/${dashboardId}/widgets/${widgetId}`, { method: "DELETE" });
}
