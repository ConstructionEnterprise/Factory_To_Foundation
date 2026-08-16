import { useRef } from "react";

import { useCamera } from "@/framework/viewport";

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
  /** Real per-node free drag -- content-space delta, camera-zoom already divided out. */
  onDrag: (stageId: string, dx: number, dy: number) => void;
};

/** Below this real screen-pixel travel distance, a mousedown+mouseup is treated as a click, not a drag. */
const CLICK_DRAG_THRESHOLD_PX = 4;

/**
 * Real, schedule-aware, draggable function block (Phase 2.3 follow-up,
 * 2026-08-16 -- Joshua's real bug report: dragging a node was panning the
 * whole canvas instead of moving just that node, because the shared
 * <Viewport>'s own pan-drag listens on mousedown anywhere inside it).
 * Fix: this node's own mousedown stops propagation and runs its own real
 * drag loop, so a drag here never reaches Viewport's pan handler.
 */
export default function FunctionBlockNode({ stage, x, y, width, height, hasInput, hasOutput, active, onSelect, onDrag }: FunctionBlockNodeProps) {
  const { camera } = useCamera();
  const task = stage.tasks[0];
  const zoomRef = useRef(camera.zoom);
  zoomRef.current = camera.zoom;

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    let lastClientX = event.clientX;
    let lastClientY = event.clientY;
    let traveledPx = 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const screenDx = moveEvent.clientX - lastClientX;
      const screenDy = moveEvent.clientY - lastClientY;
      traveledPx += Math.hypot(screenDx, screenDy);
      lastClientX = moveEvent.clientX;
      lastClientY = moveEvent.clientY;
      onDrag(stage.id, screenDx / zoomRef.current, screenDy / zoomRef.current);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (traveledPx < CLICK_DRAG_THRESHOLD_PX) onSelect(stage);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`fb-node${active ? " fb-node--active" : ""}`}
      style={{ left: x, top: y, width, height }}
      onMouseDown={handleMouseDown}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect(stage);
      }}
    >
      <span className="fb-node-title">{stage.title}</span>
      <span className="fb-node-subtitle">{task ? task.status.replace(/_/g, " ") : "No real task"}</span>

      {hasInput && <span className="fb-node-pin fb-node-pin--input" style={{ top: height / 2 }} />}
      {hasOutput && <span className="fb-node-pin fb-node-pin--output" style={{ top: height / 2 }} />}
    </div>
  );
}
