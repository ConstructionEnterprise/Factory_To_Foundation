import { NotFoundError } from "../lib/httpErrors";
import * as repo from "../repositories/roleRepository";

export type RoleDto = { id: string; name: string };
export type ModuleDto = { id: string; name: string };
export type PermissionDto = { id: string; name: string };
export type RoleGrantDto = { roleId: string; moduleId: string; permissionId: string };

export type RbacDirectoryDto = {
  roles: RoleDto[];
  modules: ModuleDto[];
  permissions: PermissionDto[];
  grants: RoleGrantDto[];
};

/** Real RBAC directory (Permissions' Roles & Permissions view, A3, renamed from Networking) — everything needed to render a real role x module x action grant matrix client-side, from the actual seeded tables (backend/prisma/seed.ts), not a duplicated/hand-maintained copy. Read is always real-time (not cached), so a grant just toggled shows up on the very next fetch. */
export async function getRbacDirectory(): Promise<RbacDirectoryDto> {
  const [roles, modules, permissions, grants] = await Promise.all([
    repo.listRoles(),
    repo.listModules(),
    repo.listPermissions(),
    repo.listRolePermissions(),
  ]);
  return { roles, modules, permissions, grants };
}

async function assertRealGrantTarget(roleId: string, moduleId: string, permissionId: string): Promise<void> {
  const [roles, modules, permissions] = await Promise.all([repo.listRoles(), repo.listModules(), repo.listPermissions()]);
  if (!roles.some((r) => r.id === roleId)) throw new NotFoundError(`No role with id "${roleId}"`);
  if (!modules.some((m) => m.id === moduleId)) throw new NotFoundError(`No module with id "${moduleId}"`);
  if (!permissions.some((p) => p.id === permissionId)) throw new NotFoundError(`No permission with id "${permissionId}"`);
}

/**
 * Real, user-requested edit capability (previously deliberately read-only —
 * see roleRepository.ts's own doc comment on why, and the recovery path if
 * a role locks itself out of further edits). Real create/delete against
 * role_permission — the exact table every route's requirePermission check
 * reads, so a toggle here has real, immediate effect on what every other
 * role in the app can and can't do, not just a display change.
 */
export async function setGrant(roleId: string, moduleId: string, permissionId: string, granted: boolean): Promise<void> {
  await assertRealGrantTarget(roleId, moduleId, permissionId);
  if (granted) {
    await repo.grantPermission(roleId, moduleId, permissionId);
  } else {
    await repo.revokePermission(roleId, moduleId, permissionId);
  }
}
