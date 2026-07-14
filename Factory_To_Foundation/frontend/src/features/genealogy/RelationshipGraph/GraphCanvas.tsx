import { useCamera } from "@/framework/viewport";

import GraphEdge from "./GraphEdge";
import GraphNode from "./GraphNode";
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  getGraphBounds,
  graphEdges,
  graphNodes,
  type GraphNodeData,
} from "../graphData";
import "./GraphCanvas.css";

type GraphCanvasProps = {
  selectedId?: string;
  onSelectNode: (node: GraphNodeData) => void;
};

/**
 * The infinite (world-space) coordinate plane the graph lives on.
 * Positioned entirely with a CSS transform driven by the enclosing
 * Viewport's camera — never Flexbox, never Grid. The browser does not
 * decide where anything goes; graphData.ts does.
 */
export default function GraphCanvas({
  selectedId,
  onSelectNode,
}: GraphCanvasProps) {
  const { camera } = useCamera();
  const bounds = getGraphBounds();
  const nodeById = new Map(graphNodes.map((node) => [node.id, node]));

  return (
    <div className="graph-canvas-root">
      <div
        className="graph-canvas-content"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        <svg
          className="graph-edges"
          width={bounds.maxX + NODE_WIDTH}
          height={bounds.maxY + NODE_HEIGHT}
        >
          {graphEdges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;

            return (
              <GraphEdge
                key={`${edge.from}->${edge.to}`}
                from={{ x: from.x + NODE_WIDTH / 2, y: from.y + NODE_HEIGHT }}
                to={{ x: to.x + NODE_WIDTH / 2, y: to.y }}
              />
            );
          })}
        </svg>

        {graphNodes.map((node) => (
          <GraphNode
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
