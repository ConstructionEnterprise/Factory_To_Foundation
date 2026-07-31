import { prisma } from "../lib/prisma";

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, include: { role: true } });
}

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

/** Real User Management list (Networking, A3) — real rows, never passwordHash (selected out explicitly, not filtered after the fact). */
export function listUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, displayName: true, roleId: true, createdAt: true, role: { select: { name: true } } },
    orderBy: { email: "asc" },
  });
}

export type UpdateUserInput = {
  displayName?: string;
  roleId?: string;
};

export function updateUser(id: string, patch: UpdateUserInput) {
  return prisma.user.update({
    where: { id },
    data: patch,
    select: { id: true, email: true, displayName: true, roleId: true, createdAt: true, role: { select: { name: true } } },
  });
}

/** Real delete — never soft-delete, matching this table's own design (no deletedAt column exists on User). Real FK constraints on every table that references a user (RefreshToken cascades; ProjectFile/LogisticsDocument/InstructionExecution/etc. do not) mean deleting a user with any real history throws a genuine Postgres FK violation rather than silently orphaning or cascading away an audit trail — surfaced honestly by app.ts's existing Prisma-error handler, not specially caught here. */
export function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
