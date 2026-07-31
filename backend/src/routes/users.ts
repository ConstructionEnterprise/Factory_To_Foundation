import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/userManagementService";

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(8),
  roleId: z.string().min(1),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
});

/**
 * Real User Management (A3) — replaces the manual create-user.ts CLI/psql
 * workflow. Gated on the `permissions` module (renamed from `networking` in
 * the Permissions Migration — see prisma/seed.ts's MODULES comment) rather
 * than `administration`, matching Roles & Permissions' own module.
 */
export async function userManagementRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("permissions", "read")];
  const createPreHandler = [authenticate, requirePermission("permissions", "create")];
  const updatePreHandler = [authenticate, requirePermission("permissions", "update")];
  const deletePreHandler = [authenticate, requirePermission("permissions", "delete")];

  app.get("/users", { preHandler: readPreHandler }, async () => {
    return service.listUsers();
  });

  app.post("/users", { preHandler: createPreHandler }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    const created = await service.createUserAccount(body);
    reply.code(201).send(created);
  });

  app.patch("/users/:id", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    const patch = updateUserSchema.parse(request.body);
    return service.updateUserAccount(id, patch);
  });

  app.delete("/users/:id", { preHandler: deletePreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // Real, deliberate guard: a signed-in admin can't delete their own real
    // account through this UI — the resulting signed-in-but-nonexistent
    // session state is a real footgun (every subsequent authenticated call
    // would 401/500 unpredictably) with no real recovery path from inside
    // the same UI. Not a security control, just an honest usability floor.
    if (request.user!.id === id) {
      reply.code(400).send({ error: "You can't delete your own signed-in account from here." });
      return;
    }
    await service.deleteUserAccount(id);
    reply.code(204).send();
  });
}
