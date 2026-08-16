import { useState } from "react";

import { usePermission } from "@/context/AuthContext";
import { ToolbarButton, ToolbarInput, ToolbarSelect } from "@/framework/ui";

import { createDashboard, deleteDashboard, type AnalyticsDashboard } from "./analyticsDashboardsApi";

type DashboardPickerProps = {
  dashboards: AnalyticsDashboard[];
  selectedId: string;
  onSelect: (id: string) => void;
  onChanged: () => void;
  editing: boolean;
  onToggleEditing: () => void;
};

/**
 * Real dashboard select/create/delete toolbar (Phase 3.4, plan doc §5).
 * Create/delete are RBAC-gated in the UI; the default dashboard can never
 * be deleted here either -- the backend refuses it (§3.2's guard), this
 * just avoids offering a real 400 error to a real click.
 */
export default function DashboardPicker({ dashboards, selectedId, onSelect, onChanged, editing, onToggleEditing }: DashboardPickerProps) {
  const createPermission = usePermission("analytics", "create");
  const deletePermission = usePermission("analytics", "delete");
  const updatePermission = usePermission("analytics", "update");

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = dashboards.find((d) => d.id === selectedId);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createDashboard(newTitle.trim());
      setNewTitle("");
      setShowCreate(false);
      onChanged();
      onSelect(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || selected.isDefault) return;
    setBusy(true);
    setError(null);
    try {
      await deleteDashboard(selected.id);
      onChanged();
      const fallback = dashboards.find((d) => d.isDefault) ?? dashboards[0];
      if (fallback) onSelect(fallback.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <ToolbarSelect value={selectedId} onChange={(e) => onSelect(e.target.value)}>
        {dashboards.map((d) => (
          <option key={d.id} value={d.id}>{d.title}{d.isDefault ? " (Default)" : ""}</option>
        ))}
      </ToolbarSelect>

      <ToolbarButton onClick={onToggleEditing} disabled={!updatePermission.allowed} title={updatePermission.reason}>
        {editing ? "Done Editing" : "Edit Widgets"}
      </ToolbarButton>

      <ToolbarButton onClick={() => setShowCreate((v) => !v)} disabled={!createPermission.allowed} title={createPermission.reason}>
        {showCreate ? "Cancel" : "+ New Dashboard"}
      </ToolbarButton>

      {selected && !selected.isDefault && (
        <ToolbarButton onClick={handleDelete} disabled={!deletePermission.allowed || busy} title={deletePermission.reason}>
          Delete Dashboard
        </ToolbarButton>
      )}

      {showCreate && (
        <>
          <ToolbarInput placeholder="Dashboard title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <ToolbarButton onClick={handleCreate} disabled={busy || !newTitle.trim()}>
            {busy ? "Creating…" : "Create"}
          </ToolbarButton>
        </>
      )}

      {error && <span className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</span>}
    </div>
  );
}
