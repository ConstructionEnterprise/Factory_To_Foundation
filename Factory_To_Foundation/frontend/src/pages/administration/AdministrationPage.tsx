import { SimplePage } from "@/framework/ui";

import PayrollAccountsTable from "@/features/administration/PayrollAccounts/PayrollAccountsTable";

/**
 * Administration rebuild (2026-08-18) — the old Data Provenance / Compliance
 * Records content (real, S3-backed, still live at features/administration/
 * DataProvenanceTable.tsx and ComplianceRecords/) is unmounted from this
 * page per explicit instruction ("the administration tab is completely
 * outdated, gut it"). Left on disk rather than deleted: both still have
 * real persisted backend data behind them (S3 documents, real
 * ComplianceDocument rows) that this rebuild has no mandate to remove —
 * only to stop surfacing here. Relocate or formally retire in a separate,
 * explicit step if that data still needs a home.
 *
 * Administration is now Payroll (its first real administrative function,
 * with room for more alongside it later) — real PayrollAccount records,
 * always created FROM an existing real User profile that Permissions'
 * own User Management already owns, never a second, separately-invented
 * employee identity system.
 */
export default function AdministrationPage() {
  return (
    <SimplePage pageLabel="Administration" pageSubtitle="Payroll">
      <PayrollAccountsTable />
    </SimplePage>
  );
}
