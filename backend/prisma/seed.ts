// Seeds the 11 real modules, 6 real permission actions, and 10 real roles
// as actual rows (not enum values), then seeds role_permission from the
// CONFIRMED RBAC matrix — Phase 1's draft matrix, with the two explicit
// revisions from this phase's brief applied on top:
//   - CEO: full permissions (read/create/update/delete/execute/administer)
//     on every module — was read-only in the original Phase 1 draft.
//   - Robotics Engineer: full operational permissions (including execute)
//     on Robotics specifically — was read/create/update only in the
//     original draft. See the ROBOTICS_ENGINEER_ADMINISTER note below for
//     one real ambiguity in this revision that was resolved by inference,
//     not invented outright.
// Every other role is seeded exactly per the original Phase 1 draft,
// unchanged.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MODULES = [
  { id: "manufacturing", name: "Manufacturing" },
  { id: "factory", name: "Factory" },
  { id: "robotics", name: "Robotics" },
  { id: "logistics", name: "Logistics" },
  { id: "construction", name: "Construction" },
  { id: "genealogy", name: "Genealogy" },
  { id: "scheduling", name: "Scheduling" },
  { id: "assets", name: "Assets" },
  { id: "analytics", name: "Analytics" },
  { id: "reports", name: "Reports" },
  { id: "administration", name: "Administration" },
] as const;

type ModuleId = (typeof MODULES)[number]["id"];

const PERMISSIONS = [
  { id: "read", name: "Read" },
  { id: "create", name: "Create" },
  { id: "update", name: "Update" },
  { id: "delete", name: "Delete" },
  { id: "execute", name: "Execute" },
  { id: "administer", name: "Administer" },
] as const;

type PermissionId = (typeof PERMISSIONS)[number]["id"];

// Shorthand action sets, named for what they mean, not just their letters —
// keeps the matrix below legible against Phase 1's own R/C/U/D/E/A notation.
const NONE: PermissionId[] = [];
const R: PermissionId[] = ["read"];
const RU: PermissionId[] = ["read", "update"];
const RUE: PermissionId[] = ["read", "update", "execute"];
const RCUD: PermissionId[] = ["read", "create", "update", "delete"];
const RCUDE: PermissionId[] = ["read", "create", "update", "delete", "execute"];
const FULL: PermissionId[] = ["read", "create", "update", "delete", "execute", "administer"];

const ALL_MODULE_IDS = MODULES.map((m) => m.id);

/** Every module gets the same action set — used for CEO (revised: full everywhere) and as a base for roles that are uniformly read-only. */
function uniform(action: PermissionId[]): Record<ModuleId, PermissionId[]> {
  return Object.fromEntries(ALL_MODULE_IDS.map((id) => [id, action])) as Record<ModuleId, PermissionId[]>;
}

const ROLES: { name: string; permissions: Record<ModuleId, PermissionId[]> }[] = [
  {
    // REVISED per this phase's brief: full permissions on every module,
    // not read-only (the original Phase 1 draft's CEO row).
    name: "CEO",
    permissions: uniform(FULL),
  },
  {
    // Unchanged from the original draft: full on Administration only, read
    // elsewhere.
    name: "Administrator",
    permissions: { ...uniform(R), administration: FULL },
  },
  {
    name: "Manufacturing Engineer",
    permissions: {
      manufacturing: RCUD,
      factory: R,
      robotics: NONE,
      logistics: NONE,
      construction: R,
      genealogy: R,
      scheduling: R,
      assets: NONE,
      analytics: R,
      reports: R,
      administration: NONE,
    },
  },
  {
    name: "Robotics Engineer",
    permissions: {
      manufacturing: R,
      factory: R,
      // REVISED per this phase's brief: "full permissions (including
      // execute)" — was RCU in the original draft. Interpreted as
      // read/create/update/delete/execute, deliberately WITHOUT administer:
      // the brief spells CEO's revision out explicitly as all 6 actions
      // including administer, but only says "full ... including execute"
      // for Robotics Engineer without naming administer, and the same
      // brief's very next sentence states "nobody but Administrator gets
      // Administer" for the surrounding role list. Genuinely ambiguous
      // whether that rule was meant to include Robotics Engineer — resolved
      // in favor of NOT granting administer here, since conflating
      // "operates the module" with "manages other users' access to it" is
      // the one thing real RBAC design usually keeps separate on purpose.
      // Flagged in the Phase 2 report for confirmation, not silently
      // decided.
      robotics: RCUDE,
      logistics: NONE,
      construction: NONE,
      genealogy: NONE,
      scheduling: NONE,
      assets: R,
      analytics: R,
      reports: R,
      administration: NONE,
    },
  },
  {
    name: "Factory Manager",
    permissions: {
      manufacturing: R,
      factory: RUE,
      robotics: R,
      logistics: R,
      construction: R,
      genealogy: NONE,
      scheduling: RU,
      assets: R,
      analytics: R,
      reports: R,
      administration: NONE,
    },
  },
  {
    name: "Dispatcher",
    permissions: {
      manufacturing: NONE,
      factory: R,
      robotics: NONE,
      logistics: RCUDE,
      construction: R,
      genealogy: NONE,
      scheduling: R,
      assets: R,
      analytics: NONE,
      reports: R,
      administration: NONE,
    },
  },
  {
    name: "Superintendent",
    permissions: {
      manufacturing: R,
      factory: NONE,
      robotics: NONE,
      logistics: R,
      construction: RCUD,
      genealogy: R,
      scheduling: R,
      assets: R,
      analytics: NONE,
      reports: R,
      administration: NONE,
    },
  },
  {
    name: "Architect",
    permissions: {
      manufacturing: R,
      factory: NONE,
      // Deliberately none — matches Phase 1's explicit finding that
      // nothing in the app gives an architect a real reason to see robot
      // telemetry.
      robotics: NONE,
      logistics: NONE,
      construction: R,
      genealogy: R,
      scheduling: NONE,
      assets: NONE,
      analytics: NONE,
      reports: R,
      administration: NONE,
    },
  },
  {
    name: "Project Manager",
    permissions: {
      manufacturing: R,
      factory: R,
      robotics: NONE,
      logistics: R,
      construction: R,
      genealogy: R,
      scheduling: RU,
      assets: R,
      analytics: R,
      reports: R,
      administration: NONE,
    },
  },
  {
    name: "Investor",
    permissions: {
      // Real note: "Construction/Manufacturing-progress" scoping from the
      // original brief (read-only, progress fields specifically) is a
      // row/field-level filter, not something a module-grain
      // role_permission row can express — seeded as plain module-level
      // read here; the progress-only narrowing is real work for the API
      // layer in a later phase, not silently dropped.
      manufacturing: R,
      factory: R,
      robotics: NONE,
      logistics: R,
      construction: R,
      genealogy: NONE,
      scheduling: NONE,
      assets: NONE,
      analytics: R,
      reports: R,
      administration: NONE,
    },
  },
];

async function main() {
  for (const m of MODULES) {
    await prisma.module.upsert({ where: { id: m.id }, update: { name: m.name }, create: m });
  }
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { id: p.id }, update: { name: p.name }, create: p });
  }

  for (const roleSpec of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleSpec.name },
      update: {},
      create: { name: roleSpec.name },
    });

    for (const moduleId of ALL_MODULE_IDS) {
      const actions = roleSpec.permissions[moduleId];
      for (const permissionId of actions) {
        await prisma.rolePermission.upsert({
          where: { roleId_moduleId_permissionId: { roleId: role.id, moduleId, permissionId } },
          update: {},
          create: { roleId: role.id, moduleId, permissionId },
        });
      }
    }
  }

  const roleCount = await prisma.role.count();
  const moduleCount = await prisma.module.count();
  const permissionCount = await prisma.permission.count();
  const rolePermissionCount = await prisma.rolePermission.count();

  console.log(`Seeded: ${moduleCount} modules, ${permissionCount} permissions, ${roleCount} roles, ${rolePermissionCount} role_permission rows.`);

  const ceoGrants = await prisma.rolePermission.count({ where: { role: { name: "CEO" } } });
  console.log(`CEO grants: ${ceoGrants} (expected ${MODULES.length * FULL.length} = ${MODULES.length} modules × ${FULL.length} actions).`);

  const roboticsEngineerRoboticsGrants = await prisma.rolePermission.findMany({
    where: { role: { name: "Robotics Engineer" }, moduleId: "robotics" },
    select: { permissionId: true },
  });
  console.log(
    `Robotics Engineer on Robotics: ${roboticsEngineerRoboticsGrants.map((g) => g.permissionId).join(", ")} (expected read, create, update, delete, execute — no administer, per the flagged interpretation above).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
