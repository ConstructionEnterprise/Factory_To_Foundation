import { useEffect, useState } from "react";

import { PanelCard, ToolbarButton, ToolbarInput, ToolbarSelect } from "@/framework/ui";
import { useAuth, usePermission } from "@/context/AuthContext";
import { fetchRbacDirectory, type RbacRole } from "./rbacDirectoryApi";
import * as api from "./userManagementApi";
import type { ManagedUser } from "./userManagementApi";

/**
 * Real User Management (A3) — real CRUD against backend/src/routes/users.ts,
 * replacing the manual create-user.ts CLI/psql workflow the brief names
 * directly. Every write control is gated the same UX/honesty way every
 * other real write control in this app is (usePermission) — real
 * enforcement is still the backend's requirePermission middleware.
 */
export default function UserManagementTable() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createPermission = usePermission("networking", "create");
  const updatePermission = usePermission("networking", "update");
  const deletePermission = usePermission("networking", "delete");

  function reload() {
    setError(null);
    Promise.all([api.listUsers(), fetchRbacDirectory()])
      .then(([userRows, directory]) => {
        setUsers(userRows);
        setRoles(directory.roles);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }

  useEffect(reload, []);

  return (
    <PanelCard
      title={`User Management — ${users?.length ?? "…"} Real Accounts`}
      toolbar={
        <ToolbarButton
          disabled={!createPermission.allowed}
          title={createPermission.reason}
          onClick={() => setCreating((c) => !c)}
        >
          {creating ? "Cancel" : "+ New User"}
        </ToolbarButton>
      }
    >
      {error && (
        <p className="mb-2 text-sm" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}

      {creating && (
        <CreateUserForm
          roles={roles}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
          onError={setError}
        />
      )}

      {!users ? (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Loading real accounts…
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--ff-panel-border)" }}>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                  Email
                </th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                  Display Name
                </th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                  Role
                </th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                  Created
                </th>
                <th className="py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  roles={roles}
                  isSelf={u.id === currentUser?.id}
                  editing={editingId === u.id}
                  onStartEdit={() => setEditingId(u.id)}
                  onCancelEdit={() => setEditingId(null)}
                  updatePermission={updatePermission}
                  deletePermission={deletePermission}
                  onChanged={() => {
                    setEditingId(null);
                    reload();
                  }}
                  onError={setError}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}

function CreateUserForm({
  roles,
  onCreated,
  onError,
}: {
  roles: RbacRole[];
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createUser({ email, displayName, password, roleId });
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 rounded-[0.2rem] p-3" style={{ border: "1px solid var(--ff-panel-border)" }}>
      <ToolbarInput required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <ToolbarInput required placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <ToolbarInput
        required
        type="password"
        placeholder="Password (min 8 chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <ToolbarSelect value={roleId} onChange={(e) => setRoleId(e.target.value)}>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </ToolbarSelect>
      <ToolbarButton type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create"}
      </ToolbarButton>
    </form>
  );
}

function UserRow({
  user,
  roles,
  isSelf,
  editing,
  onStartEdit,
  onCancelEdit,
  updatePermission,
  deletePermission,
  onChanged,
  onError,
}: {
  user: ManagedUser;
  roles: RbacRole[];
  isSelf: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  updatePermission: { allowed: boolean; reason: string | undefined };
  deletePermission: { allowed: boolean; reason: string | undefined };
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [roleId, setRoleId] = useState(user.roleId);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateUser(user.id, { displayName, roleId });
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.deleteUser(user.id);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
      <td className="py-2 pr-4" style={{ color: "var(--ff-text-primary)" }}>
        {user.email}
      </td>
      <td className="py-2 pr-4">
        {editing ? (
          <ToolbarInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        ) : (
          <span style={{ color: "var(--ff-text-primary)" }}>{user.displayName}</span>
        )}
      </td>
      <td className="py-2 pr-4">
        {editing ? (
          <ToolbarSelect value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </ToolbarSelect>
        ) : (
          <span style={{ color: "var(--ff-text-primary)" }}>{user.roleName}</span>
        )}
      </td>
      <td className="py-2 pr-4 whitespace-nowrap" style={{ color: "var(--ff-text-muted)" }}>
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="py-2">
        {editing ? (
          <div className="flex gap-2">
            <ToolbarButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </ToolbarButton>
            <ToolbarButton onClick={onCancelEdit}>Cancel</ToolbarButton>
          </div>
        ) : (
          <div className="flex gap-2">
            <ToolbarButton disabled={!updatePermission.allowed} title={updatePermission.reason} onClick={onStartEdit}>
              Edit
            </ToolbarButton>
            <ToolbarButton
              disabled={!deletePermission.allowed || isSelf}
              title={isSelf ? "You can't delete your own signed-in account from here." : deletePermission.reason}
              onClick={handleDelete}
            >
              Delete
            </ToolbarButton>
          </div>
        )}
      </td>
    </tr>
  );
}
