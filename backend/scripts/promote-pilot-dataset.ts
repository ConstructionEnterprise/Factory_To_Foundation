/**
 * Promotes the exact, pre-verified AUGUST_2026_PILOT dataset from sandbox
 * to production, preserving every row's real id. This is NOT a generator
 * -- it copies already-validated rows, in dependency order, and refuses to
 * run at all if live reality (row counts on either side) differs from the
 * manifest verified immediately before this script was written. Any
 * mismatch is a STOP, not something this script adapts around.
 *
 * Requires two DATABASE_URLs simultaneously: SOURCE (sandbox, read-only)
 * and the normal DATABASE_URL (production, write target, from whatever
 * --env-file was passed -- must be the real .env).
 *
 *   SOURCE_DATABASE_URL=<sandbox URL> npx tsx --env-file=.env scripts/promote-pilot-dataset.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const EXPECTED = {
  asset: 30,
  constructionSite: 4,
  scheduleTask: 27,
  scheduleTaskDependency: 23,
  scheduleTaskStatusEvent: 37,
  logisticsTruck: 2,
  logisticsDriver: 2,
  logisticsDispatch: 4,
  logisticsMaterial: 4,
  logisticsModule: 2,
  logisticsCustodyEvent: 7,
  projectFile: 196,
  syntheticDataProvenance: 294,
};

// ConstructionSite is a natural-key model -- its primary key is projectId,
// not id (it has no separate id field at all). Everything else uses id.
const PK_FIELD: Partial<Record<keyof typeof EXPECTED, string>> = {
  constructionSite: "projectId",
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`PRECONDITION FAILED: ${msg}`);
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  assert(!!sourceUrl, "SOURCE_DATABASE_URL not set");
  assert(!sourceUrl!.includes("ff-postgres-dev.cbma"), "SOURCE_DATABASE_URL resolves to production -- refusing, source must be sandbox");
  assert(!process.env.DATABASE_URL!.includes("ff-postgres-sandbox"), "target DATABASE_URL resolves to sandbox -- refusing, target must be production");

  const target = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) });
  const source = new PrismaClient({ adapter: new PrismaPg({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } }) });

  console.log("=== PHASE A: precondition verification (read-only) ===");

  const diffIds = async (model: keyof typeof EXPECTED) => {
    const pk = PK_FIELD[model] ?? "id";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetDelegate = (target as any)[model];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceDelegate = (source as any)[model];
    const targetIds = new Set((await targetDelegate.findMany({ select: { [pk]: true } })).map((r: Record<string, string>) => r[pk]));
    const sourceRows = await sourceDelegate.findMany({ orderBy: { [pk]: "asc" } });
    const newRows = sourceRows.filter((r: Record<string, string>) => !targetIds.has(r[pk]));
    return newRows;
  };

  const plan: Record<string, unknown[]> = {};
  for (const model of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    const newRows = await diffIds(model);
    plan[model] = newRows;
    console.log(`${model}: ${newRows.length} new (expected ${EXPECTED[model]})`);
    assert(newRows.length === EXPECTED[model], `${model} has ${newRows.length} new rows, manifest expects ${EXPECTED[model]}`);
  }

  // ProjectFile active-only sanity: all 196 must be non-deleted (already implied by the manifest, re-asserted).
  const deletedInPlan = (plan.projectFile as { deletedAt: Date | null }[]).filter((r) => r.deletedAt !== null);
  assert(deletedInPlan.length === 0, `${deletedInPlan.length} planned ProjectFile rows are soft-deleted -- should be 0`);

  console.log("\nAll preconditions match the manifest exactly. Proceeding to Phase B.\n");

  console.log("=== PHASE B: insert, in dependency order ===");

  async function insertPhase(label: string, model: keyof typeof EXPECTED) {
    const rows = plan[model];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (target as any)[model];
    const result = await delegate.createMany({ data: rows });
    assert(result.count === EXPECTED[model], `${label}: inserted ${result.count}, expected ${EXPECTED[model]}`);
    console.log(`${label}: inserted ${result.count}`);
  }

  await insertPhase("Asset", "asset");
  await insertPhase("ConstructionSite", "constructionSite");
  await insertPhase("ScheduleTask", "scheduleTask");
  await insertPhase("ScheduleTaskDependency", "scheduleTaskDependency");
  await insertPhase("ScheduleTaskStatusEvent", "scheduleTaskStatusEvent");
  await insertPhase("LogisticsTruck", "logisticsTruck");
  await insertPhase("LogisticsDriver", "logisticsDriver");
  await insertPhase("LogisticsDispatch", "logisticsDispatch");
  await insertPhase("LogisticsMaterial", "logisticsMaterial");
  await insertPhase("LogisticsModule", "logisticsModule");
  await insertPhase("LogisticsCustodyEvent", "logisticsCustodyEvent");
  await insertPhase("ProjectFile", "projectFile");
  await insertPhase("SyntheticDataProvenance", "syntheticDataProvenance");

  console.log("\n=== PHASE C: post-insert count verification ===");
  for (const model of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    const remaining = (await diffIds(model)).length;
    assert(remaining === 0, `${model}: ${remaining} rows still missing from production after insert`);
    console.log(`${model}: fully promoted (0 remaining gap)`);
  }

  console.log("\nDONE. Full 632-row manifest promoted and verified.");

  // Emit the ProjectFile s3Key list for the S3 copy step.
  const { writeFileSync } = await import("node:fs");
  const keys = (plan.projectFile as { s3Key: string }[]).map((r) => r.s3Key);
  writeFileSync("./promoted-s3-keys.json", JSON.stringify(keys, null, 2));
  console.log(`Wrote ${keys.length} S3 keys to promoted-s3-keys.json for the copy step.`);

  await target.$disconnect();
  await source.$disconnect();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
});
