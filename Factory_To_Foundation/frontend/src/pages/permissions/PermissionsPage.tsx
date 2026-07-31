import { SimplePage } from "@/framework/ui";
import RolesPermissionsMatrix from "@/features/permissions/RolesPermissionsMatrix";
import UserManagementTable from "@/features/permissions/UserManagementTable";

/**
 * Permissions (A3, renamed from Networking) — the two real, live RBAC
 * pieces from the brief: a real, editable Roles & Permissions matrix and a
 * real User Management CRUD UI. Renamed via the Permissions Migration
 * (Option A, true rename) — this page/module was always the real RBAC
 * subsystem, just wearing the wrong name; "Networking" is now a separate,
 * genuinely distinct real module for factory IT/OT infrastructure.
 * SimplePage (not FeaturePage): this is a dashboard/config shape, not
 * spatial object browsing, same reasoning as Analytics/Administration/
 * Reports (§6.9).
 */
export default function PermissionsPage() {
  return (
    <SimplePage pageLabel="Permissions" pageSubtitle="Roles, Permissions & User Management">
      <div className="flex flex-col gap-6">
        <RolesPermissionsMatrix />
        <UserManagementTable />
      </div>
    </SimplePage>
  );
}
