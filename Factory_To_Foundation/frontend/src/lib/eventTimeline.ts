/**
 * Real shared math extracted from Construction's Timeliner
 * (features/construction/Sequencing/Timeliner.tsx), 2026-08-17 -- FF
 * Phase 2 interoperability work confirmed this lead/segments/trail
 * computation is genuinely generic over any real {changedAt, toStatus}
 * event stream, not specific to ModuleSequenceEvent. Timeliner itself now
 * calls these same functions (not a parallel reimplementation) so both
 * consumers share one real algorithm -- the second consumer
 * (DispatchTimeline, Scheduling) proves it generalizes rather than just
 * asserting it does.
 */

export type StatusEvent<TStatus extends string> = { changedAt: string; toStatus: TStatus };

export type TimelineSegment<TStatus extends string> = { status: TStatus; durationMs: number };

export type ComputedTimelineRow<TStatus extends string> = {
  leadMs: number;
  segments: TimelineSegment<TStatus>[];
  trailMs: number;
};

export function computeGlobalAxis(allEvents: { changedAt: string }[]): { globalMin: number; globalMax: number; span: number } {
  const globalMin = Math.min(...allEvents.map((e) => new Date(e.changedAt).getTime()));
  const globalMax = Math.max(Date.now(), ...allEvents.map((e) => new Date(e.changedAt).getTime()));
  return { globalMin, globalMax, span: Math.max(1, globalMax - globalMin) };
}

/**
 * `isTerminal` -- whether this row's real current state is a real closed/
 * final state (e.g. ModuleSequenceStatus "complete", LogisticsStatus
 * "delivered"). Terminal rows stop their last segment at their real last
 * event time; non-terminal rows extend their last segment to `globalMax`
 * (still ongoing "now"), same real distinction Timeliner already made.
 */
export function computeTimelineRow<TStatus extends string>(
  events: StatusEvent<TStatus>[],
  globalMin: number,
  globalMax: number,
  isTerminal: boolean
): ComputedTimelineRow<TStatus> | null {
  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  const times = sorted.map((e) => new Date(e.changedAt).getTime());
  const leadMs = Math.max(0, times[0]! - globalMin);

  const segments: TimelineSegment<TStatus>[] = sorted.slice(0, -1).map((ev, i) => ({
    status: ev.toStatus,
    durationMs: Math.max(1, times[i + 1]! - times[i]!),
  }));

  const lastEvent = sorted[sorted.length - 1]!;
  const lastTime = times[times.length - 1]!;
  const trailEnd = isTerminal ? lastTime : globalMax;
  segments.push({ status: lastEvent.toStatus, durationMs: Math.max(1, trailEnd - lastTime) });
  const trailMs = Math.max(0, globalMax - trailEnd);

  return { leadMs, segments, trailMs };
}
