import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useSelection } from "@/context/SelectionContext";
import { Legend, PanelCard } from "@/framework/ui";

import { graphEdges, graphNodes, NODE_HEIGHT, NODE_WIDTH, type GraphNodeData } from "../graphData";
import { getAncestorIds, getDescendantIds } from "../relationships";
import GenealogyFlowNode, { type GenealogyFlowNodeData } from "./GenealogyFlowNode";

const nodeTypes = { genealogy: GenealogyFlowNode };

/**
 * Real "Multi-Directional Relationship Explorer" graph (A6) — built fresh
 * (confirmed no prior work existed for this, per user sign-off), replacing
 * the old bespoke GraphNode/GraphCanvas/GraphEdge pair with react-flow:
 * real drag/pan/zoom, real DAG lineage highlighting (a selected node's
 * actual ancestors/descendants stay full-opacity, everything else dims —
 * never hides a node the DAG still connects to), real collapse/expand per
 * branch, and a real "isolate subtree" mode. Tier-colored styling and the
 * real x/y layout from graphData.ts both carry over unchanged.
 */
function RelationshipGraphInner() {
  const { selected, setSelected } = useSelection();
  const { setCenter, fitView } = useReactFlow();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isolate, setIsolate] = useState(false);

  const selectedId = selected?.feature === "genealogy" ? selected.objectId : undefined;

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of graphEdges) {
      if (!map.has(edge.from)) map.set(edge.from, []);
      map.get(edge.from)!.push(edge.to);
    }
    return map;
  }, []);

  const hiddenByCollapse = useMemo(() => {
    const hidden = new Set<string>();
    for (const collapsedId of collapsedIds) {
      for (const descendantId of getDescendantIds(collapsedId)) hidden.add(descendantId);
    }
    return hidden;
  }, [collapsedIds]);

  const lineageIds = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set<string>([selectedId]);
    for (const id of getAncestorIds(selectedId)) ids.add(id);
    for (const id of getDescendantIds(selectedId)) ids.add(id);
    return ids;
  }, [selectedId]);

  function handleSelectNode(node: GraphNodeData) {
    setSelected({
      feature: "genealogy",
      objectType: node.subtitle,
      objectId: node.id,
      payload: { name: node.title },
    });
  }

  function toggleCollapse(nodeId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  const visibleNodes = graphNodes.filter((n) => {
    if (hiddenByCollapse.has(n.id)) return false;
    if (isolate && lineageIds && !lineageIds.has(n.id)) return false;
    return true;
  });
  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  const flowNodes: Node<GenealogyFlowNodeData>[] = visibleNodes.map((node) => ({
    id: node.id,
    type: "genealogy",
    position: { x: node.x, y: node.y },
    selected: node.id === selectedId,
    data: {
      title: node.title,
      subtitle: node.subtitle,
      tier: node.tier,
      dimmed: !isolate && lineageIds !== null && !lineageIds.has(node.id),
      hasChildren: (childrenOf.get(node.id)?.length ?? 0) > 0,
      collapsed: collapsedIds.has(node.id),
      onToggleCollapse: toggleCollapse,
    },
  }));

  const flowEdges: Edge[] = graphEdges
    .filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))
    .map((edge) => {
      const onLineage = lineageIds !== null && lineageIds.has(edge.from) && lineageIds.has(edge.to);
      return {
        id: `${edge.from}->${edge.to}`,
        source: edge.from,
        target: edge.to,
        style: {
          stroke: onLineage || lineageIds === null ? "var(--ff-text-muted)" : "var(--ff-panel-border)",
          strokeWidth: onLineage && lineageIds !== null ? 2 : 1,
          opacity: lineageIds !== null && !onLineage ? 0.3 : 1,
        },
      };
    });

  function handleCenterSelected() {
    if (!selectedId) return;
    const node = graphNodes.find((n) => n.id === selectedId);
    if (!node) return;
    setCenter(node.x + NODE_WIDTH / 2, node.y + NODE_HEIGHT / 2, { zoom: 1.1, duration: 300 });
  }

  return (
    <PanelCard title="Relationship Graph" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="flex flex-wrap items-center gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color="var(--ff-tier-material)" label="Material" />
        <Legend color="var(--ff-tier-framing-package)" label="Framing-Package" />
        <Legend color="var(--ff-tier-component)" label="Component" />
        <Legend color="var(--ff-tier-subassembly)" label="Sub-Assembly" />
        <Legend color="var(--ff-tier-module)" label="Module" />
        <Legend color="var(--ff-tier-building)" label="Building" />
        <Legend color="var(--ff-tier-project)" label="Project" />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => fitView({ duration: 300 })}
            className="rounded px-2 py-1 text-[0.65rem] font-medium"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          >
            Reset View
          </button>
          <button
            type="button"
            onClick={handleCenterSelected}
            disabled={!selectedId}
            className="rounded px-2 py-1 text-[0.65rem] font-medium disabled:opacity-50"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          >
            Center Selected
          </button>
          <button
            type="button"
            onClick={() => setIsolate((v) => !v)}
            disabled={!selectedId}
            title={!selectedId ? "Select a node first" : "Show only this node's real ancestors and descendants"}
            className="rounded px-2 py-1 text-[0.65rem] font-medium disabled:opacity-50"
            style={{
              background: isolate ? "var(--ff-accent)" : "var(--ff-chrome-bg)",
              color: isolate ? "white" : "var(--ff-text-primary)",
            }}
          >
            {isolate ? "Showing Subtree Only" : "Isolate Subtree"}
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_event, node) => {
            const real = graphNodes.find((n) => n.id === node.id);
            if (real) handleSelectNode(real);
          }}
          fitView
          nodesConnectable={false}
          nodesDraggable
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </PanelCard>
  );
}

export default function RelationshipGraph() {
  return (
    <ReactFlowProvider>
      <RelationshipGraphInner />
    </ReactFlowProvider>
  );
}
