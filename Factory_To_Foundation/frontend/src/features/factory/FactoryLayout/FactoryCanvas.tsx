import { useCamera } from "@/framework/viewport";

import FactoryNode from "./FactoryNode";
import type { FactoryNodeData } from "../twinTranslator";
import "./FactoryCanvas.css";

type FactoryCanvasProps = {
  nodes: FactoryNodeData[];
  selectedId?: string;
  onSelectNode: (node: FactoryNodeData) => void;
};

/**
 * The factory floor's world-space plane — positioned entirely by whichever
 * node array the caller passes (fixture or live-twin-translated), via CSS
 * transform, same pattern as the genealogy GraphCanvas. No Flexbox, no
 * Grid; the camera moves, the floor plan doesn't reflow.
 */
export default function FactoryCanvas({ nodes, selectedId, onSelectNode }: FactoryCanvasProps) {
  const { camera } = useCamera();

  return (
    <div className="factory-canvas-root">
      <div
        className="factory-canvas-content"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        {nodes.map((node) => (
          <FactoryNode
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
