import { prisma } from "../lib/prisma";

/** Real grants only — one row per real (moduleId, permissionId) pair this role_permission table actually has, grouped by module. */
export async function resolvePermissions(roleId: string): Promise<Record<string, string[]>> {
  const grants = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { moduleId: true, permissionId: true },
  });
  const byModule: Record<string, string[]> = {};
  for (const g of grants) {
    (byModule[g.moduleId] ??= []).push(g.permissionId);
  }
  return byModule;
}

export async function hasPermission(roleId: string, moduleId: string, permissionId: string): Promise<boolean> {
  const grant = await prisma.rolePermission.findUnique({
    where: { roleId_moduleId_permissionId: { roleId, moduleId, permissionId } },
  });
  return grant !== null;
}
