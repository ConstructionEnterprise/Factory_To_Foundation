import { NotFoundError, ValidationError } from "../lib/httpErrors";
import * as repo from "../repositories/payrollAccountRepository";
import type { PayrollAccountWithUser } from "../repositories/payrollAccountRepository";
import * as userRepo from "../repositories/userRepository";

export type PayType = "HOURLY" | "SALARY";
export type PayFrequency = "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
export type PayrollAccountStatus = "ACTIVE" | "INACTIVE";

export type PayrollAccountDto = {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  roleName: string;
  payType: PayType;
  hourlyRate: number | null;
  annualSalary: number | null;
  payFrequency: PayFrequency;
  status: PayrollAccountStatus;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: PayrollAccountWithUser): PayrollAccountDto {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.user.email,
    userDisplayName: row.user.displayName,
    roleName: row.user.role.name,
    payType: row.payType,
    hourlyRate: row.hourlyRate,
    annualSalary: row.annualSalary,
    payFrequency: row.payFrequency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPayrollAccounts(): Promise<PayrollAccountDto[]> {
  const rows = await repo.findAll();
  return rows.map(toDto);
}

/** Real rate-vs-payType consistency — exactly one of hourlyRate/annualSalary set, matching whichever payType was chosen; never both, never neither. */
function assertRateMatchesPayType(payType: PayType, hourlyRate: number | null, annualSalary: number | null) {
  if (payType === "HOURLY") {
    if (hourlyRate === null || hourlyRate <= 0) throw new ValidationError("hourlyRate must be a real positive rate for an HOURLY payroll account.");
    if (annualSalary !== null) throw new ValidationError("annualSalary must not be set for an HOURLY payroll account.");
  } else {
    if (annualSalary === null || annualSalary <= 0) throw new ValidationError("annualSalary must be a real positive amount for a SALARY payroll account.");
    if (hourlyRate !== null) throw new ValidationError("hourlyRate must not be set for a SALARY payroll account.");
  }
}

export type CreatePayrollAccountInput = {
  userId: string;
  payType: PayType;
  hourlyRate: number | null;
  annualSalary: number | null;
  payFrequency: PayFrequency;
};

/**
 * Real Payroll Account creation — the account is built FROM an existing
 * real User profile (the same directory Permissions' User Management owns),
 * never a freestanding name typed here. One real account per user: a
 * second attempt for the same userId is a real 400, not a silent upsert.
 */
export async function createPayrollAccount(input: CreatePayrollAccountInput): Promise<PayrollAccountDto> {
  const user = await userRepo.findById(input.userId);
  if (!user) throw new NotFoundError(`No user with id "${input.userId}"`);

  const existing = await repo.findByUserId(input.userId);
  if (existing) throw new ValidationError(`${user.displayName} already has a real payroll account.`);

  assertRateMatchesPayType(input.payType, input.hourlyRate, input.annualSalary);

  const created = await repo.create(input);
  return toDto(created);
}

export type UpdatePayrollAccountInput = Partial<{
  payType: PayType;
  hourlyRate: number | null;
  annualSalary: number | null;
  payFrequency: PayFrequency;
  status: PayrollAccountStatus;
}>;

export async function updatePayrollAccount(id: string, patch: UpdatePayrollAccountInput): Promise<PayrollAccountDto> {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError(`No payroll account with id "${id}"`);

  if (patch.payType || "hourlyRate" in patch || "annualSalary" in patch) {
    const payType = patch.payType ?? existing.payType;
    const hourlyRate = "hourlyRate" in patch ? patch.hourlyRate ?? null : existing.hourlyRate;
    const annualSalary = "annualSalary" in patch ? patch.annualSalary ?? null : existing.annualSalary;
    assertRateMatchesPayType(payType, hourlyRate, annualSalary);
  }

  const updated = await repo.update(id, patch);
  return toDto(updated);
}
