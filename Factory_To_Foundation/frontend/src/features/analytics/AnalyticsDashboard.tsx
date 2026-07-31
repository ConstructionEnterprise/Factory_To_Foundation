import { Suspense, useEffect, useMemo, useState } from "react";

import { PanelCard, StatusBadge } from "@/framework/ui";

import { useTwinManifest } from "@/features/factory/useTwinManifest";
import { useTwinState } from "@/features/factory/useTwinState";
import { translateManifest } from "@/features/factory/twinTranslator";
import { listExecutionHistory, type InstructionExecutionHistoryEntry } from "@/features/factory/instructionExecutionsApi";

import { graphNodes, TIER_LABEL, TIER_ORDER } from "@/features/genealogy/graphData";
import { canBeFinishedProduct } from "@/features/genealogy/genealogyRegistry";

import { useManufacturingTree } from "@/features/manufacturing/manufacturingModel";

import { constructionProjects } from "@/features/construction/constructionData";

import { scheduleNodes, scheduleWires } from "@/features/scheduling/scheduleData";
import { fetchScheduleTaskDirectory, type ScheduleTaskDirectory } from "@/features/scheduling/scheduleTasksApi";
import { computeCriticalPath } from "./criticalPath";

/**
 * Real cross-feature dashboard — every number here is read from a data
 * source that already exists (the twin bridge, the real genealogy thread,
 * the real ingested Garden Lofts geometry, the real Construction project
 * tree, Scheduling's real function-block graph), never computed by a new
 * metrics layer invented for this page. Each card discloses what kind of
 * "real" it is — live twin data, real static project data, or real
 * structural facts that aren't live — the same disclosure discipline used
 * everywhere else in the app (Factory's live/fixture split, Robotics'
 * real-structure-fixture-values split).
 */

function FactoryWidget() {
  const { connected: manifestConnected, manifest } = useTwinManifest();
  const { state } = useTwinState();

  const liveNodes = useMemo(
    () => (manifestConnected && manifest ? translateManifest(manifest, state) : []),
    [manifestConnected, manifest, state]
  );

  const total = manifest?.length ?? 0;
  const running = liveNodes.filter((n) => n.node.status === "running").length;
  const idle = liveNodes.filter((n) => n.node.status === "idle").length;
  const unknown = liveNodes.filter((n) => n.node.status === "unknown").length;

  return (
    <PanelCard
      title="Factory — Digital Twin"
      toolbar={
        <StatusBadge
          label={manifestConnected ? "Live Twin Data" : "Twin Offline"}
          tone={manifestConnected ? "positive" : "neutral"}
        />
      }
    >
      {manifestConnected ? (
        <div className="space-y-1.5">
          <Row label="Real subsystems (manifest)" value={String(total)} />
          <Row label="Reporting live state.json data" value={`${total - unknown} / ${total}`} />
          <Row label="Running" value={String(running)} />
          <Row label="Idle" value={String(idle)} />
          <Row label="Unknown — no live data yet" value={String(unknown)} />
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Twin bridge not reachable — start `twin-bridge/server.mjs` (and the twin itself) to see
          real subsystem counts here. No fabricated numbers shown while offline.
        </p>
      )}
    </PanelCard>
  );
}

function GenealogyWidget() {
  const finishedProductCount = graphNodes.filter((n) => canBeFinishedProduct(n.tier)).length;

  return (
    <PanelCard
      title="Genealogy"
      toolbar={<StatusBadge label="Real Static Data" tone="neutral" />}
    >
      <div className="space-y-1.5">
        <Row label="Real nodes in thread" value={String(graphNodes.length)} />
        <Row label="Finished-product-capable" value={String(finishedProductCount)} />
        {TIER_ORDER.map((tier) => (
          <Row
            key={tier}
            label={TIER_LABEL[tier]}
            value={String(graphNodes.filter((n) => n.tier === tier).length)}
          />
        ))}
      </div>
    </PanelCard>
  );
}

function ManufacturingWidgetInner() {
  const tree = useManufacturingTree();
  const allNodes = Array.from(tree.nodesById.values());
  const withMetadata = allNodes.filter((n) => Object.keys(n.extras).length > 0).length;

  return (
    <div className="space-y-1.5">
      <Row label="Real nodes in loaded model" value={String(allNodes.length)} />
      <Row label="Nodes with real source metadata" value={String(withMetadata)} />
    </div>
  );
}

function ManufacturingWidget() {
  return (
    <PanelCard
      title="Manufacturing — Loaded Model"
      toolbar={<StatusBadge label="Real Ingested Geometry" tone="neutral" />}
    >
      <Suspense
        fallback={<p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>Loading geometry…</p>}
      >
        <ManufacturingWidgetInner />
      </Suspense>
    </PanelCard>
  );
}

function ConstructionWidget() {
  return (
    <PanelCard
      title="Construction"
      toolbar={<StatusBadge label="Real Static Data" tone="neutral" />}
    >
      <div className="space-y-1.5">
        <Row label="Real projects" value={String(constructionProjects.length)} />
        {constructionProjects.map((project) => {
          const childLabel = project.children?.[0]?.objectType ?? "—";
          const count = project.children?.length ?? 0;
          return (
            <Row
              key={project.id}
              label={project.title}
              value={`${count} ${childLabel}${count === 1 ? "" : "s"}`}
            />
          );
        })}
      </div>
    </PanelCard>
  );
}

function SchedulingWidget() {
  return (
    <PanelCard
      title="Scheduling"
      toolbar={<StatusBadge label="Structural Facts — Not Live" tone="neutral" />}
    >
      <div className="space-y-1.5">
        <Row label="Real pipeline stages" value={String(scheduleNodes.length)} />
        <Row label="Real port-to-port wires" value={String(scheduleWires.length)} />
        <Row
          label="Stages with no live data yet"
          value={String(scheduleNodes.filter((n) => n.ownedByModule === null).length)}
        />
      </div>
    </PanelCard>
  );
}

/**
 * Real hook shared by Production Output and Work Cell Performance — both
 * read the exact same InstructionExecution audit-trail rows (Phase 1's gap
 * closed), fetched once here rather than twice.
 */
function useInstructionExecutionHistory(): {
  rows: InstructionExecutionHistoryEntry[] | null;
  error: string | null;
} {
  const [rows, setRows] = useState<InstructionExecutionHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listExecutionHistory()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load execution history"));
  }, []);

  return { rows, error };
}

function ProductionOutputWidget({
  rows,
  error,
}: {
  rows: InstructionExecutionHistoryEntry[] | null;
  error: string | null;
}) {
  const ok = rows?.filter((r) => r.ok).length ?? 0;
  const failed = (rows?.length ?? 0) - ok;
  const mostRecent = rows && rows.length > 0 ? rows[0] : null; // already ordered executedAt desc by the backend

  return (
    <PanelCard
      title="Production Output"
      toolbar={<StatusBadge label="Real Execution Log" tone={rows && rows.length > 0 ? "positive" : "neutral"} />}
    >
      {error && (
        <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
      {!error && !rows && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Loading real execution history…
        </p>
      )}
      {!error && rows && rows.length === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real executions logged yet — Execute a step from Factory's Instructions menu to
          populate this (see backend/src/routes/instructionExecutions.ts).
        </p>
      )}
      {!error && rows && rows.length > 0 && (
        <div className="space-y-1.5">
          <Row label="Real executions logged" value={String(rows.length)} />
          <Row label="Succeeded" value={String(ok)} />
          <Row label="Failed" value={String(failed)} />
          {mostRecent && (
            <Row label="Most recent" value={new Date(mostRecent.executedAt).toLocaleString()} />
          )}
        </div>
      )}
    </PanelCard>
  );
}

function WorkCellPerformanceWidget({
  rows,
  error,
}: {
  rows: InstructionExecutionHistoryEntry[] | null;
  error: string | null;
}) {
  const bySubsystem = new Map<string, { total: number; ok: number }>();
  for (const row of rows ?? []) {
    const entry = bySubsystem.get(row.targetSubsystemId) ?? { total: 0, ok: 0 };
    entry.total += 1;
    if (row.ok) entry.ok += 1;
    bySubsystem.set(row.targetSubsystemId, entry);
  }

  return (
    <PanelCard
      title="Work Cell Performance — Equipment Utilization"
      toolbar={<StatusBadge label="Real Execution Log" tone={bySubsystem.size > 0 ? "positive" : "neutral"} />}
    >
      {error && (
        <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
      {!error && !rows && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Loading real execution history…
        </p>
      )}
      {!error && rows && bySubsystem.size === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real per-subsystem execution data yet — same real audit log Production Output reads,
          just empty so far.
        </p>
      )}
      {!error && bySubsystem.size > 0 && (
        <div className="space-y-1.5">
          {Array.from(bySubsystem.entries()).map(([subsystemId, stats]) => (
            <Row
              key={subsystemId}
              label={subsystemId}
              value={`${stats.ok}/${stats.total} succeeded`}
            />
          ))}
        </div>
      )}
    </PanelCard>
  );
}

function useScheduleTaskDirectory(): { directory: ScheduleTaskDirectory | null; error: string | null } {
  const [directory, setDirectory] = useState<ScheduleTaskDirectory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScheduleTaskDirectory()
      .then(setDirectory)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load schedule tasks"));
  }, []);

  return { directory, error };
}

function ScheduleCriticalPathWidget() {
  const { directory, error } = useScheduleTaskDirectory();

  const critical = useMemo(() => {
    if (!directory) return null;
    return computeCriticalPath(directory.tasks, directory.dependencies);
  }, [directory]);

  const onTimeCount =
    directory?.tasks.filter((t) => t.actualEnd && new Date(t.actualEnd) <= new Date(t.plannedEnd)).length ?? 0;
  const lateCount =
    directory?.tasks.filter((t) => t.actualEnd && new Date(t.actualEnd) > new Date(t.plannedEnd)).length ?? 0;

  return (
    <PanelCard
      title="Production Schedule Performance — Critical Path"
      toolbar={
        <StatusBadge
          label={directory && directory.tasks.length > 0 ? "Real Task Data" : "No Real Tasks Yet"}
          tone="neutral"
        />
      }
    >
      {error && (
        <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
      {!error && !directory && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Loading real schedule task data…
        </p>
      )}
      {!error && directory && directory.tasks.length === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real ScheduleTask rows exist yet (schema added Phase 1, no tasks created yet) — a real
          longest-path critical-path algorithm runs here the moment real tasks/dependencies exist,
          not a fabricated placeholder path.
        </p>
      )}
      {!error && directory && directory.tasks.length > 0 && critical && (
        <div className="space-y-1.5">
          <Row label="Real tasks" value={String(directory.tasks.length)} />
          <Row label="Real dependency edges" value={String(directory.dependencies.length)} />
          <Row label="On time (actual ≤ planned)" value={String(onTimeCount)} />
          <Row label="Late (actual > planned)" value={String(lateCount)} />
          <Row
            label="Critical path length"
            value={`${critical.path.length} tasks, ${(critical.totalDurationMs / 3_600_000).toFixed(1)}h`}
          />
        </div>
      )}
    </PanelCard>
  );
}

function DigitalTwinLifecycleWidget() {
  const { connected, manifest } = useTwinManifest();
  const { state } = useTwinState();

  const byType = new Map<string, number>();
  for (const entry of manifest ?? []) {
    byType.set(entry.type, (byType.get(entry.type) ?? 0) + 1);
  }

  return (
    <PanelCard
      title="Digital Twin Lifecycle"
      toolbar={<StatusBadge label={connected ? "Live Twin Data" : "Twin Offline"} tone={connected ? "positive" : "neutral"} />}
    >
      {connected && manifest ? (
        <div className="space-y-1.5">
          <Row label="Real mode" value={state?.mode ?? "unknown"} />
          <Row label="Paused" value={state?.paused ? "Yes" : "No"} />
          <Row label="Master phase" value={state?.master_phase ?? "unknown"} />
          {Array.from(byType.entries()).map(([type, count]) => (
            <Row key={type} label={`Subsystem type: ${type}`} value={String(count)} />
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Twin bridge not reachable — start `twin-bridge/server.mjs` (and the twin itself) to see
          real lifecycle data here.
        </p>
      )}
    </PanelCard>
  );
}

function QualityControlWidget() {
  const { connected, state } = useTwinState();
  const lastVerify = state?.last_tool_verify ?? null;

  return (
    <PanelCard
      title="Quality Control"
      toolbar={<StatusBadge label={connected ? "Live Twin Data" : "Twin Offline"} tone={connected ? "positive" : "neutral"} />}
    >
      {!connected ? (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Twin bridge not reachable — no fabricated pass-rate shown while offline.
        </p>
      ) : !lastVerify ? (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No <span className="font-mono">tool_verify</span> command has been dispatched yet in this
          session — this is a real single live record when one exists, never a trend (no
          historical log exists, same gap as the Robot History concept in gap #5).
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
            Real software comparison — no physical sensor exists behind this check.
          </p>
          <Row label="Robot" value={lastVerify.robot_id} />
          <Row label="Expected tool" value={lastVerify.expected} />
          <Row label="Actual tool" value={lastVerify.actual ?? "—"} />
          <Row label="Match" value={lastVerify.match ? "Yes" : "No"} />
          <Row label="Frame" value={String(lastVerify.frame)} />
          {lastVerify.note && <Row label="Note" value={lastVerify.note} />}
        </div>
      )}
    </PanelCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-xs" style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
      <span style={{ color: "var(--ff-text-muted)" }}>{label}</span>
      <span className="font-medium" style={{ color: "var(--ff-text-primary)" }}>{value}</span>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { rows: executionRows, error: executionError } = useInstructionExecutionHistory();

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <FactoryWidget />
        <GenealogyWidget />
        <ManufacturingWidget />
        <ConstructionWidget />
        <SchedulingWidget />
        <ProductionOutputWidget rows={executionRows} error={executionError} />
        <WorkCellPerformanceWidget rows={executionRows} error={executionError} />
        <ScheduleCriticalPathWidget />
        <DigitalTwinLifecycleWidget />
        <QualityControlWidget />
      </div>

      <p className="mt-6 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Logistics, Assets, and Robotics aren't shown here yet — their KPI values are fixture
        placeholders, not real, so a real-data dashboard doesn't surface them. Robotics' subsystem
        structure is real (seeded from the twin's own object model) but its live values still are
        not, same disclosure as Factory's page.
      </p>
    </div>
  );
}
