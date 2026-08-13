/**
 * Repairs the 196 real Construction ProjectFile records whose S3 objects
 * were never persisted (the generator that created their DB rows never
 * saved its output content anywhere reachable -- see
 * project_ff_shared_db_incident memory for the full trace). This does NOT
 * recover the original bytes -- nothing to recover exists. It reconstructs
 * new content from each row's own real, existing metadata (project,
 * category, subcategory, filename) and marks that honestly in
 * SyntheticDataProvenance.contentStatus = RECONSTRUCTED, never claiming
 * RECOVERED.
 *
 * Sandbox only, by construction: reads DATABASE_URL/S3_BUCKET_NAME from
 * whatever --env-file is passed at invocation. Run with
 * --env-file=.env.sandbox. Never run with the default .env (production).
 *
 * Does NOT create/delete ProjectFile or ConstructionSite rows, does NOT
 * change ids, does NOT touch filename/category/subcategory/project.
 * sizeBytes is corrected ONLY when the real reconstructed content's actual
 * byte length differs from the stored value -- the field must describe
 * the truth of what's actually in S3, not the (unrecoverable) original.
 *
 *   npx tsx --env-file=.env.sandbox scripts/reconstruct-construction-content.ts [--only <id1,id2,...>]
 */
import "dotenv/config";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { prisma } from "../src/lib/prisma";
import { s3Client, S3_BUCKET_NAME } from "../src/lib/s3";

const PROJECT_NAMES: Record<string, string> = {
  stonepine: "Stonepine Residences",
  cedarwood: "Cedarwood Flats",
  "garden-lofts": "Garden Lofts",
  skyline: "Skyline Towers",
};

function extractSubject(originalFilename: string, projectName: string): string {
  const withoutExt = originalFilename.replace(/\.[^.]+$/, "");
  const prefix = `${projectName} - `;
  return withoutExt.startsWith(prefix) ? withoutExt.slice(prefix.length) : withoutExt;
}

const TEMPLATES: Record<string, (p: { project: string; subcategory: string; subject: string }) => string> = {
  RFI: ({ project, subcategory, subject }) =>
    `Request for Information: ${subject} — ${project}. Submitted under ${subcategory}. Clarification requested on the referenced scope item to confirm compatibility with the current construction documents before proceeding.`,
  Submittal: ({ project, subcategory, subject }) =>
    `Submittal package: ${subject} — ${project}. Prepared for ${subcategory}. Includes product data and compliance documentation submitted for review and approval prior to procurement.`,
  "Change Order": ({ project, subcategory, subject }) =>
    `Change Order record: ${subject} — ${project}. Logged under ${subcategory}. Scope revision recorded for cost and schedule impact tracking against the original contract.`,
  "Purchase Order": ({ project, subcategory, subject }) =>
    `Purchase Order record: ${subject} — ${project}. Procurement category: ${subcategory}. Vendor commitment logged for material and equipment delivery tracking.`,
  "Inspection Report": ({ project, subcategory, subject }) =>
    `Field inspection report: ${subject} — ${project}. Category: ${subcategory}. Inspection completed and findings logged for the referenced scope area.`,
  "Quality & Safety": ({ project, subcategory, subject }) =>
    `Quality & Safety record: ${subject} — ${project}. Type: ${subcategory}. Documented as part of ongoing site safety and quality assurance tracking.`,
  "Field Documentation": ({ project, subcategory, subject }) =>
    `Field documentation: ${subject} — ${project}. Type: ${subcategory}. Site progress and conditions recorded for the reporting period.`,
  "Project Documents": ({ project, subcategory, subject }) =>
    `Project document: ${subject} — ${project}. Category: ${subcategory}. Retained as part of the project's governing documentation record.`,
  "Drawings & Models": ({ project, subcategory, subject }) =>
    `Drawing/model reference: ${subject} — ${project}. Discipline: ${subcategory}. Logged as part of design coordination documentation.`,
};

function buildContent(row: { projectId: string; category: string; subcategory: string | null; originalFilename: string }): string {
  const project = PROJECT_NAMES[row.projectId] ?? row.projectId;
  const subject = extractSubject(row.originalFilename, project);
  const template = TEMPLATES[row.category];
  if (!template) throw new Error(`No content template for category "${row.category}" (${row.originalFilename})`);
  return template({ project, subcategory: row.subcategory ?? row.category, subject });
}

const CONTENT_GENERATOR = "CE Forge reconstruction pass (backend/scripts/reconstruct-construction-content.ts)";

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyIds = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;

  if (S3_BUCKET_NAME.includes("construction-enterprise-project-files-027958788731-us-east-2-an")) {
    throw new Error("REFUSING TO RUN: S3_BUCKET_NAME resolves to the production bucket. Run with --env-file=.env.sandbox.");
  }
  console.log("Target bucket:", S3_BUCKET_NAME);

  const rows = await prisma.projectFile.findMany({
    where: { deletedAt: null, ...(onlyIds ? { id: { in: onlyIds } } : {}) },
    orderBy: { id: "asc" },
  });
  console.log(`Repairing ${rows.length} ProjectFile row(s).`);

  let sizeCorrections = 0;
  let provenanceUpdated = 0;
  let provenanceMissing = 0;

  for (const row of rows) {
    const content = buildContent(row);
    const buffer = Buffer.from(content, "utf-8");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: row.s3Key,
        Body: buffer,
        ContentType: row.contentType,
      })
    );

    if (buffer.byteLength !== row.sizeBytes) {
      await prisma.projectFile.update({ where: { id: row.id }, data: { sizeBytes: buffer.byteLength } });
      sizeCorrections++;
    }

    const provenance = await prisma.syntheticDataProvenance.findFirst({
      where: { domain: "construction", recordType: "ProjectFile", recordId: row.id },
    });
    if (provenance) {
      await prisma.syntheticDataProvenance.update({
        where: { id: provenance.id },
        data: { contentStatus: "RECONSTRUCTED", contentGeneratedAt: new Date(), contentGenerator: CONTENT_GENERATOR },
      });
      provenanceUpdated++;
    } else {
      provenanceMissing++;
      console.warn(`No provenance row found for ProjectFile ${row.id} (${row.originalFilename})`);
    }

    console.log(`OK: ${row.id}  ${row.originalFilename}  (${buffer.byteLength} bytes)`);
  }

  console.log("\nDONE.");
  console.log(
    JSON.stringify({ repaired: rows.length, sizeCorrections, provenanceUpdated, provenanceMissing }, null, 2)
  );
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
