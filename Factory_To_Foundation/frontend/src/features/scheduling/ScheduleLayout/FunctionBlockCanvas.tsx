import { useCamera } from "@/framework/viewport";

import FunctionBlockNode from "./FunctionBlockNode";
import type { ScheduleStageDetail } from "../scheduleApi";
import "./FunctionBlockCanvas.css";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 100;
export const NODE_GAP = 240;

type FunctionBlockCanvasProps = {
  /** Real, position-ordered stages for whichever schedule is currently selected. */
  stages: ScheduleStageDetail[];
  selectedId?: string;
  onSelectStage: (stage: ScheduleStageDetail) => void;
};

/**
 * Schedule-aware Scheduling FBD canvas (Phase 2.3, docs/decisions/
 * 2026-08-16-scheduling-phase2.3-frontend-wiring-plan.md §3/§5). Layout
 * is computed from each real stage's real `position`, not stored/
 * fabricated coordinates -- deterministic left-to-right spacing, same
 * constant the old 5-stage fixture used. Wires connect consecutive real
 * stages in real position order -- a real relationship already in the
 * data, not invented ports.
 */
export default function FunctionBlockCanvas({ stages, selectedId, onSelectStage }: FunctionBlockCanvasProps) {
  const { camera } = useCamera();

  const maxX = stages.length > 0 ? (stages.length - 1) * NODE_GAP + NODE_WIDTH : NODE_WIDTH;
  const maxY = NODE_HEIGHT;

  return (
    <div className="fb-canvas-root">
      <div
        className="fb-canvas-content"
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
      >
        <svg className="fb-canvas-wires" width={maxX} height={maxY}>
          {stages.slice(0, -1).map((stage, i) => {
            const next = stages[i + 1];
            return (
              <line
                key={`${stage.id}->${next.id}`}
                x1={i * NODE_GAP + NODE_WIDTH}
                y1={NODE_HEIGHT / 2}
                x2={(i + 1) * NODE_GAP}
                y2={NODE_HEIGHT / 2}
                className="fb-canvas-wire"
              />
            );
          })}
        </svg>

        {stages.map((stage, i) => (
          <FunctionBlockNode
            key={stage.id}
            stage={stage}
            x={i * NODE_GAP}
            y={0}
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            hasInput={i > 0}
            hasOutput={i < stages.length - 1}
            active={stage.id === selectedId}
            onSelect={onSelectStage}
          />
        ))}
      </div>
    </div>
  );
}
