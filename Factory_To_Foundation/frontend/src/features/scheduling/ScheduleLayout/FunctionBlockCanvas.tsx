import { useCamera } from "@/framework/viewport";

import FunctionBlockNode from "./FunctionBlockNode";
import { getPortOffsetY, type FunctionBlockWire, type ScheduleNodeData } from "../scheduleData";
import "./FunctionBlockCanvas.css";

type FunctionBlockCanvasProps = {
  nodes: ScheduleNodeData[];
  wires: FunctionBlockWire[];
  selectedId?: string;
  onSelectNode: (node: ScheduleNodeData) => void;
};

/** World-space position of a named port's pin — the same geometry FunctionBlockNode uses to draw the pin itself, so a wire always lands exactly on it. */
function portWorldPosition(node: ScheduleNodeData, side: "input" | "output", portId: string) {
  const ports = side === "input" ? node.inputs : node.outputs;
  const index = ports.findIndex((p) => p.id === portId);
  return {
    x: side === "input" ? node.x : node.x + node.width,
    y: node.y + getPortOffsetY(node.height, index, ports.length),
  };
}

/**
 * The Scheduling-specific FBD canvas — reuses the shared camera engine
 * (framework/viewport's useCamera, same pan/zoom/fit as every other
 * feature) but wires connect exact named pins instead of generic
 * box-center-to-box-center lines. Bespoke rather than built on the
 * generic EntityCanvas: EntityCanvas's edges have no concept of ports,
 * and only Scheduling needs this shape today.
 */
export default function FunctionBlockCanvas({ nodes, wires, selectedId, onSelectNode }: FunctionBlockCanvasProps) {
  const { camera } = useCamera();

  const maxX = Math.max(0, ...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(0, ...nodes.map((n) => n.y + n.height));

  return (
    <div className="fb-canvas-root">
      <div
        className="fb-canvas-content"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        <svg className="fb-canvas-wires" width={maxX} height={maxY}>
          {wires.map((wire) => {
            const fromNode = nodes.find((n) => n.id === wire.fromNodeId);
            const toNode = nodes.find((n) => n.id === wire.toNodeId);
            if (!fromNode || !toNode) return null;

            const from = portWorldPosition(fromNode, "output", wire.fromPortId);
            const to = portWorldPosition(toNode, "input", wire.toPortId);

            return (
              <line
                key={`${wire.fromNodeId}.${wire.fromPortId}->${wire.toNodeId}.${wire.toPortId}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="fb-canvas-wire"
              />
            );
          })}
        </svg>

        {nodes.map((node) => (
          <FunctionBlockNode
            key={node.id}
            node={node}
            active={node.id === selectedId}
            onSelect={onSelectNode}
          />
        ))}
      </div>
    </div>
  );
}
