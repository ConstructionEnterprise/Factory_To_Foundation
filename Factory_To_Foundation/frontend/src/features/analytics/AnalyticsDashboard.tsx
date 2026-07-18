import { Suspense, useMemo } from "react";

import { PanelCard, StatusBadge } from "@/framework/ui";

import { useTwinManifest } from "@/features/factory/useTwinManifest";
import { useTwinState } from "@/features/factory/useTwinState";
import { translateManifest } from "@/features/factory/twinTranslator";

import { graphNodes, TIER_LABEL, TIER_ORDER } from "@/features/genealogy/graphData";
import { canBeFinishedProduct } from "@/features/genealogy/genealogyRegistry";

import { useGardenLoftsTree } from "@/features/manufacturing/gardenLoftsModel";

import { constructionProjects } from "@/features/construction/constructionData";

import { scheduleNodes, scheduleWires } from "@/features/scheduling/scheduleData";

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
  const { unitsByObjectName } = useGardenLoftsTree();
  const units = Array.from(unitsByObjectName.values());
  const flagged = units.filter((u) => u.flag).length;

  return (
    <div className="space-y-1.5">
      <Row label="Real ingested dwelling units" value={String(units.length)} />
      <Row label="Flagged (L14–20 unit-distribution defect)" value={String(flagged)} />
    </div>
  );
}

function ManufacturingWidget() {
  return (
    <PanelCard
      title="Manufacturing — Garden Lofts"
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
          value={String(scheduleNodes.filter((n) => n.ownedBy === "Not yet built").length)}
        />
      </div>
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
  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <FactoryWidget />
        <GenealogyWidget />
        <ManufacturingWidget />
        <ConstructionWidget />
        <SchedulingWidget />
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
