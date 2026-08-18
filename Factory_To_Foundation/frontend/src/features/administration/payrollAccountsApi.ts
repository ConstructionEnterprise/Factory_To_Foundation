import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/** Real Payroll Accounts client (backend/src/routes/payrollAccounts.ts). */
const API_BASE = BACKEND_URL;

export type PayType = "HOURLY" | "SALARY";
export type PayFrequency = "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
export type PayrollAccountStatus = "ACTIVE" | "INACTIVE";

export type PayrollAccount = {
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

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(await describeResponseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listPayrollAccounts(): Promise<PayrollAccount[]> {
  return requestJson("/payroll-accounts");
}

export type CreatePayrollAccountInput = {
  userId: string;
  payType: PayType;
  hourlyRate: number | null;
  annualSalary: number | null;
  payFrequency: PayFrequency;
};

export function createPayrollAccount(input: CreatePayrollAccountInput): Promise<PayrollAccount> {
  return requestJson("/payroll-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type UpdatePayrollAccountInput = Partial<{
  payType: PayType;
  hourlyRate: number | null;
  annualSalary: number | null;
  payFrequency: PayFrequency;
  status: PayrollAccountStatus;
}>;

export function updatePayrollAccount(id: string, patch: UpdatePayrollAccountInput): Promise<PayrollAccount> {
  return requestJson(`/payroll-accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
