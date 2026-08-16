import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/analyticsDashboardService";

const createDashboardBodySchema = z.object({
  title: z.string().trim().min(1),
});

const updateDashboardBodySchema = z.object({
  title: z.string().trim().min(1),
});

const addWidgetBodySchema = z.object({
  widgetType: z.enum(["metric_graph", "events_feed", "existing_summary"]),
  metricKey: z.string().optional(),
  summaryWidgetKey: z.string().optional(),
});

const reorderBodySchema = z.object({
  widgetIds: z.array(z.string().min(1)).min(1),
});

/**
 * Real Phase 3 Analytics dashboard/widget CRUD routes (docs/decisions/
 * 2026-08-16-analytics-observability-phase3-plan.md §4). Same RBAC
 * shape as analyticsMetrics.ts -- `analytics` module, CEO role already
 * has full C/U/D on it.
 */
export async function analyticsDashboardRoutes(app: FastifyInstance) {
  const read = [authenticate, requirePermission("analytics", "read")];
  const create = [authenticate, requirePermission("analytics", "create")];
  const update = [authenticate, requirePermission("analytics", "update")];
  const del = [authenticate, requirePermission("analytics", "delete")];

  app.get("/analytics/dashboards", { preHandler: read }, async () => service.listDashboards());

  app.post("/analytics/dashboards", { preHandler: create }, async (request, reply) => {
    const body = createDashboardBodySchema.parse(request.body);
    const dashboard = await service.createDashboard(body.title, request.user!.id);
    reply.code(201).send(dashboard);
  });

  app.patch("/analytics/dashboards/:id", { preHandler: update }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateDashboardBodySchema.parse(request.body);
    return service.updateDashboardTitle(id, body.title);
  });

  app.delete("/analytics/dashboards/:id", { preHandler: del }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteDashboard(id);
    reply.code(204).send();
  });

  app.post("/analytics/dashboards/:id/widgets", { preHandler: update }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addWidgetBodySchema.parse(request.body);
    const dashboard = await service.addWidget(id, body);
    reply.code(201).send(dashboard);
  });

  app.patch("/analytics/dashboards/:id/widgets/reorder", { preHandler: update }, async (request) => {
    const { id } = request.params as { id: string };
    const { widgetIds } = reorderBodySchema.parse(request.body);
    return service.reorderWidgets(id, widgetIds);
  });

  app.delete("/analytics/dashboards/:id/widgets/:widgetId", { preHandler: update }, async (request) => {
    const { id, widgetId } = request.params as { id: string; widgetId: string };
    return service.deleteWidget(id, widgetId);
  });
}
