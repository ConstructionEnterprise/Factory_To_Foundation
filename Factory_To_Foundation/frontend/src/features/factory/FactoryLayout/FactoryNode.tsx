import type { FactoryNodeData } from "../twinTranslator";
import "./FactoryNode.css";

type FactoryNodeProps = {
  node: FactoryNodeData;
  active: boolean;
  onSelect: (node: FactoryNodeData) => void;
};

export default function FactoryNode({ node, active, onSelect }: FactoryNodeProps) {
  return (
    <button
      type="button"
      className={`factory-node factory-node--${node.status}${
        active ? " factory-node--active" : ""
      }`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      onClick={() => onSelect(node)}
    >
      <span className="factory-node-status-dot"></span>
      <span className="factory-node-title">{node.title}</span>
      <span className="factory-node-subtitle">{node.subtitle}</span>
    </button>
  );
}
