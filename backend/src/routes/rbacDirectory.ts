import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/rbacDirectoryService";

const setGrantSchema = z.object({
  roleId: z.string().min(1),
  moduleId: z.string().min(1),
  permissionId: z.string().min(1),
  granted: z.boolean(),
});

/**
 * Real RBAC directory for Permissions' Roles & Permissions view (A3,
 * renamed from Networking in the Permissions Migration) — GET is real-time
 * and read-gated; PATCH is the real edit capability added on explicit user
 * request (see rbacDirectoryService.ts's own doc comment), gated on
 * permissions:update, same as every other real write in this app.
 */
export async function rbacDirectoryRoutes(app: FastifyInstance) {
  app.get("/rbac-directory", { preHandler: [authenticate, requirePermission("permissions", "read")] }, async () => {
    return service.getRbacDirectory();
  });

  app.patch(
    "/rbac-directory/grants",
    { preHandler: [authenticate, requirePermission("permissions", "update")] },
    async (request, reply) => {
      const { roleId, moduleId, permissionId, granted } = setGrantSchema.parse(request.body);
      await service.setGrant(roleId, moduleId, permissionId, granted);
      reply.code(204).send();
    }
  );
}
