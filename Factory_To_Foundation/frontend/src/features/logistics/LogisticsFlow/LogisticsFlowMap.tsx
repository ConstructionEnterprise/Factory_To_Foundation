import { useEffect, useMemo } from "react";
import { Background, Controls, MarkerType, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PanelCard } from "@/framework/ui";

import FlowMapNode, { type FlowMapNodeData } from "./FlowMapNode";
import * as api from "./logisticsFlowApi";
import {
  clearFlowSelection,
  ensureLogisticsFlowLoaded,
  loadLogisticsFlow,
  selectFlowConnection,
  selectFlowPoint,
  useLogisticsFlowState,
} from "./logisticsFlowStore";

const nodeTypes = { flowPoint: FlowMapNode };

/**
 * Real point-to-point map — @xyflow/react, same proven pattern as
 * Genealogy's RelationshipGraph.tsx (ReactFlowProvider wrapper, custom node
 * type, Background/Controls). Deliberately NOT a react-three-fiber
 * viewport like GeometryViewport/ConstructionMap/LogisticsMap — this is a
 * 2D relationship diagram, not a 3D scene or a real-geography map.
 *
 * Real, honest, minimum representation per the architecture decision this
 * was built against: real points, real directed connections with distance/
 * status, drag-to-reposition (persisted), click-to-inspect. No process
 * semantics, no capacity/timing/simulation — deliberately not built yet.
 *
 * Owns point-to-point movement relationships only — the things being
 * moved between (assets, dollies, yard/staging capabilities) stay owned by
 * their own domains and are referenced by id via FlowPoint.assetRef, never
 * duplicated here.
 */
function LogisticsFlowMapInner() {
  const { points, connections, loading, error, selection } = useLogisticsFlowState();
  const { fitView } = useReactFlow();

  useEffect(() => {
    ensureLogisticsFlowLoaded();
  }, []);

  const flowNodes: Node<FlowMapNodeData>[] = useMemo(
    () =>
      points.map((p) => ({
        id: p.id,
        type: "flowPoint",
        position: { x: p.positionX, y: p.positionY },
        selected: selection?.kind === "point" && selection.id === p.id,
        data: { name: p.name, type: p.type, status: p.status, assetRef: p.assetRef },
      })),
    [points, selection]
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      connections.map((c) => ({
        id: c.id,
        source: c.sourcePointId,
        target: c.targetPointId,
        selected: selection?.kind === "connection" && selection.id === c.id,
        label: c.distanceMeters != null ? `${c.distanceMeters} m` : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          stroke: selection?.kind === "connection" && selection.id === c.id ? "var(--ff-accent)" : "var(--ff-text-muted)",
          strokeWidth: selection?.kind === "connection" && selection.id === c.id ? 2.5 : 1.5,
        },
      })),
    [connections, selection]
  );

  async function handleNodeDragStop(_event: unknown, node: Node) {
    try {
      await api.updateFlowPoint(node.id, { positionX: node.position.x, positionY: node.position.y });
      await loadLogisticsFlow();
    } catch {
      // Real position-persist failure — reload restores the last known-good
      // server position rather than leaving a client-only drag that never
      // actually saved.
      await loadLogisticsFlow();
    }
  }

  return (
    <PanelCard title="Logistics Flow Map" className="h-full" bodyClassName="flex flex-col flex-1">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Drag a point to reposition it — position is saved automatically. Click a point or connection for detail.
        </span>
        <button
          type="button"
          onClick={() => fitView({ duration: 300 })}
          className="rounded px-2 py-1 text-[0.65rem] font-medium"
          style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
        >
          Fit View
        </button>
      </div>

      <div className="relative flex-1">
        {error && (
          <div className="absolute inset-x-0 top-0 z-10 px-4 py-2 text-xs font-medium" style={{ background: "var(--ff-status-critical)", color: "white" }}>
            Couldn't load real Logistics Flow data ({error})
          </div>
        )}
        {!loading && !error && points.length === 0 ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm" style={{ color: "var(--ff-text-muted)" }}>
            No flow points yet — add one from Browse Logistics Flow to start mapping.
          </div>
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_e, node) => selectFlowPoint(node.id)}
            onEdgeClick={(_e, edge) => selectFlowConnection(edge.id)}
            onPaneClick={() => clearFlowSelection()}
            onNodeDragStop={handleNodeDragStop}
            fitView
            nodesDraggable
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
    </PanelCard>
  );
}

export default function LogisticsFlowMap() {
  return (
    <ReactFlowProvider>
      <LogisticsFlowMapInner />
    </ReactFlowProvider>
  );
}
