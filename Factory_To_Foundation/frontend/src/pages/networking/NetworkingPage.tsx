import { SimplePage } from "@/framework/ui";
import RolesPermissionsMatrix from "@/features/networking/RolesPermissionsMatrix";
import UserManagementTable from "@/features/networking/UserManagementTable";

/**
 * Networking (A3) — the two real, live RBAC pieces from the brief: a
 * read-only Roles & Permissions matrix and a real User Management CRUD UI.
 * SimplePage (not FeaturePage): this is a dashboard/config shape, not
 * spatial object browsing, same reasoning as Analytics/Administration/
 * Reports (§6.9).
 */
export default function NetworkingPage() {
  return (
    <SimplePage pageLabel="Networking" pageSubtitle="Roles, Permissions & User Management">
      <div className="flex flex-col gap-6">
        <RolesPermissionsMatrix />
        <UserManagementTable />
      </div>
    </SimplePage>
  );
}
