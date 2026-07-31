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

/** Real, read-only RBAC directory (Networking's Roles & Permissions view, A3) — everything needed to render a real role x module x action grant matrix client-side, from the actual seeded tables (backend/prisma/seed.ts), not a duplicated/hand-maintained copy. */
export async function getRbacDirectory(): Promise<RbacDirectoryDto> {
  const [roles, modules, permissions, grants] = await Promise.all([
    repo.listRoles(),
    repo.listModules(),
    repo.listPermissions(),
    repo.listRolePermissions(),
  ]);
  return { roles, modules, permissions, grants };
}
