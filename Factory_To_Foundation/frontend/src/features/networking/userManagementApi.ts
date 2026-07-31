import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/** Real User Management client (backend/src/routes/users.ts) — replaces the manual create-user.ts CLI/psql workflow (A3). */
const API_BASE = BACKEND_URL;

export type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  roleId: string;
  roleName: string;
  createdAt: string;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listUsers(): Promise<ManagedUser[]> {
  return requestJson("/users");
}

export type CreateUserInput = {
  email: string;
  displayName: string;
  password: string;
  roleId: string;
};

export function createUser(input: CreateUserInput): Promise<ManagedUser> {
  return requestJson("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type UpdateUserInput = {
  displayName?: string;
  roleId?: string;
};

export function updateUser(id: string, patch: UpdateUserInput): Promise<ManagedUser> {
  return requestJson(`/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function deleteUser(id: string): Promise<void> {
  return requestJson(`/users/${id}`, { method: "DELETE" });
}
