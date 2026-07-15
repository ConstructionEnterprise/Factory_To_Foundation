import { Fragment } from "react";

import { getPortOffsetY, type ScheduleNodeData } from "../scheduleData";
import "./FunctionBlockNode.css";

type FunctionBlockNodeProps = {
  node: ScheduleNodeData;
  active: boolean;
  onSelect: (node: ScheduleNodeData) => void;
};

/**
 * A single real function block: named, labeled pins on the left (inputs)
 * and right (outputs) edges, not just a plain box. Bespoke rather than
 * built on the generic EntityNode — same reasoning Genealogy's GraphNode
 * and Factory's FactoryNode stayed bespoke: EntityNode has no concept of
 * ports, and only Scheduling needs this shape today.
 */
export default function FunctionBlockNode({ node, active, onSelect }: FunctionBlockNodeProps) {
  return (
    <button
      type="button"
      className={`fb-node${active ? " fb-node--active" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      onClick={() => onSelect(node)}
    >
      <span className="fb-node-title">{node.title}</span>
      <span className="fb-node-subtitle">{node.subtitle}</span>

      {node.inputs.map((port, index) => {
        const y = getPortOffsetY(node.height, index, node.inputs.length);
        return (
          <Fragment key={port.id}>
            <span className="fb-node-pin fb-node-pin--input" style={{ top: y }} />
            <span className="fb-node-pin-label fb-node-pin-label--input" style={{ top: y }}>
              {port.label}
            </span>
          </Fragment>
        );
      })}

      {node.outputs.map((port, index) => {
        const y = getPortOffsetY(node.height, index, node.outputs.length);
        return (
          <Fragment key={port.id}>
            <span className="fb-node-pin fb-node-pin--output" style={{ top: y }} />
            <span className="fb-node-pin-label fb-node-pin-label--output" style={{ top: y }}>
              {port.label}
            </span>
          </Fragment>
        );
      })}
    </button>
  );
}
