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

/**
 * Real cross-page refresh signal (2026-08-18) — Create User moved to
 * Administration while the User list itself stays on Permissions, and
 * Administration's own Payroll Accounts picks a real user from this same
 * directory. Same plain-window-event mechanism already established by
 * scheduleTasksApi.ts's SCHEDULE_TASKS_CHANGED_EVENT (itself following
 * AuthContext's AUTH_CHANGED_EVENT) — any interested component listens
 * without importing this module's internals.
 */
export const USERS_CHANGED_EVENT = "ff:users-changed";

function broadcastUsersChanged(): void {
  window.dispatchEvent(new Event(USERS_CHANGED_EVENT));
}

export type CreateUserInput = {
  email: string;
  displayName: string;
  password: string;
  roleId: string;
};

export async function createUser(input: CreateUserInput): Promise<ManagedUser> {
  const created = await requestJson<ManagedUser>("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  broadcastUsersChanged();
  return created;
}

export type UpdateUserInput = {
  displayName?: string;
  roleId?: string;
};

export async function updateUser(id: string, patch: UpdateUserInput): Promise<ManagedUser> {
  const updated = await requestJson<ManagedUser>(`/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  broadcastUsersChanged();
  return updated;
}

export async function deleteUser(id: string): Promise<void> {
  await requestJson(`/users/${id}`, { method: "DELETE" });
  broadcastUsersChanged();
}
