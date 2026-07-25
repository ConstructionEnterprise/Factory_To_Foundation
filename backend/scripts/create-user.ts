/**
 * Interactive CLI for creating a real Factory » Foundation user account.
 * This is the ONLY intended way to create real accounts — never seed.ts,
 * which is checked into git and must never carry a real credential, even
 * hashed. Run manually:
 *
 *   npm run create-user
 *
 * Password entry is masked (never echoed), via @inquirer/prompts' real
 * password prompt — not raw process.stdin printed back.
 */
import "dotenv/config";
import { input, password as passwordPrompt, select } from "@inquirer/prompts";

import { prisma } from "../src/lib/prisma";
import { createUser } from "./createUser";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  console.log("Create a real Factory » Foundation user account.\n");

  const email = await input({
    message: "Email:",
    validate: (value) => (EMAIL_PATTERN.test(value) ? true : "Enter a real-looking email address"),
  });

  const displayName = await input({
    message: "Display name:",
    validate: (value) => (value.trim() ? true : "Display name can't be empty"),
  });

  const pw = await passwordPrompt({
    message: "Password:",
    mask: "*",
    validate: (value) => (value.length >= 8 ? true : "Password must be at least 8 characters"),
  });
  const confirm = await passwordPrompt({ message: "Confirm password:", mask: "*" });
  if (pw !== confirm) {
    console.error("\nPasswords did not match. Aborting — no account created.");
    process.exitCode = 1;
    return;
  }

  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
  if (roles.length === 0) {
    console.error("\nNo roles found in the database — run `prisma db seed` first.");
    process.exitCode = 1;
    return;
  }

  const roleId = await select({
    message: "Role:",
    choices: roles.map((r) => ({ name: r.name, value: r.id })),
  });

  const user = await createUser({ email, displayName, password: pw, roleId });
  console.log(`\nCreated real user "${user.email}" (id ${user.id}), role "${user.role.name}".`);
}

main()
  .catch((err) => {
    console.error("\nFailed to create user:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
