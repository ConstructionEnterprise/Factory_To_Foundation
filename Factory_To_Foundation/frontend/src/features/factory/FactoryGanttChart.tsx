import { Fragment, useState } from "react";

import { useManufacturingOutput } from "@/context/ManufacturingOutputContext";
import { PanelCard } from "@/framework/ui";

// Illustrative pixel-per-second scale for bar widths — a layout choice,
// not a claim about real timing (see InstructionStep.estimatedDurationSec).
const PX_PER_SEC = 8;
const LABEL_COL_WIDTH = 200;
const RULER_TICK_SEC = 10;

/**
 * Factory's Gantt chart panel — same real generated instruction sequence
 * Factory's "Instructions" CommandRibbon dropdown (FactoryInstructions.tsx)
 * already shows, read from the same `useManufacturingOutput()` context,
 * not a second store. A persistent, spatial view alongside that dropdown,
 * not a replacement for it. Visual language (time ruler, one parent bar
 * for the whole sequence expandable into one child bar per step, bars
 * sized proportionally to duration) follows the Siemens Process Simulate
 * reference already on file.
 */
export default function FactoryGanttChart() {
  const { instructionSet } = useManufacturingOutput();
  const [expanded, setExpanded] = useState(true);

  if (!instructionSet || instructionSet.steps.length === 0) {
    return (
      <PanelCard title="Gantt Chart" className="h-full" bodyClassName="flex-1 overflow-auto p-3">
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          No instructions yet — generate them from Manufacturing.
        </p>
      </PanelCard>
    );
  }

  const steps = instructionSet.steps.slice().sort((a, b) => a.sequence - b.sequence);
  let cursor = 0;
  const positioned = steps.map((step) => {
    const start = cursor;
    cursor += step.estimatedDurationSec;
    return { step, start };
  });
  const totalDurationSec = cursor;
  const timelineWidth = Math.max(totalDurationSec * PX_PER_SEC, 200);

  const ticks: number[] = [];
  for (let t = 0; t <= totalDurationSec; t += RULER_TICK_SEC) ticks.push(t);
  if (ticks[ticks.length - 1] !== totalDurationSec) ticks.push(totalDurationSec);

  return (
    <PanelCard title="Gantt Chart" className="h-full" bodyClassName="flex flex-col flex-1 overflow-auto p-3">
      <div
        className="mb-3 rounded-[0.2rem] p-2 text-xs font-semibold"
        style={{ background: "var(--ff-status-warning)", color: "white" }}
      >
        Planning Draft — an illustrative planned sequence. Not real command_queue.json
        entries; nothing here executes or has ever been written to the twin. Bar widths
        reflect illustrative estimated durations, not measured timing.
      </div>

      <div className="mb-2 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Source: <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>{instructionSet.sourceObjectId}</span>
        {" · "}
        Generated {new Date(instructionSet.generatedAt).toLocaleTimeString()}
      </div>

      <div className="grid" style={{ gridTemplateColumns: `${LABEL_COL_WIDTH}px 1fr`, width: LABEL_COL_WIDTH + timelineWidth + 24 }}>
        {/* Ruler row */}
        <div />
        <div className="relative" style={{ height: 22, width: timelineWidth, borderBottom: "1px solid var(--ff-panel-border)" }}>
          {ticks.map((t) => (
            <div key={t} className="absolute top-0 text-[0.62rem]" style={{ left: t * PX_PER_SEC, color: "var(--ff-text-muted)" }}>
              <div style={{ width: 1, height: 6, background: "var(--ff-panel-border)" }} />
              <span className="ml-0.5">{t}s</span>
            </div>
          ))}
        </div>

        {/* Parent row — full sequence */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 py-2 text-left text-xs font-semibold"
          style={{ color: "var(--ff-text-primary)" }}
        >
          <span style={{ color: "var(--ff-text-muted)" }}>{expanded ? "▾" : "▸"}</span>
          Full Sequence ({totalDurationSec}s)
        </button>
        <div className="relative flex items-center" style={{ height: 32, width: timelineWidth }}>
          <div
            className="absolute rounded-[0.2rem]"
            style={{ left: 0, width: totalDurationSec * PX_PER_SEC, height: 16, background: "var(--ff-accent)" }}
          />
        </div>

        {/* Child rows — one per real step */}
        {expanded &&
          positioned.map(({ step, start }) => (
            <Fragment key={step.id}>
              <div
                className="truncate py-1.5 pl-5 text-xs"
                style={{ color: "var(--ff-text-primary)" }}
                title={step.action}
              >
                Step {step.sequence}: {step.targetSubsystemId} ({step.realCommandTarget})
              </div>
              <div className="relative flex items-center" style={{ height: 28, width: timelineWidth }}>
                <div
                  className="absolute rounded-[0.2rem]"
                  style={{
                    left: start * PX_PER_SEC,
                    width: Math.max(step.estimatedDurationSec * PX_PER_SEC, 3),
                    height: 14,
                    background: "var(--ff-status-neutral)",
                  }}
                  title={`${step.action} — ~${step.estimatedDurationSec}s (illustrative)`}
                />
              </div>
            </Fragment>
          ))}
      </div>
    </PanelCard>
  );
}
