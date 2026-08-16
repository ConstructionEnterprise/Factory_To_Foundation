import type { GraphEdgeData, GraphNodeData } from "./graphData";

function resolve(nodes: GraphNodeData[], ids: Iterable<string>): GraphNodeData[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const result: GraphNodeData[] = [];
  for (const id of ids) {
    const node = nodeById.get(id);
    if (node) result.push(node);
  }
  return result;
}

/** Real, direct parents — nodes with an outgoing edge into this one. A subassembly like ewp-03-s genuinely has 5 (4 material + 1 component), not 1 — never collapsed. */
export function getParents(nodes: GraphNodeData[], edges: GraphEdgeData[], nodeId: string): GraphNodeData[] {
  return resolve(nodes, edges.filter((e) => e.to === nodeId).map((e) => e.from));
}

/** Real, direct children — nodes this one has an outgoing edge into. */
export function getChildren(nodes: GraphNodeData[], edges: GraphEdgeData[], nodeId: string): GraphNodeData[] {
  return resolve(nodes, edges.filter((e) => e.from === nodeId).map((e) => e.to));
}

/** Real siblings — every other node sharing at least one direct parent with this one. A node with 5 real parents can have a different sibling set through each parent; this is the real union, not one parent's view. */
export function getSiblings(nodes: GraphNodeData[], edges: GraphEdgeData[], nodeId: string): GraphNodeData[] {
  const parentIds = edges.filter((e) => e.to === nodeId).map((e) => e.from);
  const siblingIds = new Set<string>();
  for (const parentId of parentIds) {
    for (const edge of edges) {
      if (edge.from === parentId && edge.to !== nodeId) siblingIds.add(edge.to);
    }
  }
  return resolve(nodes, siblingIds);
}

/** Every real ancestor (transitive closure up the DAG) — the full real lineage above this node, for lineage highlighting and subtree isolation. */
export function getAncestorIds(edges: GraphEdgeData[], nodeId: string): Set<string> {
  const result = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const edge of edges) {
      if (edge.to === current && !result.has(edge.from)) {
        result.add(edge.from);
        stack.push(edge.from);
      }
    }
  }
  return result;
}

/** Every real descendant (transitive closure down the DAG). */
export function getDescendantIds(edges: GraphEdgeData[], nodeId: string): Set<string> {
  const result = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const edge of edges) {
      if (edge.from === current && !result.has(edge.to)) {
        result.add(edge.to);
        stack.push(edge.to);
      }
    }
  }
  return result;
}
