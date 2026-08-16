import { useEffect, useState } from "react";

import { useCamera } from "@/framework/viewport";

import FunctionBlockNode from "./FunctionBlockNode";
import type { ScheduleStageDetail } from "../scheduleApi";
import "./FunctionBlockCanvas.css";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 100;
export const NODE_GAP = 240;

type Position = { x: number; y: number };

function basePositions(stages: ScheduleStageDetail[]): Record<string, Position> {
  return Object.fromEntries(stages.map((s, i) => [s.id, { x: i * NODE_GAP, y: 0 }]));
}

type FunctionBlockCanvasProps = {
  /** Real, position-ordered stages for whichever schedule is currently selected. */
  stages: ScheduleStageDetail[];
  selectedId?: string;
  onSelectStage: (stage: ScheduleStageDetail) => void;
};

/**
 * Schedule-aware, draggable Scheduling FBD canvas (Phase 2.3 + follow-up,
 * docs/decisions/2026-08-16-scheduling-phase2.3-frontend-wiring-plan.md
 * §3/§5). Base layout is computed from each real stage's real `position`
 * (deterministic left-to-right spacing, not stored/fabricated
 * coordinates); a real per-node drag then lets a node be moved
 * independently -- a pure view convenience (never persisted, resets to
 * the real computed layout whenever a different schedule's real stages
 * load), not a new real data concept. Wires read each node's *current*
 * (possibly dragged) position, so dragging one node visibly stretches
 * its connections rather than moving every node together.
 */
export default function FunctionBlockCanvas({ stages, selectedId, onSelectStage }: FunctionBlockCanvasProps) {
  const { camera } = useCamera();
  const [positions, setPositions] = useState<Record<string, Position>>(() => basePositions(stages));

  useEffect(() => {
    setPositions(basePositions(stages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.map((s) => s.id).join(",")]);

  const positionFor = (stage: ScheduleStageDetail, index: number): Position =>
    positions[stage.id] ?? { x: index * NODE_GAP, y: 0 };

  const handleDrag = (stageId: string, dx: number, dy: number) => {
    setPositions((prev) => {
      const current = prev[stageId] ?? { x: 0, y: 0 };
      return { ...prev, [stageId]: { x: current.x + dx, y: current.y + dy } };
    });
  };

  const allX = stages.flatMap((s, i) => {
    const p = positionFor(s, i);
    return [p.x, p.x + NODE_WIDTH];
  });
  const allY = stages.flatMap((s, i) => {
    const p = positionFor(s, i);
    return [p.y, p.y + NODE_HEIGHT];
  });
  const maxX = allX.length > 0 ? Math.max(...allX) : NODE_WIDTH;
  const maxY = allY.length > 0 ? Math.max(...allY) : NODE_HEIGHT;

  return (
    <div className="fb-canvas-root">
      <div
        className="fb-canvas-content"
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
      >
        <svg className="fb-canvas-wires" width={maxX} height={maxY}>
          {stages.slice(0, -1).map((stage, i) => {
            const next = stages[i + 1];
            const from = positionFor(stage, i);
            const to = positionFor(next, i + 1);
            return (
              <line
                key={`${stage.id}->${next.id}`}
                x1={from.x + NODE_WIDTH}
                y1={from.y + NODE_HEIGHT / 2}
                x2={to.x}
                y2={to.y + NODE_HEIGHT / 2}
                className="fb-canvas-wire"
              />
            );
          })}
        </svg>

        {stages.map((stage, i) => {
          const pos = positionFor(stage, i);
          return (
            <FunctionBlockNode
              key={stage.id}
              stage={stage}
              x={pos.x}
              y={pos.y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              hasInput={i > 0}
              hasOutput={i < stages.length - 1}
              active={stage.id === selectedId}
              onSelect={onSelectStage}
              onDrag={handleDrag}
            />
          );
        })}
      </div>
    </div>
  );
}
