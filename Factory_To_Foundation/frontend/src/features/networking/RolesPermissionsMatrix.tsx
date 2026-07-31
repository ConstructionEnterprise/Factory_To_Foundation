import { useEffect, useState } from "react";

import { PanelCard } from "@/framework/ui";
import { usePermission } from "@/context/AuthContext";
import { fetchRbacDirectory, setGrant, type RbacDirectory, type RbacGrant } from "./rbacDirectoryApi";

/** Canonical display order/abbreviation for the 6 real seeded permission ids — matches backend/prisma/seed.ts's own R/C/U/D/E/A shorthand notation exactly, not invented here. */
const PERMISSION_ORDER: { id: string; abbr: string }[] = [
  { id: "read", abbr: "R" },
  { id: "create", abbr: "C" },
  { id: "update", abbr: "U" },
  { id: "delete", abbr: "D" },
  { id: "execute", abbr: "E" },
  { id: "administer", abbr: "A" },
];

function grantKey(roleId: string, moduleId: string, permissionId: string): string {
  return `${roleId}:${moduleId}:${permissionId}`;
}

/**
 * Real Roles & Permissions matrix (A3) — the actual seeded Module/Role/
 * Permission/RolePermission tables (10 roles, 12 modules post-Phase-1, 166
 * real grant rows), not a mockup. Originally deliberately read-only (a
 * naive editable grid risked corrupting the real seeded matrix every
 * route's server-side enforcement depends on) — real edit mode added on
 * explicit user request: each toggle is a genuine create/delete against
 * role_permission, gated on networking:update, with the same real,
 * disclosed recovery path (`prisma db seed`) if a role ever locks itself
 * out of further edits noted in the backend's own doc comments.
 */
export default function RolesPermissionsMatrix() {
  const [directory, setDirectory] = useState<RbacDirectory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const updatePermission = usePermission("networking", "update");

  useEffect(() => {
    fetchRbacDirectory()
      .then(setDirectory)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load RBAC directory"));
  }, []);

  async function handleToggle(roleId: string, moduleId: string, permissionId: string, checked: boolean) {
    if (!directory) return;
    const key = grantKey(roleId, moduleId, permissionId);

    // Real optimistic update — reflect the toggle immediately, roll back on a real server rejection.
    const previousGrants = directory.grants;
    const nextGrants: RbacGrant[] = checked
      ? [...previousGrants, { roleId, moduleId, permissionId }]
      : previousGrants.filter((g) => !(g.roleId === roleId && g.moduleId === moduleId && g.permissionId === permissionId));
    setDirectory({ ...directory, grants: nextGrants });
    setPendingKeys((prev) => new Set(prev).add(key));
    setError(null);

    try {
      await setGrant(roleId, moduleId, permissionId, checked);
    } catch (err) {
      setDirectory({ ...directory, grants: previousGrants });
      setError(err instanceof Error ? err.message : "Failed to save the real permission change");
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (error && !directory) {
    return (
      <PanelCard title="Roles & Permissions">
        <p className="text-sm" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      </PanelCard>
    );
  }

  if (!directory) {
    return (
      <PanelCard title="Roles & Permissions">
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Loading real RBAC data…
        </p>
      </PanelCard>
    );
  }

  const grantsByRoleModule = new Map<string, Set<string>>();
  for (const grant of directory.grants) {
    const key = `${grant.roleId}:${grant.moduleId}`;
    if (!grantsByRoleModule.has(key)) grantsByRoleModule.set(key, new Set());
    grantsByRoleModule.get(key)!.add(grant.permissionId);
  }

  return (
    <PanelCard
      title={`Roles & Permissions — ${directory.roles.length} Roles × ${directory.modules.length} Modules × ${directory.grants.length} Real Grants`}
      toolbar={
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          disabled={!updatePermission.allowed}
          title={updatePermission.reason}
          className="rounded px-2 py-1 text-[0.65rem] font-medium disabled:opacity-50"
          style={{
            background: editMode ? "var(--ff-accent)" : "var(--ff-chrome-bg)",
            color: editMode ? "white" : "var(--ff-text-primary)",
          }}
        >
          {editMode ? "Done Editing" : "Edit Permissions"}
        </button>
      }
    >
      {error && (
        <p className="mb-2 text-xs" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr style={{ borderBottom: "2px solid var(--ff-panel-border)" }}>
              <th className="py-2 pr-3 sticky left-0" style={{ background: "var(--ff-panel-bg)", color: "var(--ff-text-muted)" }}>
                Role
              </th>
              {directory.modules.map((module) => (
                <th key={module.id} className="py-2 px-2 text-center whitespace-nowrap" style={{ color: "var(--ff-text-muted)" }}>
                  {module.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {directory.roles.map((role) => (
              <tr key={role.id} style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
                <td
                  className="py-2 pr-3 font-semibold whitespace-nowrap sticky left-0"
                  style={{ background: "var(--ff-panel-bg)", color: "var(--ff-text-primary)" }}
                >
                  {role.name}
                </td>
                {directory.modules.map((module) => {
                  const grants = grantsByRoleModule.get(`${role.id}:${module.id}`) ?? new Set<string>();

                  if (!editMode) {
                    const abbrText = PERMISSION_ORDER.filter((p) => grants.has(p.id))
                      .map((p) => p.abbr)
                      .join("");
                    return (
                      <td key={module.id} className="py-2 px-2 text-center font-mono" style={{ color: "var(--ff-text-secondary)" }}>
                        {abbrText || <span style={{ color: "var(--ff-text-muted)" }}>—</span>}
                      </td>
                    );
                  }

                  return (
                    <td key={module.id} className="p-1 align-top">
                      <div className="grid grid-cols-3 gap-x-1.5 gap-y-0.5">
                        {PERMISSION_ORDER.map((p) => {
                          const key = grantKey(role.id, module.id, p.id);
                          const pending = pendingKeys.has(key);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-0.5 text-[0.62rem]"
                              style={{ color: "var(--ff-text-secondary)", opacity: pending ? 0.5 : 1 }}
                              title={p.id}
                            >
                              <input
                                type="checkbox"
                                checked={grants.has(p.id)}
                                disabled={pending}
                                onChange={(e) => handleToggle(role.id, module.id, p.id, e.target.checked)}
                              />
                              {p.abbr}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          R=Read, C=Create, U=Update, D=Delete, E=Execute, A=Administer.
          {editMode
            ? " Every checkbox here writes a real grant/revoke immediately — the same role_permission table every route's own server-side check reads per request, not a draft."
            : " Click \"Edit Permissions\" to change real grants directly."}
        </p>
      </div>
    </PanelCard>
  );
}
