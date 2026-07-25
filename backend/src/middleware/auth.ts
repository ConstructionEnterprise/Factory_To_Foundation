import type { FastifyReply, FastifyRequest } from "fastify";

import { AuthError, ForbiddenError } from "../lib/httpErrors";
import { verifyAccessToken } from "../lib/jwt";
import * as permissionRepo from "../repositories/permissionRepository";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by authenticate() — the real caller, resolved from a verified access token. Absent on routes with no authenticate preHandler. */
    user?: { id: string; roleId: string; roleName: string };
  }
}

export const ACCESS_TOKEN_COOKIE = "ff_access_token";
export const REFRESH_TOKEN_COOKIE = "ff_refresh_token";

/** Real preHandler: verifies the JWT in the access-token cookie and loads the real caller onto request.user. Throws AuthError (→401) on anything missing/invalid — never a silent pass-through. */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = request.cookies[ACCESS_TOKEN_COOKIE];
  if (!token) throw new AuthError("Not authenticated");
  try {
    const payload = await verifyAccessToken(token);
    request.user = { id: payload.sub, roleId: payload.roleId, roleName: payload.roleName };
  } catch {
    throw new AuthError("Invalid or expired access token");
  }
}

/**
 * Real RBAC check against role_permission — the exact grant this route
 * requires, expressed directly in the route registration (see
 * routes/constructionSites.ts) rather than hidden metadata. Must run AFTER
 * authenticate() in the same preHandler array, since it reads
 * request.user.
 */
export function requirePermission(moduleId: string, permissionId: string) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user) throw new AuthError("Not authenticated");
    const allowed = await permissionRepo.hasPermission(request.user.roleId, moduleId, permissionId);
    if (!allowed) {
      throw new ForbiddenError(`Role "${request.user.roleName}" lacks the "${moduleId}:${permissionId}" permission`);
    }
  };
}
