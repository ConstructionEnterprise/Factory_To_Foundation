import type { Prisma, UserPreference } from "@prisma/client";

import { prisma } from "../lib/prisma";

/** One real row per user (userId is the PK) — find-or-null, never fabricated defaults stored server-side; the service layer fills in real UI defaults only in its response, never writes them back until the user actually changes something. */
export function findByUserId(userId: string): Promise<UserPreference | null> {
  return prisma.userPreference.findUnique({ where: { userId } });
}

export type PreferencePatch = {
  workspaceJson?: Prisma.InputJsonValue;
  appearanceJson?: Prisma.InputJsonValue;
  notificationsJson?: Prisma.InputJsonValue;
  accessibilityJson?: Prisma.InputJsonValue;
  preferencesJson?: Prisma.InputJsonValue;
};

/** Real upsert — only the sections present in `patch` are touched; a first-ever save creates the row with just those sections set, everything else genuinely null until the user visits that section too. */
export function upsertPatch(userId: string, patch: PreferencePatch): Promise<UserPreference> {
  return prisma.userPreference.upsert({
    where: { userId },
    update: patch,
    create: { userId, ...patch },
  });
}
