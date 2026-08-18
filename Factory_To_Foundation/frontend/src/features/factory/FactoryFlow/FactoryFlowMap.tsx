import { PanelCard } from "@/framework/ui";

import type { FactoryFlow, FactoryFlowStageKey } from "../productionApi";

const STAGE_ORDER: FactoryFlowStageKey[] = [
  "instructions_received",
  "materials_received",
  "manufacturing",
  "production_complete",
  "logistics_handoff",
];

const STAGE_LABEL: Record<FactoryFlowStageKey, string> = {
  instructions_received: "Instructions Received",
  materials_received: "Materials Received",
  manufacturing: "Manufacturing / Assembly",
  production_complete: "Production Complete",
  logistics_handoff: "Logistics Handoff",
};

type Tone = "positive" | "warning" | "critical" | "neutral";

const TONE_COLOR: Record<Tone, string> = {
  positive: "var(--ff-status-positive)",
  warning: "var(--ff-status-warning)",
  critical: "var(--ff-status-critical)",
  neutral: "var(--ff-status-neutral)",
};

/** Real per-stage tone -- green for a real terminal/good state, red only for the real current bottleneck, yellow for genuine in-between progress, grey for not started. */
function toneForStage(flow: FactoryFlow, stage: FactoryFlowStageKey): Tone {
  const isCurrent = flow.currentStage === stage;
  switch (stage) {
    case "instructions_received":
      if (flow.instructionsReceived.status === "resolved") return "positive";
      return isCurrent ? "critical" : "neutral";
    case "materials_received":
      if (flow.materialsReceived.status === "sufficient") return "positive";
      if (flow.materialsReceived.status === "insufficient") return isCurrent ? "critical" : "warning";
      return isCurrent ? "critical" : "neutral";
    case "manufacturing":
      if (flow.manufacturing.status === "complete") return "positive";
      return isCurrent ? "warning" : "neutral";
    case "production_complete": {
      const s = flow.productionComplete.status;
      if (s === "complete") return "positive";
      if (s === "partial") return "warning";
      return isCurrent ? "critical" : "neutral";
    }
    case "logistics_handoff": {
      const s = flow.logisticsHandoff.status;
      if (s === "complete") return "positive";
      if (s === "partial") return "warning";
      return isCurrent ? "critical" : "neutral";
    }
  }
}

type FactoryFlowMapProps = {
  flow: FactoryFlow | null;
  selectedStage: FactoryFlowStageKey | null;
  onSelectStage: (stage: FactoryFlowStageKey) => void;
};

/**
 * Real Factory Flow map (Phase 10, 2026-08-18) -- fixed 5-stage topology,
 * unlike Logistics Flow's own flexible/draggable FlowPoint graph, so this
 * is a pure read projection: Instructions Received -> Materials Received
 * -> Manufacturing/Assembly -> Production Complete -> Logistics Handoff.
 * Every node's real status comes from factoryFlowService.ts's projection
 * over existing Phase 5/8/9 records.
 */
export default function FactoryFlowMap({ flow, selectedStage, onSelectStage }: FactoryFlowMapProps) {
  return (
    <PanelCard title="Factory Flow" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      {!flow && <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>Select a real production run in Browse Runs.</p>}
      {flow && (
        <div className="mx-auto max-w-sm space-y-1">
          {STAGE_ORDER.map((stage, i) => {
            const tone = toneForStage(flow, stage);
            return (
              <div key={stage}>
                <button
                  onClick={() => onSelectStage(stage)}
                  className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left"
                  style={{
                    border: `1px solid ${stage === selectedStage ? "var(--ff-accent)" : "var(--ff-content-bg)"}`,
                    background: stage === flow.currentStage ? "var(--ff-chrome-bg)" : "transparent",
                  }}
                >
                  <span className="text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }}>
                    {STAGE_LABEL[stage]}
                  </span>
                  <span
                    className="rounded-[0.2rem] px-2 py-0.5 text-[0.65rem] font-semibold uppercase"
                    style={{ background: TONE_COLOR[tone], color: "white" }}
                  >
                    {stage === flow.currentStage ? "current" : tone === "positive" ? "done" : tone}
                  </span>
                </button>
                {i < STAGE_ORDER.length - 1 && (
                  <div className="pl-6 text-xs" style={{ color: "var(--ff-text-muted)" }}>
                    ↓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}
