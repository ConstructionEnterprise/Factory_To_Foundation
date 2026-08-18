import type { PayrollAccount, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";

const withUser = {
  include: {
    user: { select: { id: true, email: true, displayName: true, roleId: true, role: { select: { name: true } } } },
  },
} satisfies Prisma.PayrollAccountDefaultArgs;

export type PayrollAccountWithUser = Prisma.PayrollAccountGetPayload<typeof withUser>;

export function findAll(): Promise<PayrollAccountWithUser[]> {
  return prisma.payrollAccount.findMany({ ...withUser, orderBy: { createdAt: "asc" } });
}

export function findById(id: string): Promise<PayrollAccountWithUser | null> {
  return prisma.payrollAccount.findUnique({ where: { id }, ...withUser });
}

export function findByUserId(userId: string): Promise<PayrollAccount | null> {
  return prisma.payrollAccount.findUnique({ where: { userId } });
}

export type CreatePayrollAccountData = {
  userId: string;
  payType: "HOURLY" | "SALARY";
  hourlyRate: number | null;
  annualSalary: number | null;
  payFrequency: "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
};

export function create(data: CreatePayrollAccountData): Promise<PayrollAccountWithUser> {
  return prisma.payrollAccount.create({ data, ...withUser });
}

export type UpdatePayrollAccountData = Partial<{
  payType: "HOURLY" | "SALARY";
  hourlyRate: number | null;
  annualSalary: number | null;
  payFrequency: "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
  status: "ACTIVE" | "INACTIVE";
}>;

export function update(id: string, data: UpdatePayrollAccountData): Promise<PayrollAccountWithUser> {
  return prisma.payrollAccount.update({ where: { id }, data, ...withUser });
}
