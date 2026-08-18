import { SimplePage } from "@/framework/ui";
import RolesPermissionsMatrix from "@/features/permissions/RolesPermissionsMatrix";

/**
 * Permissions (A3, renamed from Networking) — the real, editable Roles &
 * Permissions matrix. Renamed via the Permissions Migration (Option A,
 * true rename) — this page/module was always the real RBAC subsystem, just
 * wearing the wrong name; "Networking" is now a separate, genuinely
 * distinct real module for factory IT/OT infrastructure.
 * SimplePage (not FeaturePage): this is a dashboard/config shape, not
 * spatial object browsing, same reasoning as Analytics/Administration/
 * Reports (§6.9).
 *
 * User Management moved to Administration (2026-08-18, explicit
 * instruction) — the component itself (UserManagementTable.tsx) stays in
 * features/permissions/ since Users are still a real permissions-owned
 * resource (backend routes/users.ts is still gated on the `permissions`
 * module, unchanged); only which page mounts it moved, same as Inventory
 * rendering Assets/Genealogy components without relocating their files.
 */
export default function PermissionsPage() {
  return (
    <SimplePage pageLabel="Permissions" pageSubtitle="Roles & Permissions">
      <RolesPermissionsMatrix />
    </SimplePage>
  );
}
