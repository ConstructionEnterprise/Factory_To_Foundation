/**
 * Real, one-time backfill for Phase 2 of the 2026-08-16 Scheduling
 * Schedule/Step redesign (docs/decisions/
 * 2026-08-16-scheduling-schedule-persistence-phase2-plan.md, all 4 open
 * questions resolved same day). Two independent real writes:
 *
 * 1. Seeds the 5 real `CanonicalStage` rows verbatim from the frontend
 *    fixture's own title/subtitle/description text
 *    (`Factory_To_Foundation/frontend/src/features/scheduling/
 *    scheduleData.ts`) -- the first time these become real database rows.
 *    Always run (idempotent upsert by title).
 *
 * 2. Creates 4 real `Schedule` rows from the real "S\d+ Name" prefix
 *    already present in the 27 real `ScheduleTask` titles from the
 *    2026-08-12 CE Forge boundary experiment, backfills each task's real
 *    `scheduleId`, and creates one real `ScheduleStage` per task by
 *    parsing the text after the real " — " delimiter -- reading what
 *    each title already states, not inventing structure. Real
 *    `position` is derived from each schedule's own real
 *    `ScheduleTaskDependency` topology (Kahn's algorithm), not
 *    alphabetical/insertion order. `canonicalStageId` stays null on
 *    every new stage -- none of the real step names (Kitting, QC
 *    Release, Crane Setup, etc.) match any of the 5 canonical names, and
 *    none is forced to. The 2 pre-existing unprefixed tasks ("Material
 *    Inbound", "Equipment Inbound") are left untouched -- no real
 *    evidence assigns them to any schedule.
 *
 * Idempotent: if any real Schedule row already exists, step 2 is a
 * no-op (reports and skips); step 1's upserts always run.
 *
 *   npx tsx scripts/backfill-scheduling-phase2.ts
 */
import { prisma } from "../src/lib/prisma";

const CANONICAL_STAGES = [
  {
    title: "Inbound Material",
    subtitle: "Purchase Orders",
    description:
      "Tracks purchase orders from the moment they're placed, before material has physically arrived or been assigned a genealogy identity.",
    order: 0,
  },
  {
    title: "Material Arrival",
    subtitle: "Receiving",
    description: "Tracks when material actually arrives on site and where it's routed — the moment a Material genealogy node is created.",
    order: 1,
  },
  {
    title: "Sub-Assembly & Module Production",
    subtitle: "Production",
    description:
      "Tracks the making of sub-assemblies and modules on the factory floor — connects to real cycle-time data once the Twin Service lands.",
    order: 2,
  },
  {
    title: "Module Storage & Logistics",
    subtitle: "Storage / Yard",
    description: "Tracks where finished modules sit in the yard and their transportation status ahead of delivery.",
    order: 3,
  },
  {
    title: "Construction Schedule",
    subtitle: "Install / Site",
    description:
      "Tracks on-site installation sequencing — the coarsest-grained schedule of the five, closer to a critical-path Gantt than a live feed.",
    order: 4,
  },
];

async function seedCanonicalStages(): Promise<void> {
  for (const stage of CANONICAL_STAGES) {
    await prisma.canonicalStage.upsert({ where: { title: stage.title }, create: stage, update: {} });
  }
  console.log(`Real CanonicalStage rows upserted: ${CANONICAL_STAGES.length}.`);
}

type TaskRow = { id: string; title: string };

/** Real Kahn's-algorithm topological order, scoped to one schedule's own real dependency edges only. */
function topologicalOrder(taskIds: string[], deps: { predecessorId: string; successorId: string }[]): string[] {
  const idSet = new Set(taskIds);
  const localDeps = deps.filter((d) => idSet.has(d.predecessorId) && idSet.has(d.successorId));

  const inDegree = new Map<string, number>();
  for (const id of taskIds) inDegree.set(id, 0);
  const adjacency = new Map<string, string[]>();
  for (const d of localDeps) {
    inDegree.set(d.successorId, (inDegree.get(d.successorId) ?? 0) + 1);
    const list = adjacency.get(d.predecessorId) ?? [];
    list.push(d.successorId);
    adjacency.set(d.predecessorId, list);
  }

  const queue = taskIds.filter((id) => (inDegree.get(id) ?? 0) === 0).sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 1) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  // Real isolated nodes / a real cycle (neither expected, but not
  // assumed away) -- appended deterministically by title, never given a
  // fabricated dependency relationship.
  const remaining = taskIds.filter((id) => !order.includes(id));
  return [...order, ...remaining];
}

async function main() {
  console.log("=== BEFORE ===");
  const beforeSchedules = await prisma.schedule.count();
  const beforeCanonical = await prisma.canonicalStage.count();
  console.log(`schedule: ${beforeSchedules} existing, canonical_stage: ${beforeCanonical} existing`);

  await seedCanonicalStages();

  if (beforeSchedules > 0) {
    console.log("Real Schedule rows already exist -- idempotent no-op for the schedule/stage backfill.");
    return;
  }

  const ceoUser = await prisma.user.findFirst({ where: { role: { name: "CEO" } }, select: { id: true, email: true } });
  if (!ceoUser) {
    throw new Error("No real user with role CEO exists -- refusing to fabricate an author for the real Schedule rows. STOP.");
  }
  console.log(`Attributing Schedule authorship to real user ${ceoUser.email} (role CEO).`);

  const tasks: TaskRow[] = await prisma.scheduleTask.findMany({ select: { id: true, title: true } });
  const deps = await prisma.scheduleTaskDependency.findMany({ select: { predecessorId: true, successorId: true } });

  const groups = new Map<string, { taskId: string; stepTitle: string }[]>();
  let unprefixedCount = 0;
  for (const t of tasks) {
    const parts = t.title.split(" — ");
    if (parts.length !== 2) {
      unprefixedCount += 1;
      continue; // "Material Inbound" / "Equipment Inbound" -- no real schedule, left untouched
    }
    const [schedulePrefix, stepTitle] = parts.map((p) => p.trim());
    const list = groups.get(schedulePrefix) ?? [];
    list.push({ taskId: t.id, stepTitle });
    groups.set(schedulePrefix, list);
  }
  console.log(`Real title-prefix groups found: ${groups.size} (${unprefixedCount} unprefixed real tasks left untouched).`);

  let totalStagesCreated = 0;
  let totalTasksLinked = 0;

  for (const [scheduleTitle, members] of groups) {
    const schedule = await prisma.schedule.create({ data: { title: scheduleTitle, createdById: ceoUser.id } });

    const taskIds = members.map((m) => m.taskId);
    const order = topologicalOrder(taskIds, deps);

    for (let i = 0; i < order.length; i += 1) {
      const taskId = order[i];
      const member = members.find((m) => m.taskId === taskId)!;
      const stage = await prisma.scheduleStage.create({
        data: { scheduleId: schedule.id, title: member.stepTitle, position: i },
      });
      await prisma.scheduleTask.update({ where: { id: taskId }, data: { scheduleId: schedule.id, stageId: stage.id } });
      totalStagesCreated += 1;
      totalTasksLinked += 1;
    }

    console.log(`Created real schedule "${scheduleTitle}" with ${order.length} real stages/tasks, dependency-ordered.`);
  }

  console.log("=== AFTER ===");
  const afterSchedules = await prisma.schedule.count();
  const afterStages = await prisma.scheduleStage.count();
  const afterLinkedTasks = await prisma.scheduleTask.count({ where: { scheduleId: { not: null } } });
  console.log(`schedule: ${afterSchedules}, schedule_stage: ${afterStages}, scheduleTask(scheduleId set): ${afterLinkedTasks}`);

  if (afterSchedules !== groups.size) {
    throw new Error(`Real count mismatch: expected ${groups.size} Schedule rows, found ${afterSchedules}. STOP.`);
  }
  if (afterStages !== totalStagesCreated) {
    throw new Error(`Real count mismatch: expected ${totalStagesCreated} ScheduleStage rows, found ${afterStages}. STOP.`);
  }
  if (afterLinkedTasks !== totalTasksLinked) {
    throw new Error(`Real count mismatch: expected ${totalTasksLinked} linked ScheduleTask rows, found ${afterLinkedTasks}. STOP.`);
  }

  console.log("DONE. Real Schedule/CanonicalStage/ScheduleStage backfill complete, counts verified exact.");
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
