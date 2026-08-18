import { SimplePage } from "@/framework/ui";

import PayrollAccountsTable from "@/features/administration/PayrollAccounts/PayrollAccountsTable";
import UserManagementTable from "@/features/permissions/UserManagementTable";

/**
 * Administration rebuild (2026-08-18) — the old Data Provenance / Compliance
 * Records UI (DataProvenanceTable.tsx, ComplianceRecords/,
 * complianceDocumentsApi.ts) is deleted per explicit instruction ("the
 * administration tab is completely outdated, gut it"). The backend routes/
 * model (complianceDocuments.ts, ComplianceDocument) and the real S3
 * documents/DB rows behind them are untouched — deleting the frontend only
 * removes this page's access to that data, not the data itself.
 *
 * Administration is now Payroll + User Management, real administrative
 * functions with room for more alongside them later. Payroll sits above
 * User Management (explicit instruction, 2026-08-18) — Payroll Accounts
 * are always created FROM an existing real User profile — never a second,
 * separately-invented employee identity system — which is why User
 * Management (create/edit/delete real accounts) moved here too. Permissions
 * keeps the Roles & Permissions matrix; UserManagementTable.tsx itself
 * stays in features/permissions/ since Users are still a real
 * permissions-owned resource (backend routes/users.ts is still gated on
 * the `permissions` module, unchanged) — only the page mounting it moved.
 */
export default function AdministrationPage() {
  return (
    <SimplePage pageLabel="Administration" pageSubtitle="Payroll & User Management">
      <div className="flex flex-col gap-6">
        <PayrollAccountsTable />
        <UserManagementTable />
      </div>
    </SimplePage>
  );
}
