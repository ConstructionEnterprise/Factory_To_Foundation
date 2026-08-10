import argon2 from "argon2";

import { prisma } from "../src/lib/prisma";

export type ResetPasswordInput = {
  email: string;
  password: string;
};

/**
 * The real password-reset logic, kept separate from reset-password.ts's
 * interactive prompt — same split as createUser.ts/create-user.ts, so this
 * is callable (and testable) without a real TTY. Updates the existing
 * user's password_hash in place; never creates a new account (use
 * create-user.ts for that).
 */
export async function resetPassword({ email, password }: ResetPasswordInput) {
  const existing = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!existing) throw new Error(`No user with email "${email}".`);

  const passwordHash = await argon2.hash(password);
  return prisma.user.update({
    where: { email },
    data: { passwordHash },
    include: { role: true },
  });
}
