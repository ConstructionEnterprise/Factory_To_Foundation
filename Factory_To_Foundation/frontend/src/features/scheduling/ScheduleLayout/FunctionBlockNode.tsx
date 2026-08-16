import type { ScheduleStageDetail } from "../scheduleApi";
import "./FunctionBlockNode.css";

type FunctionBlockNodeProps = {
  stage: ScheduleStageDetail;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Real sequence position, not stored port data -- the first real stage has no input pin, the last has no output pin. */
  hasInput: boolean;
  hasOutput: boolean;
  active: boolean;
  onSelect: (stage: ScheduleStageDetail) => void;
};

/**
 * Real, schedule-aware function block (Phase 2.3, docs/decisions/
 * 2026-08-16-scheduling-phase2.3-frontend-wiring-plan.md §5). Renders one
 * real ScheduleStage -- title + its real linked task's status. One
 * generic in/out pin per node (not the old fixture's named/typed BOOL
 * ports, which were only ever real for the 5 fixed global stages) --
 * a rendering convenience reflecting real sequence order, not a new real
 * data concept.
 */
export default function FunctionBlockNode({ stage, x, y, width, height, hasInput, hasOutput, active, onSelect }: FunctionBlockNodeProps) {
  const task = stage.tasks[0];

  return (
    <button
      type="button"
      className={`fb-node${active ? " fb-node--active" : ""}`}
      style={{ left: x, top: y, width, height }}
      onClick={() => onSelect(stage)}
    >
      <span className="fb-node-title">{stage.title}</span>
      <span className="fb-node-subtitle">{task ? task.status.replace(/_/g, " ") : "No real task"}</span>

      {hasInput && <span className="fb-node-pin fb-node-pin--input" style={{ top: height / 2 }} />}
      {hasOutput && <span className="fb-node-pin fb-node-pin--output" style={{ top: height / 2 }} />}
    </button>
  );
}
