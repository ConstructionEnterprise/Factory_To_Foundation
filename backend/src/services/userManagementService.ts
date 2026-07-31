import { createUser } from "../../scripts/createUser";
import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/userRepository";
import * as roleRepo from "../repositories/roleRepository";

export type UserDto = {
  id: string;
  email: string;
  displayName: string;
  roleId: string;
  roleName: string;
  createdAt: string;
};

type ListRow = {
  id: string;
  email: string;
  displayName: string;
  roleId: string;
  createdAt: Date;
  role: { name: string };
};

function toDto(row: ListRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    roleId: row.roleId,
    roleName: row.role.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsers(): Promise<UserDto[]> {
  const rows = await repo.listUsers();
  return rows.map(toDto);
}

export type CreateUserInput = {
  email: string;
  displayName: string;
  password: string;
  roleId: string;
};

/**
 * Real User Management (A3) — replaces the manual create-user.ts CLI/psql
 * workflow the brief calls out directly. Reuses the exact same real,
 * already-tested createUser() core function backend/scripts/create-user.ts
 * itself calls (argon2 hash, real uniqueness/role checks) rather than a
 * second, parallel implementation — the CLI becomes one more caller of
 * this same function, not a competing path.
 */
export async function createUserAccount(input: CreateUserInput): Promise<UserDto> {
  const role = await roleRepo.listRoles().then((roles) => roles.find((r) => r.id === input.roleId));
  if (!role) throw new NotFoundError(`No role with id "${input.roleId}"`);

  // createUser() itself throws a plain Error for "email already exists" —
  // re-thrown as a real ValidationError (→400) here so a duplicate email
  // reads as a real client input problem, not a generic 500.
  const created = await createUser(input).catch((err) => {
    throw new ValidationError(err instanceof Error ? err.message : "Failed to create user");
  });
  return {
    id: created.id,
    email: created.email,
    displayName: created.displayName,
    roleId: created.roleId,
    roleName: created.role.name,
    createdAt: created.createdAt.toISOString(),
  };
}

export type UpdateUserInput = {
  displayName?: string;
  roleId?: string;
};

export async function updateUserAccount(id: string, patch: UpdateUserInput): Promise<UserDto> {
  if (patch.roleId) {
    const roles = await roleRepo.listRoles();
    if (!roles.some((r) => r.id === patch.roleId)) throw new NotFoundError(`No role with id "${patch.roleId}"`);
  }
  const updated = await repo.updateUser(id, patch);
  return toDto(updated);
}

export async function deleteUserAccount(id: string): Promise<void> {
  await repo.deleteUser(id);
}
