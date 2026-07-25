import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

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

export async function constructionSiteRoutes(app: FastifyInstance) {
  app.get("/construction-sites", async () => service.listSites());

  app.get("/construction-sites/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const site = await service.getSite(projectId);
    if (!site) {
      reply.code(404).send({ error: `No site set for project "${projectId}"` });
      return;
    }
    reply.send(site);
  });

  // Both verbs map to the same partial-merge handler — PATCH is the
  // semantically correct one (a partial update), PUT is exposed as an
  // alias since that's the verb constructionSiteStore.ts's two existing
  // setters (address-only, coords-only) most naturally map to from the
  // frontend's point of view.
  app.put("/construction-sites/:projectId", setSiteHandler);
  app.patch("/construction-sites/:projectId", setSiteHandler);

  app.delete("/construction-sites/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    await service.clearSite(projectId);
    reply.code(204).send();
  });
}
