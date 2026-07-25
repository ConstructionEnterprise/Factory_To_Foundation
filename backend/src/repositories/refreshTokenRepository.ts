import { prisma } from "../lib/prisma";

export function create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
  return prisma.refreshToken.create({ data });
}

/** Includes the real user+role — /auth/refresh needs both to re-issue a real access token without a second round trip. */
export function findByHash(tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });
}

export function revoke(id: string) {
  return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
}
