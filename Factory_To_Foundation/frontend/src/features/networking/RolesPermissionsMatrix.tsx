import { useEffect, useState } from "react";

import { PanelCard } from "@/framework/ui";
import { fetchRbacDirectory, type RbacDirectory } from "./rbacDirectoryApi";

/** Canonical display order/abbreviation for the 6 real seeded permission ids — matches backend/prisma/seed.ts's own R/C/U/D/E/A shorthand notation exactly, not invented here. */
const PERMISSION_ORDER: { id: string; abbr: string }[] = [
  { id: "read", abbr: "R" },
  { id: "create", abbr: "C" },
  { id: "update", abbr: "U" },
  { id: "delete", abbr: "D" },
  { id: "execute", abbr: "E" },
  { id: "administer", abbr: "A" },
];

/**
 * Real, read-only Roles & Permissions matrix (A3) — the actual seeded
 * Module/Role/Permission/RolePermission tables (10 roles, 12 modules
 * post-Phase-1, 166 real grant rows), not a mockup. Deliberately read-only:
 * the brief asked for "UI on RBAC that's already real," not an editor, and
 * a naive editable grid risks corrupting the real seeded grant matrix that
 * every other feature's server-side enforcement depends on.
 */
export default function RolesPermissionsMatrix() {
  const [directory, setDirectory] = useState<RbacDirectory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRbacDirectory()
      .then(setDirectory)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load RBAC directory"));
  }, []);

  if (error) {
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
    >
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
                  const grants = grantsByRoleModule.get(`${role.id}:${module.id}`);
                  const abbrText = grants
                    ? PERMISSION_ORDER.filter((p) => grants.has(p.id))
                        .map((p) => p.abbr)
                        .join("")
                    : "";
                  return (
                    <td key={module.id} className="py-2 px-2 text-center font-mono" style={{ color: "var(--ff-text-secondary)" }}>
                      {abbrText || <span style={{ color: "var(--ff-text-muted)" }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
          R=Read, C=Create, U=Update, D=Delete, E=Execute, A=Administer. Read-only view of the real
          seeded grant matrix — every route's actual enforcement lives server-side (
          <span className="font-mono">backend/src/middleware/auth.ts</span>), not here.
        </p>
      </div>
    </PanelCard>
  );
}
