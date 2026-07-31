import type { FastifyInstance } from "fastify";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/rbacDirectoryService";

/** Real, read-only RBAC directory for Networking's Roles & Permissions view (A3). */
export async function rbacDirectoryRoutes(app: FastifyInstance) {
  app.get("/rbac-directory", { preHandler: [authenticate, requirePermission("networking", "read")] }, async () => {
    return service.getRbacDirectory();
  });
}
