import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate, requirePermission } from "../middleware/auth";
import * as service from "../services/payrollAccountService";

const payTypeSchema = z.enum(["HOURLY", "SALARY"]);
const payFrequencySchema = z.enum(["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY"]);
const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const createBodySchema = z.object({
  userId: z.string().min(1),
  payType: payTypeSchema,
  hourlyRate: z.number().positive().nullable(),
  annualSalary: z.number().positive().nullable(),
  payFrequency: payFrequencySchema,
});

const updateBodySchema = z.object({
  payType: payTypeSchema.optional(),
  hourlyRate: z.number().positive().nullable().optional(),
  annualSalary: z.number().positive().nullable().optional(),
  payFrequency: payFrequencySchema.optional(),
  status: statusSchema.optional(),
});

/**
 * Real Payroll Accounts (Administration rebuild, 2026-08-18) — gated on the
 * `administration` module, matching complianceDocuments.ts's own precedent
 * for this module. Accounts are always created against an existing real
 * userId (validated in the service layer against Permissions' own real User
 * directory) — there is no "create employee" path here, only "create a
 * payroll profile for an existing real profile."
 */
export async function payrollAccountRoutes(app: FastifyInstance) {
  const readPreHandler = [authenticate, requirePermission("administration", "read")];
  const createPreHandler = [authenticate, requirePermission("administration", "create")];
  const updatePreHandler = [authenticate, requirePermission("administration", "update")];

  app.get("/payroll-accounts", { preHandler: readPreHandler }, async () => service.listPayrollAccounts());

  app.post("/payroll-accounts", { preHandler: createPreHandler }, async (request, reply) => {
    const body = createBodySchema.parse(request.body);
    const created = await service.createPayrollAccount(body);
    reply.code(201).send(created);
  });

  app.patch("/payroll-accounts/:id", { preHandler: updatePreHandler }, async (request) => {
    const { id } = request.params as { id: string };
    const patch = updateBodySchema.parse(request.body);
    return service.updatePayrollAccount(id, patch);
  });
}
