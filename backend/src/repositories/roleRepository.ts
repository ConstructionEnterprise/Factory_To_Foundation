import { prisma } from "../lib/prisma";

/** Real, already-seeded RBAC reference data (backend/prisma/seed.ts) — read-only here, Networking's Roles & Permissions view is a real matrix visualization, not an editor (never asked for, and a naive editable UI risks corrupting the real seeded grant matrix). */
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
