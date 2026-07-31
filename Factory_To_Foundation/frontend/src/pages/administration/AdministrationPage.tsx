import { SimplePage } from "@/framework/ui";

import DataProvenanceTable from "@/features/administration/DataProvenanceTable";
import ComplianceRecords from "@/features/administration/ComplianceRecords/ComplianceRecords";

/**
 * A4 — Compliance & Records (real, standalone S3-backed document store)
 * added alongside the existing real Data Provenance table. Document
 * Templates (the other half of A4) are new category values on the
 * existing Construction document store (projectFileService.ts's
 * PROJECT_FILE_CATEGORIES) — no separate UI needed here, they show up
 * automatically wherever Construction's document folders already render.
 */
export default function AdministrationPage() {
  return (
    <SimplePage pageLabel="Administration" pageSubtitle="Data Provenance — Real vs. Fixture, Per Feature">
      <div className="flex flex-col gap-6">
        <DataProvenanceTable />
        <ComplianceRecords />
      </div>
    </SimplePage>
  );
}
