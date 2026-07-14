type GraphEdgePoint = {
  x: number;
  y: number;
};

type GraphEdgeProps = {
  from: GraphEdgePoint;
  to: GraphEdgePoint;
};

/** A single connector line between two node anchor points, in world space. */
export default function GraphEdge({ from, to }: GraphEdgeProps) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      className="graph-edge"
    />
  );
}
