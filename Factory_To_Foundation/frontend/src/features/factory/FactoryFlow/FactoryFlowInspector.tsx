import { PanelCard } from "@/framework/ui";

import { STATUS_LABEL as SEQUENCE_STATUS_LABEL } from "@/features/construction/Sequencing/SequencingPanel";
import type { FactoryFlow, FactoryFlowStageKey } from "../productionApi";

const STAGE_LABEL: Record<FactoryFlowStageKey, string> = {
  instructions_received: "Instructions Received",
  materials_received: "Materials Received",
  manufacturing: "Manufacturing / Assembly",
  production_complete: "Production Complete",
  logistics_handoff: "Logistics Handoff",
  modular_sequence: "Modular Sequence",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: "var(--ff-text-muted)" }}>{label}</span>
      <span style={{ color: "var(--ff-text-secondary)" }}>{value}</span>
    </div>
  );
}

function StageDetail({ flow, stage }: { flow: FactoryFlow; stage: FactoryFlowStageKey }) {
  if (stage === "instructions_received") {
    const s = flow.instructionsReceived;
    if (s.status === "unresolved") {
      return <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>{s.unresolvedReason}</p>;
    }
    return (
      <div className="space-y-1.5">
        <Row label="Generated" value={new Date(s.generatedAt!).toLocaleString()} />
        <Row label="Steps" value={`${s.executedSteps} / ${s.totalSteps} executed`} />
      </div>
    );
  }

  if (stage === "materials_received") {
    const s = flow.materialsReceived;
    if (s.report.lines.length === 0) return <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No real BOM lines on this run's assembly.</p>;
    return (
      <div className="space-y-2">
        {s.report.lines.map((line) => (
          <div key={line.costAssemblyComponentId} className="rounded-[0.2rem] p-2" style={{ background: "var(--ff-chrome-bg)" }}>
            <div className="text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>
              {line.materialCatalogItemName ?? "Unresolved BOM line"}
            </div>
            {line.requiredQuantity !== null ? (
              <div className="text-xs" style={{ color: line.sufficient ? "var(--ff-status-positive)" : "var(--ff-status-critical)" }}>
                {line.sufficient ? "✓" : "✕"} {line.requiredQuantity} req / {line.availableQuantity} avail
              </div>
            ) : (
              <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>{line.unresolvedReason}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (stage === "manufacturing") {
    const s = flow.manufacturing;
    return (
      <div className="space-y-1.5">
        <Row label="Status" value={s.status} />
        <Row label="Started" value={new Date(s.startedAt).toLocaleString()} />
        <Row label="Completed" value={s.completedAt ? new Date(s.completedAt).toLocaleString() : "--"} />
      </div>
    );
  }

  if (stage === "production_complete") {
    const s = flow.productionComplete;
    return (
      <div className="space-y-2">
        <Row label="Planned" value={s.plannedQuantity !== null ? String(s.plannedQuantity) : "--"} />
        {s.outputs.length === 0 && <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No real outputs produced yet.</p>}
        {s.outputs.map((o) => (
          <div key={o.id} className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--ff-text-secondary)" }}>{o.serialNumber}</span>
            <span style={{ color: "var(--ff-text-muted)" }}>
              {o.status} / {o.qcStatus}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (stage === "logistics_handoff") {
    const s = flow.logisticsHandoff;
    if (s.lines.length === 0) return <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No real completed outputs yet to hand off.</p>;
    return (
      <div className="space-y-2">
        {s.lines.map((line) => (
          <div key={line.productionOutputId} className="rounded-[0.2rem] p-2" style={{ background: "var(--ff-chrome-bg)" }}>
            <div className="text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>{line.serialNumber}</div>
            <div className="text-xs" style={{ color: line.status === "handed_off" ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
              {line.status === "handed_off" ? `✓ Handed off${line.dispatchStatus ? ` (dispatch: ${line.dispatchStatus})` : ""}` : "Not yet in Logistics"}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const s = flow.modularSequence;
  if (s.lines.length === 0) return <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No real completed outputs yet to sequence.</p>;
  return (
    <div className="space-y-2">
      {s.lines.map((line) => (
        <div key={line.productionOutputId} className="rounded-[0.2rem] p-2" style={{ background: "var(--ff-chrome-bg)" }}>
          <div className="text-xs font-semibold" style={{ color: "var(--ff-text-primary)" }}>{line.serialNumber}</div>
          <div className="text-xs" style={{ color: line.sequenceStatus === "complete" ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
            {line.sequenceStatus ? `${SEQUENCE_STATUS_LABEL[line.sequenceStatus]}` : "Not yet sequenced"}
          </div>
        </div>
      ))}
    </div>
  );
}

type FactoryFlowInspectorProps = {
  flow: FactoryFlow | null;
  selectedStage: FactoryFlowStageKey | null;
};

/** Real Selected Stage detail column (Phase 10, 2026-08-18) -- same PanelCard/DetailRow convention as every other Inspector in this app. */
export default function FactoryFlowInspector({ flow, selectedStage }: FactoryFlowInspectorProps) {
  return (
    <PanelCard title="Selected Stage" className="h-full" bodyClassName="flex-1 overflow-auto p-5">
      {!selectedStage && (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Click a stage on the Factory Flow map for its real detail.
        </p>
      )}
      {flow && selectedStage && (
        <>
          <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--ff-text-primary)" }}>
            {STAGE_LABEL[selectedStage]}
          </h2>
          <StageDetail flow={flow} stage={selectedStage} />
        </>
      )}
    </PanelCard>
  );
}
