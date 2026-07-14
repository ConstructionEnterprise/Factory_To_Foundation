import { NODE_HEIGHT, NODE_WIDTH, type GraphNodeData } from "../graphData";
import "./GraphNode.css";

type GraphNodeProps = {
  node: GraphNodeData;
  active: boolean;
  onSelect: (node: GraphNodeData) => void;
};

export default function GraphNode({ node, active, onSelect }: GraphNodeProps) {
  return (
    <button
      type="button"
      className={`graph-node graph-node--${node.tier}${
        active ? " graph-node--active" : ""
      }`}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }}
      onClick={() => onSelect(node)}
    >
      <span className="graph-node-title">{node.title}</span>
      <span className="graph-node-subtitle">{node.subtitle}</span>
    </button>
  );
}
