import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/constructionSiteService";

const sitePatchSchema = z.object({
  address: z.string().optional(),
  coords: z.object({ x: z.number(), z: z.number() }).optional(),
});

async function setSiteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { projectId } = request.params as { projectId: string };
  const patch = sitePatchSchema.parse(request.body);
  const site = await service.setSite(projectId, patch);
  reply.send(site);
}

// Real RBAC grant required per route (Phase 3b, first real consumer of
// requirePermission()) — read for both GETs, update for the site-setting
// PUT/PATCH, delete for DELETE. Matches the seeded role_permission matrix's
// own module:action vocabulary exactly (Phase 2's seed.ts).
export async function constructionSiteRoutes(app: FastifyInstance) {
  app.get(
    "/construction-sites",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async () => service.listSites()
  );

  app.get(
    "/construction-sites/:projectId",
    { preHandler: [authenticate, requirePermission("construction", "read")] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const site = await service.getSite(projectId);
      if (!site) {
        reply.code(404).send({ error: `No site set for project "${projectId}"` });
        return;
      }
      reply.send(site);
    }
  );

  // Both verbs map to the same partial-merge handler — PATCH is the
  // semantically correct one (a partial update), PUT is exposed as an
  // alias since that's the verb constructionSiteStore.ts's two existing
  // setters (address-only, coords-only) most naturally map to from the
  // frontend's point of view.
  const updatePreHandler = [authenticate, requirePermission("construction", "update")];
  app.put("/construction-sites/:projectId", { preHandler: updatePreHandler }, setSiteHandler);
  app.patch("/construction-sites/:projectId", { preHandler: updatePreHandler }, setSiteHandler);

  app.delete(
    "/construction-sites/:projectId",
    { preHandler: [authenticate, requirePermission("construction", "delete")] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      await service.clearSite(projectId);
      reply.code(204).send();
    }
  );
}
