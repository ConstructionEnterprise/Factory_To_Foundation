import { Handle, Position, type NodeProps } from "@xyflow/react";

import { NODE_HEIGHT, NODE_WIDTH, type GraphTier } from "../graphData";
import "./GenealogyFlowNode.css";

export type GenealogyFlowNodeData = {
  title: string;
  subtitle: string;
  tier: GraphTier;
  /** True when a node is selected elsewhere in the tree and this node is NOT on its real ancestor/descendant lineage — dims it instead of hiding it, so the real DAG shape stays visible. */
  dimmed: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  onToggleCollapse: (nodeId: string) => void;
};

/**
 * Real tier-colored node for the Relationship Explorer's react-flow graph
 * (A6) — same border-color-by-tier scheme the old bespoke GraphNode.tsx
 * used (GraphNode.css's real --ff-tier-* tokens), ported to a react-flow
 * node type rather than invented fresh. Handles are visually hidden
 * (style: opacity 0) but still required by react-flow to anchor edges at
 * a real top/bottom connection point, matching the old SVG edges' real
 * anchor-at-node-center-top/bottom behavior.
 */
export default function GenealogyFlowNode({ id, data, selected }: NodeProps & { data: GenealogyFlowNodeData }) {
  return (
    <div
      className={`genealogy-flow-node genealogy-flow-node--${data.tier}${selected ? " genealogy-flow-node--active" : ""}${data.dimmed ? " genealogy-flow-node--dimmed" : ""}`}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span className="genealogy-flow-node-title">{data.title}</span>
      <span className="genealogy-flow-node-subtitle">{data.subtitle}</span>
      {data.hasChildren && (
        <button
          type="button"
          className="genealogy-flow-node-collapse"
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleCollapse(id);
          }}
          title={data.collapsed ? "Expand this branch" : "Collapse this branch"}
        >
          {data.collapsed ? "▸" : "▾"}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
