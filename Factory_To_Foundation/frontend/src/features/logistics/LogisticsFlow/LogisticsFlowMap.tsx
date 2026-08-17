import { useEffect, useMemo } from "react";
import { Background, Controls, MarkerType, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PanelCard } from "@/framework/ui";

import FlowMapNode, { STATUS_COLOR, type FlowMapNodeData } from "./FlowMapNode";
import { resolveFlowPointAsset, useFlowAssetLookups } from "./flowPointResolution";
import * as api from "./logisticsFlowApi";
import {
  clearFlowSelection,
  ensureLogisticsFlowLoaded,
  loadLogisticsFlow,
  pauseMonitor,
  refreshFlowGraph,
  resetMonitor,
  selectFlowConnection,
  selectFlowPoint,
  startMonitor,
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
  const { points, connections, loading, error, selection, selectedFlowId, graph, graphLoading, graphError, monitorRunning } =
    useLogisticsFlowState();
  const { fitView } = useReactFlow();
  const assetLookups = useFlowAssetLookups();

  useEffect(() => {
    ensureLogisticsFlowLoaded();
  }, []);

  // Stop any running live-monitor poll if this panel unmounts — a timer
  // must never keep hitting the backend for a view the user has left.
  useEffect(() => () => pauseMonitor(), []);

  useEffect(() => {
    if (selectedFlowId && graph) fitView({ duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFlowId, graph === null]);

  // Scoped to one real flow (Phase 5, 2026-08-17): render the live-monitor
  // graph (real status + blockage-propagated effectiveStatus) instead of
  // the unscoped cross-flow list. Falls back to the plain view when no
  // flow is selected, or while the very first graph fetch is in flight.
  // Looked up by id (rather than a type-narrowing "in" check) since the two
  // real point/connection shapes don't form a clean discriminated union.
  const scoped = Boolean(selectedFlowId && graph);
  const displayPoints = scoped ? graph!.points : points;
  const displayConnections = scoped ? graph!.connections : connections;
  const effectivePointById = useMemo(() => new Map((scoped ? graph!.points : []).map((p) => [p.id, p])), [scoped, graph]);
  const effectiveConnById = useMemo(() => new Map((scoped ? graph!.connections : []).map((c) => [c.id, c])), [scoped, graph]);

  const flowNodes: Node<FlowMapNodeData>[] = useMemo(
    () =>
      displayPoints.map((p) => ({
        id: p.id,
        type: "flowPoint",
        position: { x: p.positionX, y: p.positionY },
        selected: selection?.kind === "point" && selection.id === p.id,
        data: {
          name: p.name,
          type: p.type,
          status: p.status,
          effectiveStatus: effectivePointById.get(p.id)?.effectiveStatus,
          blockedBy: effectivePointById.get(p.id)?.blockedBy,
          assetRef: p.assetRef,
          resolvedAssetLabel: resolveFlowPointAsset(p.type, p.assetRef, assetLookups),
        },
      })),
    [displayPoints, selection, assetLookups, effectivePointById]
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      displayConnections.map((c) => {
        const isSelected = selection?.kind === "connection" && selection.id === c.id;
        const effectiveStatus = effectiveConnById.get(c.id)?.effectiveStatus;
        const statusColor = effectiveStatus ? STATUS_COLOR[effectiveStatus] : undefined;
        return {
          id: c.id,
          source: c.sourcePointId,
          target: c.targetPointId,
          selected: isSelected,
          label: c.distanceMeters != null ? `${c.distanceMeters} m` : undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: effectiveStatus === "halted",
          style: {
            stroke: statusColor ?? (isSelected ? "var(--ff-accent)" : "var(--ff-text-muted)"),
            strokeWidth: isSelected ? 2.5 : effectiveStatus && effectiveStatus !== "normal" ? 2.5 : 1.5,
          },
        };
      }),
    [displayConnections, selection, effectiveConnById]
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

      {selectedFlowId && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-2">
          <span
            className="rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide"
            style={{ background: monitorRunning ? "var(--ff-status-positive)" : "var(--ff-chrome-bg)", color: monitorRunning ? "white" : "var(--ff-text-muted)" }}
          >
            {monitorRunning ? "● Live" : "Live Monitor"}
          </span>
          {!monitorRunning ? (
            <button
              type="button"
              onClick={() => startMonitor()}
              className="rounded px-2 py-1 text-[0.65rem] font-medium"
              style={{ background: "var(--ff-accent)", color: "white" }}
            >
              ▶ Run
            </button>
          ) : (
            <button
              type="button"
              onClick={() => pauseMonitor()}
              className="rounded px-2 py-1 text-[0.65rem] font-medium"
              style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
            >
              ⏸ Pause
            </button>
          )}
          <button
            type="button"
            onClick={() => void refreshFlowGraph()}
            disabled={graphLoading}
            className="rounded px-2 py-1 text-[0.65rem] font-medium disabled:opacity-50"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          >
            {graphLoading ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button
            type="button"
            onClick={() => resetMonitor()}
            title="Returns the viewport to current authoritative state. Never deletes real status history."
            className="rounded px-2 py-1 text-[0.65rem] font-medium"
            style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-primary)" }}
          >
            ↺ Reset
          </button>
          <span className="ml-auto text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
            Reflects real linked equipment/dispatch state + recorded holds — not a simulation.
          </span>
        </div>
      )}

      <div className="relative flex-1">
        {error && (
          <div className="absolute inset-x-0 top-0 z-10 px-4 py-2 text-xs font-medium" style={{ background: "var(--ff-status-critical)", color: "white" }}>
            Couldn't load real Logistics Flow data ({error})
          </div>
        )}
        {graphError && (
          <div className="absolute inset-x-0 top-0 z-10 px-4 py-2 text-xs font-medium" style={{ background: "var(--ff-status-critical)", color: "white" }}>
            Couldn't load real live-monitor state ({graphError})
          </div>
        )}
        {selectedFlowId && !graph && graphLoading ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm" style={{ color: "var(--ff-text-muted)" }}>
            Loading live monitor…
          </div>
        ) : !loading && !error && displayPoints.length === 0 ? (
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
