import { SimplePage } from "@/framework/ui";

import PayrollAccountsTable from "@/features/administration/PayrollAccounts/PayrollAccountsTable";

/**
 * Administration rebuild (2026-08-18) — the old Data Provenance / Compliance
 * Records UI (DataProvenanceTable.tsx, ComplianceRecords/,
 * complianceDocumentsApi.ts) is deleted per explicit instruction ("the
 * administration tab is completely outdated, gut it"). The backend routes/
 * model (complianceDocuments.ts, ComplianceDocument) and the real S3
 * documents/DB rows behind them are untouched — deleting the frontend only
 * removes this page's access to that data, not the data itself. Rebuild or
 * relocate the UI in a separate, explicit step if that data needs a home
 * again.
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
