import { SimplePage } from "@/framework/ui";

import DataProvenanceTable from "@/features/administration/DataProvenanceTable";

export default function AdministrationPage() {
  return (
    <SimplePage pageLabel="Administration" pageSubtitle="Data Provenance — Real vs. Fixture, Per Feature">
      <DataProvenanceTable />
    </SimplePage>
  );
}
