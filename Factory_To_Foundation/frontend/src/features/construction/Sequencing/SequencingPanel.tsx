import { useEffect, useState } from "react";

import { PanelCard, StatusBadge, ToolbarButton, ToolbarSelect, type StatusTone } from "@/framework/ui";

import {
  createModuleSequenceEntry,
  fetchEligibleModules,
  fetchModuleSequences,
  updateModuleSequencePosition,
  type EligibleModule,
  type ModuleSequenceEntry,
  type ModuleSequenceStatus,
} from "./moduleSequenceApi";

export const STATUS_TONE: Record<ModuleSequenceStatus, StatusTone> = {
  pending: "neutral",
  site_arrival: "neutral",
  site_acceptance: "warning",
  installation: "warning",
  placement: "warning",
  complete: "positive",
};

type SequencingPanelProps = {
  projectId: string | null;
  selectedEntryId: string | null;
  onSelectEntry: (entry: ModuleSequenceEntry) => void;
  /** Bumped by the Inspector after a real status/dependency change, so this panel refetches without owning that write path itself. */
  refreshKey: number;
  /** Reports the real, freshly-loaded entry list up so the parent can hand it to the Timeliner/Inspector without a second fetch. */
  onEntriesLoaded: (entries: ModuleSequenceEntry[]) => void;
};

function groupByBuilding(entries: ModuleSequenceEntry[]): Map<string, ModuleSequenceEntry[]> {
  const groups = new Map<string, ModuleSequenceEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.buildingTitle) ?? [];
    list.push(entry);
    groups.set(entry.buildingTitle, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (a.sequencePosition ?? Infinity) - (b.sequencePosition ?? Infinity));
  }
  return groups;
}

/**
 * Real Modular Sequencing per-building module list (Phase 2.3, 2026-08-16
 * rollout). Entries only ever come from the real handoff-gated creation
 * path (§1 of the plan doc) -- the "add module" picker below only offers
 * real, delivered, not-yet-sequenced LogisticsModule rows, never a typed id.
 */
export default function SequencingPanel({ projectId, selectedEntryId, onSelectEntry, refreshKey, onEntriesLoaded }: SequencingPanelProps) {
  const [entries, setEntries] = useState<ModuleSequenceEntry[]>([]);
  const [eligible, setEligible] = useState<EligibleModule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!projectId) {
      setEntries([]);
      setEligible([]);
      onEntriesLoaded([]);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([fetchModuleSequences(projectId), fetchEligibleModules(projectId)])
      .then(([entryRows, eligibleRows]) => {
        setEntries(entryRows);
        setEligible(eligibleRows);
        onEntriesLoaded(entryRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [projectId, refreshKey]);

  const [showAdd, setShowAdd] = useState(false);
  const [pickedInventoryItemId, setPickedInventoryItemId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!projectId || !pickedInventoryItemId) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await createModuleSequenceEntry(projectId, pickedInventoryItemId);
      setPickedInventoryItemId("");
      setShowAdd(false);
      load();
      onSelectEntry(created);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  const handleReorder = async (entry: ModuleSequenceEntry, position: number | null) => {
    await updateModuleSequencePosition(entry.id, position);
    load();
  };

  const groups = groupByBuilding(entries);

  return (
    <PanelCard title="Modular Sequence" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      {!projectId && <p style={{ color: "var(--ff-text-muted)" }}>Select a project to see its real module sequence.</p>}

      {projectId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase" style={{ color: "var(--ff-text-muted)" }}>
              Real Entries
            </h3>
            <ToolbarButton onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Cancel" : "+ Add Module"}</ToolbarButton>
          </div>

          {showAdd && (
            <div className="space-y-2 rounded-lg p-3" style={{ border: "1px solid var(--ff-content-bg)" }}>
              {eligible.length === 0 && (
                <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                  No real modules are eligible yet -- a module must have a real, delivered dispatch before it can be sequenced.
                </p>
              )}
              {eligible.length > 0 && (
                <>
                  <ToolbarSelect value={pickedInventoryItemId} onChange={(e) => setPickedInventoryItemId(e.target.value)}>
                    <option value="">Select a real, delivered module…</option>
                    {eligible.map((m) => (
                      <option key={m.inventoryItemId} value={m.inventoryItemId}>
                        {m.title} {m.buildingTitle ? `(${m.buildingTitle})` : ""}
                      </option>
                    ))}
                  </ToolbarSelect>
                  {addError && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{addError}</p>}
                  <ToolbarButton onClick={handleAdd} disabled={adding || !pickedInventoryItemId}>
                    {adding ? "Adding…" : "Add to Sequence"}
                  </ToolbarButton>
                </>
              )}
            </div>
          )}

          {loading && <p style={{ color: "var(--ff-text-muted)" }}>Loading…</p>}
          {error && <p style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
          {!loading && !error && entries.length === 0 && (
            <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No real module sequence entries yet for this project.</p>
          )}

          {[...groups.entries()].map(([buildingTitle, groupEntries]) => (
            <div key={buildingTitle} className="space-y-2">
              <h4 className="text-xs font-semibold" style={{ color: "var(--ff-text-secondary)" }}>{buildingTitle}</h4>
              {groupEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => onSelectEntry(entry)}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition"
                  style={{ border: entry.id === selectedEntryId ? "1px solid var(--ff-accent)" : "1px solid var(--ff-content-bg)" }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }}>{entry.itemTitle}</div>
                    <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
                      {entry.blockedByCount > 0 ? `Blocked by ${entry.blockedByCount} entr${entry.blockedByCount === 1 ? "y" : "ies"}` : "No blockers"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      className="ff-toolbar-input w-16"
                      key={`${entry.id}-${entry.sequencePosition ?? "none"}`}
                      defaultValue={entry.sequencePosition ?? ""}
                      placeholder="#"
                      onBlur={(e) => {
                        const raw = e.target.value;
                        const next = raw === "" ? null : Number(raw);
                        if (next !== entry.sequencePosition) handleReorder(entry, next);
                      }}
                    />
                    <StatusBadge label={entry.status.replace(/_/g, " ")} tone={STATUS_TONE[entry.status]} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
