import { useEffect, useState } from "react";

import { Legend, PanelCard } from "@/framework/ui";

import { fetchModuleSequenceEvents, type ModuleSequenceEntry, type ModuleSequenceEvent, type ModuleSequenceStatus } from "./moduleSequenceApi";

const STATUS_COLOR: Record<ModuleSequenceStatus, string> = {
  pending: "var(--ff-status-neutral)",
  site_arrival: "var(--ff-status-neutral)",
  site_acceptance: "var(--ff-status-warning)",
  installation: "var(--ff-status-warning)",
  placement: "var(--ff-status-warning)",
  complete: "var(--ff-status-positive)",
};

const STATUS_ORDER: ModuleSequenceStatus[] = ["pending", "site_arrival", "site_acceptance", "installation", "placement", "complete"];

type TimelineRow = {
  entry: ModuleSequenceEntry;
  leadMs: number;
  segments: { status: ModuleSequenceStatus; durationMs: number }[];
  trailMs: number;
};

type TimelinerProps = {
  entries: ModuleSequenceEntry[];
};

/**
 * Real horizontal status-over-time view (Phase 2.3, docs/decisions/
 * 2026-08-16-modular-sequencing-plan.md §3.3) -- plots each entry's real
 * ModuleSequenceEvent transitions against a shared real time axis. No
 * spatial/geometric animation: there is no coordinate data to plot, only
 * discrete status transitions with real timestamps.
 */
export default function Timeliner({ entries }: TimelinerProps) {
  const [eventsByEntry, setEventsByEntry] = useState<Record<string, ModuleSequenceEvent[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) {
      setEventsByEntry({});
      return;
    }
    setError(null);
    Promise.all(entries.map((e) => fetchModuleSequenceEvents(e.id).then((events) => [e.id, events] as const)))
      .then((pairs) => setEventsByEntry(Object.fromEntries(pairs)))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [entries.map((e) => e.id).join(",")]);

  const allEvents = Object.values(eventsByEntry).flat();
  if (allEvents.length === 0) {
    return (
      <PanelCard title="Timeliner" className="mt-4" bodyClassName="p-5">
        {error && <p style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
        {!error && <p style={{ color: "var(--ff-text-muted)" }}>No real event history yet -- the timeline populates as entries transition status.</p>}
      </PanelCard>
    );
  }

  const globalMin = Math.min(...allEvents.map((e) => new Date(e.changedAt).getTime()));
  const globalMax = Math.max(Date.now(), ...allEvents.map((e) => new Date(e.changedAt).getTime()));
  const span = Math.max(1, globalMax - globalMin);

  const rows: TimelineRow[] = entries
    .map((entry) => {
      const events = [...(eventsByEntry[entry.id] ?? [])].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
      if (events.length === 0) return null;

      const times = events.map((e) => new Date(e.changedAt).getTime());
      const leadMs = times[0] - globalMin;
      const segments = events.slice(0, -1).map((ev, i) => ({
        status: ev.toStatus,
        durationMs: Math.max(1, times[i + 1] - times[i]),
      }));
      const lastEvent = events[events.length - 1];
      const lastTime = times[times.length - 1];
      const trailEnd = entry.status === "complete" ? lastTime : globalMax;
      segments.push({ status: lastEvent.toStatus, durationMs: Math.max(1, trailEnd - lastTime) });
      const trailMs = globalMax - trailEnd;

      return { entry, leadMs: Math.max(0, leadMs), segments, trailMs: Math.max(0, trailMs) };
    })
    .filter((row): row is TimelineRow => row !== null);

  return (
    <PanelCard title="Timeliner" className="mt-4" bodyClassName="p-5">
      <div className="mb-3 flex gap-4">
        {STATUS_ORDER.map((s) => (
          <Legend key={s} color={STATUS_COLOR[s]} label={s.replace(/_/g, " ")} />
        ))}
      </div>
      <div className="mb-2 flex justify-between text-xs" style={{ color: "var(--ff-text-muted)" }}>
        <span>{new Date(globalMin).toLocaleDateString()}</span>
        <span>{new Date(globalMax).toLocaleDateString()}</span>
      </div>
      <div className="space-y-2">
        {rows.map(({ entry, leadMs, segments, trailMs }) => (
          <div key={entry.id} className="flex items-center gap-3">
            <div className="w-32 shrink-0 truncate text-xs" style={{ color: "var(--ff-text-secondary)" }} title={entry.itemTitle}>
              {entry.itemTitle}
            </div>
            <div className="flex h-4 flex-1 overflow-hidden rounded" style={{ background: "var(--ff-content-bg)" }}>
              {leadMs > 0 && <div style={{ flexGrow: leadMs / span }} />}
              {segments.map((seg, i) => (
                <div
                  key={i}
                  style={{ flexGrow: seg.durationMs / span, background: STATUS_COLOR[seg.status] }}
                  title={`${seg.status.replace(/_/g, " ")} — ${Math.round(seg.durationMs / 3_600_000)}h`}
                />
              ))}
              {trailMs > 0 && <div style={{ flexGrow: trailMs / span }} />}
            </div>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}
