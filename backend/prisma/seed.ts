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

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Same conditional-SSL reasoning as src/lib/prisma.ts: RDS enforces SSL,
// local Docker Postgres doesn't support it at all.
const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ...(isLocalDb ? {} : { ssl: { rejectUnauthorized: false } }),
});
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

// ───────────────────── Genealogy ─────────────────────
// Real thread from Factory_To_Foundation/frontend/src/features/genealogy/
// graphData.ts (graphNodes/graphEdges) — the Cedarwood Flats exterior wall
// panel DAG, verbatim. Tier values match GenealogyTier 1:1 except
// "framing-package" (frontend, hyphen) -> "framing_package" (Prisma enum,
// underscore) — same 7 values, just the enum's naming convention. QR
// strings are the frontend's own makeMaterialQr()/makeObjectQr() output for
// project "CWF" / building "BLD1"; module/building/project-tier nodes have
// no qr because no real thread has built one yet at those tiers.
type GenealogyTier = "material" | "framing_package" | "component" | "subassembly" | "module" | "building" | "project";

const GENEALOGY_NODES: { id: string; title: string; tier: GenealogyTier; qr: string | null }[] = [
  { id: "lgs-0041", title: "LGS Stud (roll-formed)", tier: "material", qr: "CWF-STOCK-LGS0041-0001" },
  { id: "lgs-0050", title: "LGS Track (roll-formed)", tier: "material", qr: "CWF-STOCK-LGS0050-0001" },
  { id: "scr-0010", title: "Self-Tapping Framing Screws", tier: "material", qr: "CWF-STOCK-SCR0010-0001" },
  { id: "sh-0144", title: "Sheathing 7/16in OSB", tier: "material", qr: "CWF-STOCK-SH0144-0001" },
  { id: "fn-0022", title: "Structural Fasteners", tier: "material", qr: "CWF-STOCK-FN0022-0001" },
  { id: "mri-0001", title: "MEP Rough-In Assembly", tier: "material", qr: "CWF-STOCK-MRI0001-0001" },
  { id: "win-0012", title: "Window Package", tier: "material", qr: "CWF-STOCK-WIN0012-0001" },
  { id: "fpw-03-112", title: "Wall Framing Package", tier: "framing_package", qr: "CWF-BLD1-FPW03112-0001" },
  { id: "ewf-03-112", title: "Exterior Wall Frame", tier: "component", qr: "CWF-BLD1-EWF03112-0001" },
  { id: "ewp-03-s", title: "Exterior Wall Panel", tier: "subassembly", qr: "CWF-BLD1-EWP03S-0001" },
  { id: "module-089", title: "Module M24-089", tier: "module", qr: null },
  { id: "building-b", title: "Building B", tier: "building", qr: null },
  { id: "project", title: "Cedarwood Flats", tier: "project", qr: null },
];

// Materials attach at the tier that actually consumes them (LGS-0041/
// LGS-0050 feed the Framing-Package, SCR-0010 feeds the Component, the
// remaining four feed the Sub-Assembly) — a real structural fact, not an
// arbitrary layout. "ewp-03-s" (Exterior Wall Panel) is the real
// multi-parent DAG node: 5 incoming edges (4 material parents + its
// Component parent) — must NOT collapse to one parent.
const GENEALOGY_EDGES: { from: string; to: string }[] = [
  { from: "lgs-0041", to: "fpw-03-112" },
  { from: "lgs-0050", to: "fpw-03-112" },
  { from: "fpw-03-112", to: "ewf-03-112" },
  { from: "scr-0010", to: "ewf-03-112" },
  { from: "ewf-03-112", to: "ewp-03-s" },
  { from: "sh-0144", to: "ewp-03-s" },
  { from: "fn-0022", to: "ewp-03-s" },
  { from: "mri-0001", to: "ewp-03-s" },
  { from: "win-0012", to: "ewp-03-s" },
  { from: "ewp-03-s", to: "module-089" },
  { from: "module-089", to: "building-b" },
  { from: "building-b", to: "project" },
];

// ───────────────────── Construction ─────────────────────
// Real project ids/titles from constructionData.ts's constructionProjects,
// real location citations from constructionLocations.ts's
// PROJECT_FIXTURE_LOCATIONS — only Garden Lofts has one; the other 3 are
// honestly null, per the source's own "No location source exists in the
// real data" comment.
const CONSTRUCTION_PROJECTS: { id: string; title: string; realLocationSource: string | null }[] = [
  { id: "stonepine", title: "Stonepine Residences", realLocationSource: null },
  { id: "cedarwood", title: "Cedarwood Flats", realLocationSource: null },
  {
    id: "garden-lofts",
    title: "Garden Lofts",
    realLocationSource: 'garden_lofts_params_v2.json: PROJECT.LOCATION = "Lewisville, Texas" (Denton County)',
  },
  { id: "skyline", title: "Skyline Towers", realLocationSource: null },
];

// Deliberately NO ConstructionSite rows seeded. There is no static fixture
// with real address/coordinates for any of the 4 projects — the only real
// fixed coordinate in the codebase is the factory hub (constructionLocations.ts's
// FACTORY_NODE/FACTORY_COORDS), which isn't a ConstructionProject at all.
// Real placements only ever come from a user's live constructionSiteStore.ts
// localStorage override, which doesn't exist as static source data. Seeding
// an all-null row here would fabricate a "site exists" record where none
// does — the honest state is no row, not a row of nulls.

type ConstructionTreeNodeSeed = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  objectType: "Project" | "Building" | "Floor" | "Floor Plans";
  progress: string | null;
  trade: string | null;
  inspector: string | null;
  punchListCount: string | null;
};

// Real, per constructionData.ts's own NO_DATA constant — used for every
// node whose source has no inspectable data yet (never a fabricated number).
const NO_PROGRESS = {
  progress: "No progress data yet",
  trade: "—",
  inspector: "Unassigned",
  punchListCount: "0",
} as const;

function floorNodes(count: number, projectId: string): ConstructionTreeNodeSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const floorNumber = i + 1;
    return {
      id: `${projectId}-floor-${floorNumber}`,
      projectId,
      parentId: projectId,
      title: `Floor ${floorNumber}`,
      objectType: "Floor" as const,
      ...NO_PROGRESS,
    };
  });
}

// Real tree from constructionData.ts's constructionProjects, flattened
// parent-first (required so each row's parentId FK already exists). Project
// rows themselves are purely navigational in the source — no `inspectable`
// at that tier — so they get real nulls, not placeholder text. Stonepine
// deliberately has no Buildings tier (one placeholder Floor Plans node,
// not 16 fabricated floor-plan rows); Garden Lofts/Skyline go straight
// Project -> Floor; only Cedarwood's Building A and B have real confirmed
// inspectable data — C/D/E honestly have none yet.
const CONSTRUCTION_TREE: ConstructionTreeNodeSeed[] = [
  { id: "stonepine", projectId: "stonepine", parentId: null, title: "Stonepine Residences", objectType: "Project", progress: null, trade: null, inspector: null, punchListCount: null },
  { id: "cedarwood", projectId: "cedarwood", parentId: null, title: "Cedarwood Flats", objectType: "Project", progress: null, trade: null, inspector: null, punchListCount: null },
  { id: "garden-lofts", projectId: "garden-lofts", parentId: null, title: "Garden Lofts", objectType: "Project", progress: null, trade: null, inspector: null, punchListCount: null },
  { id: "skyline", projectId: "skyline", parentId: null, title: "Skyline Towers", objectType: "Project", progress: null, trade: null, inspector: null, punchListCount: null },

  { id: "stonepine-floor-plans", projectId: "stonepine", parentId: "stonepine", title: "16 Floor Plans — not yet itemized", objectType: "Floor Plans", ...NO_PROGRESS },

  { id: "cedarwood-building-a", projectId: "cedarwood", parentId: "cedarwood", title: "Building A", objectType: "Building", progress: "100%", trade: "General", inspector: "M. Alvarez", punchListCount: "0" },
  { id: "cedarwood-building-b", projectId: "cedarwood", parentId: "cedarwood", title: "Building B", objectType: "Building", progress: "62%", trade: "MEP Rough-In", inspector: "M. Alvarez", punchListCount: "6" },
  { id: "cedarwood-building-c", projectId: "cedarwood", parentId: "cedarwood", title: "Building C", objectType: "Building", ...NO_PROGRESS },
  { id: "cedarwood-building-d", projectId: "cedarwood", parentId: "cedarwood", title: "Building D", objectType: "Building", ...NO_PROGRESS },
  { id: "cedarwood-building-e", projectId: "cedarwood", parentId: "cedarwood", title: "Building E", objectType: "Building", ...NO_PROGRESS },

  ...floorNodes(20, "garden-lofts"),
  ...floorNodes(40, "skyline"),
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

  for (const n of GENEALOGY_NODES) {
    await prisma.genealogyNode.upsert({
      where: { id: n.id },
      update: { title: n.title, tier: n.tier, qr: n.qr },
      create: { id: n.id, title: n.title, tier: n.tier, qr: n.qr },
    });
  }
  for (const e of GENEALOGY_EDGES) {
    await prisma.genealogyEdge.upsert({
      where: { fromId_toId: { fromId: e.from, toId: e.to } },
      update: {},
      create: { fromId: e.from, toId: e.to },
    });
  }

  for (const p of CONSTRUCTION_PROJECTS) {
    await prisma.constructionProject.upsert({
      where: { id: p.id },
      update: { title: p.title, realLocationSource: p.realLocationSource },
      create: { id: p.id, title: p.title, realLocationSource: p.realLocationSource },
    });
  }
  for (const t of CONSTRUCTION_TREE) {
    await prisma.constructionTreeNode.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
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

  const genealogyNodeCount = await prisma.genealogyNode.count();
  const genealogyEdgeCount = await prisma.genealogyEdge.count();
  console.log(`Seeded: ${genealogyNodeCount} genealogy nodes, ${genealogyEdgeCount} genealogy edges.`);

  const multiParentIncoming = await prisma.genealogyEdge.count({ where: { toId: "ewp-03-s" } });
  console.log(
    `Multi-parent check — incoming edges into "ewp-03-s" (Exterior Wall Panel): ${multiParentIncoming} (expected 5 — 4 material parents + 1 component parent; a real DAG node, not collapsed to one parent).`
  );

  const constructionProjectCount = await prisma.constructionProject.count();
  const constructionTreeNodeCount = await prisma.constructionTreeNode.count();
  console.log(`Seeded: ${constructionProjectCount} construction projects, ${constructionTreeNodeCount} construction tree nodes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
