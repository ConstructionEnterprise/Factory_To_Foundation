import { useEffect, useState } from "react";

import { DetailRow, PanelCard, StatusBadge, ToolbarButton, ToolbarSelect } from "@/framework/ui";

import { STATUS_TONE } from "./SequencingPanel";
import {
  addModuleSequenceDependency,
  fetchModuleSequenceEvents,
  transitionModuleSequenceStatus,
  type ModuleSequenceEvent,
  type ModuleSequenceGraphEntry,
  type ModuleSequenceStatus,
} from "./moduleSequenceApi";

const VALID_TRANSITIONS: Record<ModuleSequenceStatus, ModuleSequenceStatus[]> = {
  pending: ["site_arrival"],
  site_arrival: ["site_acceptance"],
  site_acceptance: ["installation"],
  installation: ["placement"],
  placement: ["complete"],
  complete: [],
};

type SequencingInspectorProps = {
  entry: ModuleSequenceGraphEntry | null;
  otherEntries: ModuleSequenceGraphEntry[];
  onChanged: () => void;
};

/** Real selected-entry detail + status transition + dependency management (Phase 2.3, 2026-08-16 rollout). */
export default function SequencingInspector({ entry, otherEntries, onChanged }: SequencingInspectorProps) {
  const [events, setEvents] = useState<ModuleSequenceEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const [blockingEntryId, setBlockingEntryId] = useState("");
  const [depError, setDepError] = useState<string | null>(null);
  const [addingDep, setAddingDep] = useState(false);

  useEffect(() => {
    if (!entry) {
      setEvents([]);
      return;
    }
    setEventsError(null);
    fetchModuleSequenceEvents(entry.id)
      .then(setEvents)
      .catch((err) => setEventsError(err instanceof Error ? err.message : String(err)));
  }, [entry?.id, entry?.status]);

  const handleAdvance = async (toStatus: ModuleSequenceStatus) => {
    if (!entry) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      await transitionModuleSequenceStatus(entry.id, toStatus);
      onChanged();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : String(err));
    } finally {
      setTransitioning(false);
    }
  };

  const handleAddDependency = async () => {
    if (!entry || !blockingEntryId) return;
    setAddingDep(true);
    setDepError(null);
    try {
      await addModuleSequenceDependency(entry.id, blockingEntryId);
      setBlockingEntryId("");
      onChanged();
    } catch (err) {
      setDepError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingDep(false);
    }
  };

  const nextStatuses = entry ? VALID_TRANSITIONS[entry.status] : [];
  const dependencyCandidates = entry ? otherEntries.filter((e) => e.id !== entry.id) : [];

  return (
    <PanelCard title="Sequence Entry Detail" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      <div className="mt-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {entry?.itemTitle ?? "Nothing Selected"}
        </h2>
        {entry && (
          <div className="mt-1">
            <StatusBadge
              label={entry.status.replace(/_/g, " ")}
              tone={entry.effectiveState === "blocked" ? "critical" : STATUS_TONE[entry.status]}
            />
          </div>
        )}
      </div>

      {entry && (
        <>
          <div className="mt-5 space-y-0.5">
            <DetailRow label="Building" value={entry.buildingTitle} />
            <DetailRow label="Sequence Position" value={entry.sequencePosition !== null ? String(entry.sequencePosition) : "Unset"} />
            <DetailRow label="Blocked By (direct)" value={entry.blockedByCount > 0 ? `${entry.blockedByCount} real entr${entry.blockedByCount === 1 ? "y" : "ies"}` : "None"} />
            <DetailRow label="Source Dispatch" value={entry.sourceDispatchId ?? "--"} />
            <DetailRow label="Notes" value={entry.notes ?? "--"} />
            <DetailRow label="Created" value={new Date(entry.createdAt).toLocaleString()} />
          </div>

          {entry.effectiveState === "blocked" && (
            <div className="mt-5 rounded-lg p-3" style={{ border: "1px solid var(--ff-status-critical)" }}>
              <h3 className="text-xs font-semibold uppercase" style={{ color: "var(--ff-status-critical)" }}>Live Status -- Blocked</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--ff-text-secondary)" }}>
                Waiting on {entry.blockedByChain.length} real upstream entr{entry.blockedByChain.length === 1 ? "y" : "ies"} to reach complete, transitively:
              </p>
              <ul className="mt-1 list-disc pl-4 text-xs" style={{ color: "var(--ff-text-secondary)" }}>
                {entry.blockedByChain.map((id) => {
                  const blocker = otherEntries.find((e) => e.id === id);
                  return <li key={id}>{blocker ? `${blocker.itemTitle} (${blocker.status.replace(/_/g, " ")})` : id}</li>;
                })}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase" style={{ color: "var(--ff-text-muted)" }}>Advance Status</h3>
            {transitionError && <p className="mt-1 text-xs" style={{ color: "var(--ff-status-critical)" }}>{transitionError}</p>}
            <div className="mt-2 flex gap-2">
              {nextStatuses.length === 0 && (
                <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>This entry is complete -- no further real transitions.</p>
              )}
              {nextStatuses.map((s) => (
                <ToolbarButton
                  key={s}
                  onClick={() => handleAdvance(s)}
                  disabled={transitioning || entry.effectiveState === "blocked"}
                  title={entry.effectiveState === "blocked" ? "Blocked by a real, unresolved upstream entry -- see Live Status above." : undefined}
                >
                  {transitioning ? "Updating…" : `→ ${s.replace(/_/g, " ")}`}
                </ToolbarButton>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase" style={{ color: "var(--ff-text-muted)" }}>Add Blocking Dependency</h3>
            {dependencyCandidates.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: "var(--ff-text-muted)" }}>No other real entries in this project yet.</p>
            )}
            {dependencyCandidates.length > 0 && (
              <div className="mt-2 space-y-2">
                <ToolbarSelect value={blockingEntryId} onChange={(e) => setBlockingEntryId(e.target.value)}>
                  <option value="">Select a real entry that must complete first…</option>
                  {dependencyCandidates.map((e) => (
                    <option key={e.id} value={e.id}>{e.itemTitle} ({e.buildingTitle})</option>
                  ))}
                </ToolbarSelect>
                {depError && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{depError}</p>}
                <ToolbarButton onClick={handleAddDependency} disabled={addingDep || !blockingEntryId}>
                  {addingDep ? "Adding…" : "Add Dependency"}
                </ToolbarButton>
              </div>
            )}
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase" style={{ color: "var(--ff-text-muted)" }}>Real Event History</h3>
            {eventsError && <p className="mt-1 text-xs" style={{ color: "var(--ff-status-critical)" }}>{eventsError}</p>}
            {!eventsError && events.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: "var(--ff-text-muted)" }}>No events recorded yet.</p>
            )}
            <div className="mt-2 space-y-1.5">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--ff-text-secondary)" }}>
                    {ev.fromStatus ? `${ev.fromStatus.replace(/_/g, " ")} → ` : "Created as "}
                    {ev.toStatus.replace(/_/g, " ")}
                  </span>
                  <span style={{ color: "var(--ff-text-muted)" }}>{new Date(ev.changedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </PanelCard>
  );
}
