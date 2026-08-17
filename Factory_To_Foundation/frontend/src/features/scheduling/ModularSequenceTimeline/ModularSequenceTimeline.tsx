import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Legend, PanelCard } from "@/framework/ui";
import { computeGlobalAxis, computeTimelineRow } from "@/lib/eventTimeline";

import { constructionProjects } from "@/features/construction/constructionData";
import {
  fetchModuleSequences,
  fetchModuleSequenceEvents,
  type ModuleSequenceEntry,
  type ModuleSequenceEvent,
  type ModuleSequenceStatus,
} from "@/features/construction/Sequencing/moduleSequenceApi";

const STATUS_COLOR: Record<ModuleSequenceStatus, string> = {
  pending: "var(--ff-status-neutral)",
  site_arrival: "var(--ff-status-neutral)",
  site_acceptance: "var(--ff-status-warning)",
  installation: "var(--ff-status-warning)",
  placement: "var(--ff-status-warning)",
  complete: "var(--ff-status-positive)",
};

const STATUS_ORDER: ModuleSequenceStatus[] = ["pending", "site_arrival", "site_acceptance", "installation", "placement", "complete"];

type Row = {
  entry: ModuleSequenceEntry;
  leadMs: number;
  segments: { status: ModuleSequenceStatus; durationMs: number }[];
  trailMs: number;
};

/**
 * Phase 2 interoperability, iteration 2 (2026-08-17): second real
 * consumer of both the shared `lib/eventTimeline.ts` math (proven generic
 * by Iteration 1's DispatchTimeline) and the "read-time projection, zero
 * owned rows" shape -- every entry/event here comes straight from
 * `moduleSequenceApi.ts`, the exact same module Construction's own
 * SequencingPanel/Timeliner use, refetched here, not duplicated.
 *
 * Real, disclosed limitation vs. Iteration 1: Construction's Sequencing
 * capability (unlike Logistics) has no `SelectionContext` participation
 * at all -- project/entry selection there is plain component-local
 * `useState` in ConstructionPage.tsx. Full "navigate + reselect" (landing
 * on the exact entry, pre-highlighted) isn't achievable without a larger,
 * separately-scoped rewire of that page. What IS real and shipped: a
 * minimal `?capability=sequencing&project=<id>` deep-link ConstructionPage
 * now reads once on mount -- clicking a row here lands the user on the
 * right project's Sequencing tab, not just navigate("/construction") and
 * leave them to find it. The specific entry still isn't pre-highlighted;
 * that gap is real, not papered over.
 */
export default function ModularSequenceTimeline() {
  const [entries, setEntries] = useState<ModuleSequenceEntry[] | null>(null);
  const [eventsByEntry, setEventsByEntry] = useState<Record<string, ModuleSequenceEvent[]>>({});
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all(constructionProjects.map((p) => fetchModuleSequences(p.id)))
      .then((byProject) => {
        const all = byProject.flat();
        setEntries(all);
        return Promise.all(all.map((e) => fetchModuleSequenceEvents(e.id).then((events) => [e.id, events] as const)));
      })
      .then((pairs) => pairs && setEventsByEntry(Object.fromEntries(pairs)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real Modular Sequence data"));
  }, []);

  function handleSelect(entry: ModuleSequenceEntry) {
    navigate(`/construction?capability=sequencing&project=${entry.constructionProjectId}`);
  }

  if (error) {
    return (
      <PanelCard title="Modular Sequences" className="h-full" bodyClassName="p-5">
        <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>
      </PanelCard>
    );
  }

  if (!entries) {
    return (
      <PanelCard title="Modular Sequences" className="h-full" bodyClassName="p-5">
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>Loading real module sequence entries…</p>
      </PanelCard>
    );
  }

  const allEvents = Object.values(eventsByEntry).flat();
  if (allEvents.length === 0) {
    return (
      <PanelCard title="Modular Sequences" className="h-full" bodyClassName="p-5">
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real module sequence events yet — this panel is a live read-only projection of Construction's own real data, nothing owned here.
        </p>
      </PanelCard>
    );
  }

  const { globalMin, globalMax, span } = computeGlobalAxis(allEvents);

  const rows: Row[] = entries
    .map((entry) => {
      const events = eventsByEntry[entry.id] ?? [];
      const computed = computeTimelineRow(events, globalMin, globalMax, entry.status === "complete");
      if (!computed) return null;
      return { entry, ...computed };
    })
    .filter((row): row is Row => row !== null);

  return (
    <PanelCard
      title="Modular Sequences"
      className="h-full"
      bodyClassName="p-5 overflow-auto"
      toolbar={<span className="text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>Read-only projection — authoritative in Construction</span>}
    >
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
            <button
              type="button"
              onClick={() => handleSelect(entry)}
              className="w-40 shrink-0 truncate text-left text-xs"
              style={{ color: "var(--ff-text-secondary)" }}
              title={`${entry.itemTitle} — click to view the authoritative entry in Construction's Sequencing tab`}
            >
              {entry.itemTitle}
            </button>
            <div
              className="flex h-4 flex-1 cursor-pointer overflow-hidden rounded"
              style={{ background: "var(--ff-content-bg)" }}
              onClick={() => handleSelect(entry)}
            >
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
