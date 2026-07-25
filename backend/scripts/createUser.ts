import argon2 from "argon2";

import { prisma } from "../src/lib/prisma";

export type CreateUserInput = {
  email: string;
  displayName: string;
  password: string;
  roleId: string;
};

/**
 * The real account-creation logic, kept separate from create-user.ts's
 * interactive prompts so it's callable (and testable) without a real TTY —
 * create-user.ts is a thin interactive wrapper around exactly this
 * function, not a second, parallel implementation.
 */
export async function createUser({ email, displayName, password, roleId }: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error(`A user with email "${email}" already exists (id ${existing.id}).`);

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error(`No role with id "${roleId}".`);

  const passwordHash = await argon2.hash(password);
  return prisma.user.create({
    data: { email, displayName, roleId, passwordHash },
    include: { role: true },
  });
}
