import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/** Real, read-only RBAC directory client (backend/src/routes/rbacDirectory.ts) — the actual seeded Module/Role/Permission/RolePermission tables, not a duplicated copy. */
const API_BASE = BACKEND_URL;

export type RbacRole = { id: string; name: string };
export type RbacModule = { id: string; name: string };
export type RbacPermission = { id: string; name: string };
export type RbacGrant = { roleId: string; moduleId: string; permissionId: string };

export type RbacDirectory = {
  roles: RbacRole[];
  modules: RbacModule[];
  permissions: RbacPermission[];
  grants: RbacGrant[];
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

export async function fetchRbacDirectory(): Promise<RbacDirectory> {
  const res = await authFetch(`${API_BASE}/rbac-directory`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json();
}
