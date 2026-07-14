import type { ReactNode } from "react";
import "./EntityNode.css";

export type EntityNodeData = {
  id: string;
  title: string;
  subtitle: string;
  /** CSS color used for border/accent — callers pass a real color, not a Tailwind class, so this stays framework-agnostic. */
  accentColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type EntityNodeProps = {
  node: EntityNodeData;
  active: boolean;
  onSelect: (node: EntityNodeData) => void;
  /** Optional small status dot / badge rendered top-right of the card. */
  statusDot?: ReactNode;
};

/**
 * Generic absolutely-positioned, world-space node — the shared shape
 * behind Genealogy's GraphNode and Factory's FactoryNode. Any feature
 * with "a set of things laid out in space, click one to select it" is a
 * candidate consumer instead of writing its own node component.
 */
export default function EntityNode({ node, active, onSelect, statusDot }: EntityNodeProps) {
  return (
    <button
      type="button"
      className={`entity-node${active ? " entity-node--active" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        borderColor: node.accentColor,
      }}
      onClick={() => onSelect(node)}
    >
      {statusDot}
      <span className="entity-node-title">{node.title}</span>
      <span className="entity-node-subtitle">{node.subtitle}</span>
    </button>
  );
}
