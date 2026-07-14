import { useCamera } from "./CameraContext";
import EntityNode, { type EntityNodeData } from "./EntityNode";
import "./EntityCanvas.css";

type EntityEdge = {
  from: EntityNodeData;
  to: EntityNodeData;
};

type EntityCanvasProps = {
  nodes: EntityNodeData[];
  edges?: EntityEdge[];
  selectedId?: string;
  onSelectNode: (node: EntityNodeData) => void;
  renderStatusDot?: (node: EntityNodeData) => React.ReactNode;
};

/**
 * Generic camera-transformed world-space canvas — the shared shape
 * behind GraphCanvas and FactoryCanvas. Renders positioned EntityNodes
 * and optional connector edges between them. Any feature that just
 * needs "nodes in space, positioned by data, clickable" is a candidate
 * consumer instead of a bespoke canvas.
 */
export default function EntityCanvas({
  nodes,
  edges,
  selectedId,
  onSelectNode,
  renderStatusDot,
}: EntityCanvasProps) {
  const { camera } = useCamera();

  const maxX = Math.max(0, ...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(0, ...nodes.map((n) => n.y + n.height));

  return (
    <div className="entity-canvas-root">
      <div
        className="entity-canvas-content"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        {edges && edges.length > 0 && (
          <svg className="entity-canvas-edges" width={maxX} height={maxY}>
            {edges.map((edge) => (
              <line
                key={`${edge.from.id}->${edge.to.id}`}
                x1={edge.from.x + edge.from.width / 2}
                y1={edge.from.y + edge.from.height}
                x2={edge.to.x + edge.to.width / 2}
                y2={edge.to.y}
                className="entity-canvas-edge"
              />
            ))}
          </svg>
        )}

        {nodes.map((node) => (
          <EntityNode
            key={node.id}
            node={node}
            active={node.id === selectedId}
            onSelect={onSelectNode}
            statusDot={renderStatusDot?.(node)}
          />
        ))}
      </div>
    </div>
  );
}
