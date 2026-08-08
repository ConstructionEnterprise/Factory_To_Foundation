/**
 * Interactive CLI for resetting a real Factory » Foundation user's
 * password. Mirrors create-user.ts's own masked-prompt pattern exactly —
 * password entry is masked (never echoed), via @inquirer/prompts' real
 * password prompt. Updates the existing user's password_hash in place;
 * never creates a new account. Run manually:
 *
 *   npm run reset-password -- <email>
 */
import "dotenv/config";
import { password as passwordPrompt } from "@inquirer/prompts";

import { prisma } from "../src/lib/prisma";
import { resetPassword } from "./resetPassword";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run reset-password -- <email>");
    process.exitCode = 1;
    return;
  }

  console.log(`Reset password for "${email}".\n`);

  const pw = await passwordPrompt({
    message: "New password:",
    mask: "*",
    validate: (value) => (value.length >= 8 ? true : "Password must be at least 8 characters"),
  });
  const confirm = await passwordPrompt({ message: "Confirm password:", mask: "*" });
  if (pw !== confirm) {
    console.error("\nPasswords did not match. Aborting — no change made.");
    process.exitCode = 1;
    return;
  }

  const user = await resetPassword({ email, password: pw });
  console.log(`\nPassword reset for "${user.email}" (id ${user.id}), role "${user.role.name}".`);
}

main()
  .catch((err) => {
    console.error("\nFailed to reset password:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
