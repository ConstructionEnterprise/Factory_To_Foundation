import { prisma } from "../lib/prisma";

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, include: { role: true } });
}

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}
