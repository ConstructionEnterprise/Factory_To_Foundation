import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as metricsService from "../services/analyticsMetricsService";
import * as thresholdService from "../services/analyticsThresholdService";

const seriesQuerySchema = z.object({
  rangeStart: z.string(),
  rangeEnd: z.string(),
  bucketMinutes: z.coerce.number().positive(),
});

const currentQuerySchema = z.object({
  windowMinutes: z.coerce.number().positive().optional(),
});

const setThresholdBodySchema = z.object({
  comparator: z.enum(["greater_than", "less_than"]),
  value: z.number(),
  windowMinutes: z.number().int().positive().default(60),
});

/**
 * Real Phase 3 Analytics metrics + thresholds routes (docs/decisions/
 * 2026-08-16-analytics-observability-phase3-plan.md §4). Gated on the
 * `analytics` module -- the CEO role already holds create/update/delete
 * on it (§2.4, confirmed live in Phase 3.1), no seed change needed.
 */
export async function analyticsMetricsRoutes(app: FastifyInstance) {
  const read = [authenticate, requirePermission("analytics", "read")];
  const update = [authenticate, requirePermission("analytics", "update")];
  const del = [authenticate, requirePermission("analytics", "delete")];

  app.get("/analytics/metrics", { preHandler: read }, async () => metricsService.getMetricCatalog());

  app.get("/analytics/metrics/:key/series", { preHandler: read }, async (request) => {
    const { key } = request.params as { key: string };
    const { rangeStart, rangeEnd, bucketMinutes } = seriesQuerySchema.parse(request.query);
    return metricsService.computeMetricSeries(key, rangeStart, rangeEnd, bucketMinutes);
  });

  app.get("/analytics/metrics/:key/current", { preHandler: read }, async (request) => {
    const { key } = request.params as { key: string };
    const { windowMinutes } = currentQuerySchema.parse(request.query);
    return metricsService.getMetricCurrentValue(key, windowMinutes);
  });

  app.get("/analytics/thresholds", { preHandler: read }, async () => thresholdService.listThresholds());

  app.put("/analytics/thresholds/:metricKey", { preHandler: update }, async (request) => {
    const { metricKey } = request.params as { metricKey: string };
    const body = setThresholdBodySchema.parse(request.body);
    return thresholdService.setThreshold(metricKey, body.comparator, body.value, body.windowMinutes, request.user!.id);
  });

  app.delete("/analytics/thresholds/:metricKey", { preHandler: del }, async (request, reply) => {
    const { metricKey } = request.params as { metricKey: string };
    await thresholdService.clearThreshold(metricKey);
    reply.code(204).send();
  });
}
