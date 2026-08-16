import { Suspense, useEffect, useMemo, useState } from "react";

import { ErrorBoundary, PanelCard, StatusBadge } from "@/framework/ui";

import { useTwinManifest } from "@/features/factory/useTwinManifest";
import { useTwinState } from "@/features/factory/useTwinState";
import { translateManifest } from "@/features/factory/twinTranslator";
import { listExecutionHistory, type InstructionExecutionHistoryEntry } from "@/features/factory/instructionExecutionsApi";

import { TIER_LABEL, TIER_ORDER } from "@/features/genealogy/graphData";
import { ensureGenealogyGraphLoaded, useGenealogyGraph } from "@/features/genealogy/genealogyStore";
import { canBeFinishedProduct } from "@/features/genealogy/genealogyRegistry";

import { fetchAssets, type AssetRecord } from "@/features/assets/assetsApi";

import { useManufacturingTree } from "@/features/manufacturing/manufacturingModel";

import { constructionProjects } from "@/features/construction/constructionData";
import { fetchProjectRelationships, type ConstructionProjectRelationships } from "@/features/construction/DataMap/constructionDataMapApi";
import { fetchScenarios, type CostEstimateScenario } from "@/features/construction/CostEstimating/costEstimateApi";

import { listRecentCustodyEvents } from "@/features/logistics/logisticsOperationsApi";
import { fetchRecentScheduleEvents } from "@/features/scheduling/scheduleTasksApi";

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
  const { nodes: graphNodes } = useGenealogyGraph();

  useEffect(() => {
    ensureGenealogyGraphLoaded();
  }, []);

  const finishedProductCount = graphNodes.filter((n) => canBeFinishedProduct(n.tier)).length;

  return (
    <PanelCard
      title="Genealogy"
      toolbar={<StatusBadge label={graphNodes.length > 0 ? "Real Data" : "Loading…"} tone="neutral" />}
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

/**
 * Real Asset Catalog data — GET /assets, the same real `assetsApi.ts` the
 * Assets page itself uses. Added once the underlying Asset domain became
 * real (commit 025de8b, 30 real CE-Forge-seeded rows) — previously this
 * dashboard's own disclosure text called Assets a fixture placeholder,
 * which had gone stale relative to that commit.
 */
function useAssets(): { assets: AssetRecord[] | null; error: string | null } {
  const [assets, setAssets] = useState<AssetRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets()
      .then(setAssets)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load assets"));
  }, []);

  return { assets, error };
}

function AssetsWidget() {
  const { assets, error } = useAssets();

  const byCategory = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const a of assets ?? []) {
    byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + 1);
    byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
  }

  return (
    <PanelCard
      title="Assets"
      toolbar={<StatusBadge label={assets && assets.length > 0 ? "Real Data" : "No Assets Yet"} tone="neutral" />}
    >
      {error && (
        <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}
      {!error && !assets && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          Loading real asset data…
        </p>
      )}
      {!error && assets && assets.length === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real Asset rows exist yet — a real breakdown by category/status renders here the moment
          any exist, not a fabricated placeholder count.
        </p>
      )}
      {!error && assets && assets.length > 0 && (
        <div className="space-y-1.5">
          <Row label="Real assets" value={String(assets.length)} />
          {Array.from(byCategory.entries()).map(([category, count]) => (
            <Row key={category} label={`Category: ${category}`} value={String(count)} />
          ))}
          {Array.from(byStatus.entries()).map(([status, count]) => (
            <Row key={status} label={`Status: ${status}`} value={String(count)} />
          ))}
        </div>
      )}
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
      <ErrorBoundary label="Manufacturing widget">
        <Suspense
          fallback={<p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>Loading geometry…</p>}
        >
          <ManufacturingWidgetInner />
        </Suspense>
      </ErrorBoundary>
    </PanelCard>
  );
}

/**
 * Real per-project logistics context (Phase 1.3, 2026-08-16 rollout) --
 * reuses Construction Data Map's own real relationship route (§1 of
 * docs/decisions/2026-08-16-construction-data-map-cost-estimating-plan.md),
 * one real GET per real project (4 total), same "small, real, no concern
 * at this data scale" precedent as ConstructionProjects.tsx's own 4
 * per-project document fetches.
 */
function useConstructionRelationships(): { byProjectId: Map<string, ConstructionProjectRelationships>; error: string | null } {
  const [byProjectId, setByProjectId] = useState<Map<string, ConstructionProjectRelationships>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(constructionProjects.map((p) => fetchProjectRelationships(p.id)))
      .then((results) => setByProjectId(new Map(results.map((r) => [r.projectId, r]))))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real construction relationships"));
  }, []);

  return { byProjectId, error };
}

function ConstructionWidget() {
  const { byProjectId, error } = useConstructionRelationships();
  const loaded = byProjectId.size > 0;

  return (
    <PanelCard
      title="Construction"
      toolbar={<StatusBadge label={loaded ? "Real Data" : error ? "Error" : "Loading…"} tone={loaded ? "positive" : "neutral"} />}
    >
      {error && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
      <div className="space-y-1.5">
        <Row label="Real projects" value={String(constructionProjects.length)} />
        {constructionProjects.map((project) => {
          const rel = byProjectId.get(project.id);
          const childLabel = project.children?.[0]?.objectType ?? "—";
          const count = project.children?.length ?? 0;
          const dispatchCount = rel?.dispatches.length ?? 0;
          return (
            <Row
              key={project.id}
              label={project.title}
              value={`${count} ${childLabel}${count === 1 ? "" : "s"}${rel ? ` · ${dispatchCount} real dispatch${dispatchCount === 1 ? "" : "es"}` : ""}`}
            />
          );
        })}
      </div>
    </PanelCard>
  );
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Real Cost Estimating rollup (Phase 1.3, 2026-08-16 rollout) -- one real
 * GET per project via the same `costEstimateApi.ts` the Estimating ribbon
 * capability itself uses, no second read path. Shows nothing per project
 * with zero real scenarios rather than a fabricated placeholder range.
 */
function useCostEstimateScenarios(): { byProjectId: Map<string, CostEstimateScenario[]>; error: string | null } {
  const [byProjectId, setByProjectId] = useState<Map<string, CostEstimateScenario[]>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(constructionProjects.map((p) => fetchScenarios(p.id).then((scenarios) => [p.id, scenarios] as const)))
      .then((entries) => setByProjectId(new Map(entries)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real cost estimate scenarios"));
  }, []);

  return { byProjectId, error };
}

function CostEstimatingWidget() {
  const { byProjectId, error } = useCostEstimateScenarios();
  const loaded = byProjectId.size > 0;

  const projectsWithScenarios = constructionProjects.filter((p) => (byProjectId.get(p.id)?.length ?? 0) > 0);
  const totalScenarios = [...byProjectId.values()].reduce((sum, list) => sum + list.length, 0);

  return (
    <PanelCard
      title="Cost Estimating"
      toolbar={<StatusBadge label={loaded ? "Real Data" : error ? "Error" : "Loading…"} tone={loaded ? "positive" : "neutral"} />}
    >
      {error && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
      {loaded && totalScenarios === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
          No real cost estimate scenarios yet — create one from Construction's Estimating ribbon capability.
        </p>
      )}
      <div className="space-y-1.5">
        {totalScenarios > 0 && <Row label="Real scenarios" value={String(totalScenarios)} />}
        {projectsWithScenarios.map((project) => {
          const scenarios = byProjectId.get(project.id) ?? [];
          const totals = scenarios.map((s) => s.totalCents);
          const min = Math.min(...totals);
          const max = Math.max(...totals);
          const range = min === max ? formatDollars(min) : `${formatDollars(min)}–${formatDollars(max)}`;
          return <Row key={project.id} label={project.title} value={`${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"} · ${range}`} />;
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

type MergedEvent = { id: string; timestamp: string; label: string; detail: string };

/**
 * Real cross-domain Events feed (Phase 1.3, 2026-08-16 rollout) -- the
 * honestly-buildable slice of the CloudWatch-style observability proposal
 * (docs/decisions/2026-08-16-construction-data-map-cost-estimating-plan.md
 * §9): a real, timestamp-merged list across LogisticsCustodyEvent,
 * ScheduleTaskStatusEvent, and InstructionExecution (reused via the
 * `rows` prop -- the same fetch ProductionOutputWidget already made, not
 * re-fetched). A list, not a graph -- no charting library, no time-range
 * selector, no alarm state; those need real infrastructure this rollout
 * doesn't have yet, see §9.
 */
function useEvents(executionRows: InstructionExecutionHistoryEntry[] | null): { events: MergedEvent[] | null; error: string | null } {
  const [logisticsEvents, setLogisticsEvents] = useState<Awaited<ReturnType<typeof listRecentCustodyEvents>> | null>(null);
  const [scheduleEvents, setScheduleEvents] = useState<Awaited<ReturnType<typeof fetchRecentScheduleEvents>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRecentCustodyEvents()
      .then(setLogisticsEvents)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real logistics events"));
    fetchRecentScheduleEvents()
      .then(setScheduleEvents)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load real schedule events"));
  }, []);

  if (logisticsEvents === null || scheduleEvents === null || executionRows === null) {
    return { events: null, error };
  }

  const merged: MergedEvent[] = [
    ...logisticsEvents.map((e) => ({
      id: `logistics-${e.id}`,
      timestamp: e.changedAt,
      label: `Dispatch — ${e.truckIdentifier}`,
      detail: `${e.fromStatus ?? "created"} → ${e.toStatus}`,
    })),
    ...scheduleEvents.map((e) => ({
      id: `schedule-${e.id}`,
      timestamp: e.changedAt,
      label: `Task — ${e.taskTitle}`,
      detail: `${e.fromStatus ?? "created"} → ${e.toStatus}`,
    })),
    ...executionRows.map((e) => ({
      id: `execution-${e.id}`,
      timestamp: e.executedAt,
      label: `Execution — ${e.targetSubsystemId}`,
      detail: e.ok ? "succeeded" : "failed",
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { events: merged.slice(0, 15), error };
}

function EventsWidget({ executionRows }: { executionRows: InstructionExecutionHistoryEntry[] | null }) {
  const { events, error } = useEvents(executionRows);

  return (
    <PanelCard
      title="Events"
      toolbar={<StatusBadge label={events ? "Real Data" : error ? "Error" : "Loading…"} tone={events ? "positive" : "neutral"} />}
    >
      {error && <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>{error}</p>}
      {events && events.length === 0 && (
        <p className="text-xs" style={{ color: "var(--ff-text-muted)" }}>No real events logged yet across Logistics, Scheduling, or Factory.</p>
      )}
      <div className="space-y-1">
        {events?.map((e) => (
          <div key={e.id} className="flex items-center justify-between text-xs" style={{ borderBottom: "1px solid var(--ff-content-bg)", padding: "4px 0" }}>
            <span style={{ color: "var(--ff-text-primary)" }}>{e.label}</span>
            <span style={{ color: "var(--ff-text-muted)" }}>{e.detail} · {new Date(e.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </PanelCard>
  );
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
        <CostEstimatingWidget />
        <SchedulingWidget />
        <AssetsWidget />
        <EventsWidget executionRows={executionRows} />
        <ProductionOutputWidget rows={executionRows} error={executionError} />
        <WorkCellPerformanceWidget rows={executionRows} error={executionError} />
        <ScheduleCriticalPathWidget />
        <DigitalTwinLifecycleWidget />
        <QualityControlWidget />
      </div>

      <p className="mt-6 text-xs" style={{ color: "var(--ff-text-muted)" }}>
        Logistics and Robotics aren't shown here yet — their KPI values are fixture placeholders,
        not real, so a real-data dashboard doesn't surface them. Robotics' subsystem structure is
        real (seeded from the twin's own object model) but its live values still are not, same
        disclosure as Factory's page. Assets was in this same excluded list until its own domain
        became real (30 real CE-Forge-seeded rows) — it's now a real widget above, not fixture data.
      </p>
    </div>
  );
}
