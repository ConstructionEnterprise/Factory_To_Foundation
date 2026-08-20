// Reconstructed 2026-08-19 during the CE_RECOVERY Cold Start Test.
//
// The original restore-test loader (RESTORE_TEST_RESULTS.md, 2026-08-18) was
// a throwaway script deleted after its one verified run — it was never
// preserved in the recovery archive. This script rebuilds it from that
// document's prose description of the four bugs it had to work around:
//   1. @prisma/adapter-pg silently ignores ?schema= on the connection string
//      -> use raw `pg.Client` + an explicit SET search_path instead.
//   2. Interleaved per-model TRUNCATE...CASCADE can wipe already-loaded
//      dependent tables -> two-phase: truncate everything first, then
//      insert everything, never interleaved.
//   3. DMMF field filtering must include "enum"-kind fields, not just
//      "scalar", or every enum column gets silently dropped from the
//      INSERT column list.
//   4. node-postgres doesn't auto-serialize JS objects/arrays for
//      Prisma "Json" columns -> JSON.stringify() them before binding.
//
// Usage: DATABASE_URL=postgresql://user:pass@host:port/db?schema=public \
//        EXPORT_DIR=/path/to/ff-db-export npx tsx scripts/cold-start-restore.ts

import { Client } from "pg";
import { Prisma } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const exportDir = process.env.EXPORT_DIR;
if (!exportDir) {
  console.error("EXPORT_DIR env var required (directory containing <Model>.json + _SUMMARY.json)");
  process.exit(1);
}

const dbUrl = new URL(process.env.DATABASE_URL ?? "");
const schema = dbUrl.searchParams.get("schema") || "public";

const jsonFieldsByModel = new Map<string, Set<string>>();
for (const m of Prisma.dmmf.datamodel.models) {
  const jsonFields = new Set(m.fields.filter((f) => f.type === "Json").map((f) => f.name));
  if (jsonFields.size) jsonFieldsByModel.set(m.name, jsonFields);
}

function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`SET search_path TO ${quoteIdent(schema)}`);
  const { rows: schemaCheck } = await client.query("SELECT current_schema()");
  console.log("connected, current_schema =", schemaCheck[0].current_schema);
  if (schemaCheck[0].current_schema !== schema) {
    throw new Error(`search_path did not take effect: expected ${schema}, got ${schemaCheck[0].current_schema}`);
  }

  // Real FK dependency graph, from Postgres itself (not re-derived from the
  // Prisma schema) — same evidence standard the original restore test used.
  const { rows: fkRows } = await client.query(
    `SELECT
       tc.table_name AS child,
       kcu.column_name AS child_column,
       ccu.table_name AS parent
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`,
    [schema]
  );

  const models = Prisma.dmmf.datamodel.models;
  const tableToModel = new Map(models.map((m) => [m.dbName ?? m.name, m]));
  const deps = new Map<string, Set<string>>();
  for (const m of models) deps.set(m.dbName ?? m.name, new Set());
  // Self-referencing FK columns (e.g. ConstructionTreeNode.parentId) can't be
  // satisfied by table-level ordering alone — a row can reference a sibling
  // row in the same table's own insert batch. Loaded NULL first, patched after.
  const selfRefColumnsByTable = new Map<string, Set<string>>();
  for (const { child, child_column, parent } of fkRows) {
    if (child === parent) {
      if (!selfRefColumnsByTable.has(child)) selfRefColumnsByTable.set(child, new Set());
      selfRefColumnsByTable.get(child)!.add(child_column);
      continue;
    }
    if (deps.has(child) && deps.has(parent)) deps.get(child)!.add(parent);
  }

  // Topological sort (parents before children); stable enough for a one-shot load.
  const ordered: string[] = [];
  const visited = new Set<string>();
  function visit(table: string, stack: Set<string>) {
    if (visited.has(table)) return;
    if (stack.has(table)) return; // cycle guard — shouldn't happen, disclosed if it does
    stack.add(table);
    for (const parent of deps.get(table) ?? []) visit(parent, stack);
    stack.delete(table);
    visited.add(table);
    ordered.push(table);
  }
  for (const table of deps.keys()) visit(table, new Set());

  console.log(`${ordered.length} tables, dependency order resolved from ${fkRows.length} real FK constraints`);

  // Phase 1: truncate everything first (no inserts yet, so cascade can't wipe loaded data).
  for (const table of ordered) {
    await client.query(`TRUNCATE TABLE ${quoteIdent(schema)}.${quoteIdent(table)} CASCADE`);
  }
  console.log("phase 1 complete: all tables truncated");

  // Phase 2: insert every table, parents before children.
  let totalInserted = 0;
  for (const table of ordered) {
    const model = tableToModel.get(table)!;
    const file = join(exportDir, `${model.name}.json`);
    if (!existsSync(file)) {
      console.warn(`  skip ${model.name}: no export file found`);
      continue;
    }
    const rows: Record<string, unknown>[] = JSON.parse(readFileSync(file, "utf8"));
    if (!rows.length) continue;

    const jsonFields = jsonFieldsByModel.get(model.name) ?? new Set<string>();
    // Bug #3: include both scalar AND enum kinds, not just scalar.
    const fields = model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
    const columns = fields.map((f) => f.dbName ?? f.name);
    const selfRefCols = selfRefColumnsByTable.get(table) ?? new Set<string>();
    const idField = model.fields.find((f) => f.name === "id");

    // Self-referencing FK patch queue: [rowIdValue, dbColumn, originalValue][]
    const selfRefPatches: [unknown, string, unknown][] = [];

    for (const row of rows) {
      const values = fields.map((f) => {
        const dbCol = f.dbName ?? f.name;
        const v = row[f.name];
        if (selfRefCols.has(dbCol) && v !== null) {
          selfRefPatches.push([row[idField!.name], dbCol, v]);
          return null; // load NULL now, patch after the full table is loaded
        }
        // Bug #4: JSON.stringify Json-typed fields before binding.
        if (v !== null && jsonFields.has(f.name)) return JSON.stringify(v);
        return v;
      });
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
      const sql = `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES (${placeholders})`;
      await client.query(sql, values);
    }

    if (selfRefPatches.length) {
      const idCol = idField!.dbName ?? idField!.name;
      for (const [idValue, col, value] of selfRefPatches) {
        await client.query(
          `UPDATE ${quoteIdent(schema)}.${quoteIdent(table)} SET ${quoteIdent(col)} = $1 WHERE ${quoteIdent(idCol)} = $2`,
          [value, idValue]
        );
      }
      console.log(`  ${model.name}: patched ${selfRefPatches.length} self-referencing FK value(s)`);
    }

    totalInserted += rows.length;
    console.log(`  ${model.name}: ${rows.length} rows`);
  }
  console.log(`phase 2 complete: ${totalInserted} rows inserted across ${ordered.length} tables`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
