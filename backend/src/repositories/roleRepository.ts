import { prisma } from "../lib/prisma";

/**
 * Real, already-seeded RBAC reference data (backend/prisma/seed.ts).
 * Originally read-only by design (a naive editable UI risked corrupting
 * the real seeded grant matrix) — real edit mutations (grant/revoke) were
 * added below on explicit user request, gated on permissions:update (module
 * renamed from networking in the Permissions Migration) same
 * as everything else in this feature, and real, not fabricated: every
 * toggle is a genuine row create/delete against role_permission, the
 * exact table every route's own requirePermission check reads per
 * request. Recovery note if a role ever locks itself out of further
 * edits: `prisma db seed` re-creates any missing baseline grant (upsert,
 * never deletes an extra one) — a real, if imperfect, safety net.
 */
export function listRoles() {
  return prisma.role.findMany({ orderBy: { name: "asc" } });
}

export function listModules() {
  return prisma.module.findMany({ orderBy: { id: "asc" } });
}

export function listPermissions() {
  return prisma.permission.findMany({ orderBy: { id: "asc" } });
}

/** Every real (role, module, permission) grant — the frontend builds the matrix client-side from this plus the three lists above rather than the backend pre-shaping a grid. */
export function listRolePermissions() {
  return prisma.rolePermission.findMany({
    select: { roleId: true, moduleId: true, permissionId: true },
  });
}

/** Real grant — idempotent (the composite unique key means a duplicate grant is a real no-op, not an error). */
export function grantPermission(roleId: string, moduleId: string, permissionId: string) {
  return prisma.rolePermission.upsert({
    where: { roleId_moduleId_permissionId: { roleId, moduleId, permissionId } },
    update: {},
    create: { roleId, moduleId, permissionId },
  });
}

/** Real revoke — idempotent (revoking an already-absent grant is a real no-op). */
export function revokePermission(roleId: string, moduleId: string, permissionId: string) {
  return prisma.rolePermission.deleteMany({ where: { roleId, moduleId, permissionId } });
}
