import { useNavigate } from "react-router-dom";

import { useSelection } from "@/context/SelectionContext";
import { DetailRow, PanelCard, StatusBadge, type StatusTone } from "@/framework/ui";

import { formatFactoryStatus } from "../twinTranslator";
import { useTwinManifest } from "../useTwinManifest";

const STATUS_TONE: Record<string, StatusTone> = {
  running: "positive",
  idle: "warning",
  down: "critical",
  unknown: "neutral",
};

export default function FactoryInspector() {
  const { selected, setSelected } = useSelection();
  const { connected } = useTwinManifest();
  const navigate = useNavigate();

  // Narrow to this feature's payload shape before reading it.
  const factorySelection =
    selected?.feature === "factory" ? selected : undefined;

  // Real robots carry a "robots.<name>" manifest id — that's the one cross-nav
  // signal, no separate "is this a robot" flag. Drives the "View Robot" button
  // that jumps to the Robotics tab isolated on this same real robot.
  const robotName = factorySelection?.objectId.startsWith("robots.")
    ? factorySelection.objectId.split(".")[1]
    : undefined;

  return (
    <PanelCard
      title="Selected Machine"
      className="h-full"
      bodyClassName="flex-1 overflow-auto p-5"
    >

      {/* Data-source indicator — reflects current bridge connectivity, not
          necessarily whether the item currently selected below came from
          live or fixture data (a first-slice simplification). */}
      <div className="mb-3 flex">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            connected
              ? { background: "var(--ff-status-positive)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
        >
          {connected ? "Live Twin Data" : "Sample Data — Twin Offline"}
        </span>
      </div>

      {/* Name */}

      <div className="mt-4">

        <h2 className="text-xl font-bold" style={{ color: "var(--ff-text-primary)" }}>
          {factorySelection?.payload.name ?? "Nothing Selected"}
        </h2>

        <p className="mt-1 font-semibold" style={{ color: "var(--ff-accent)" }}>
          {factorySelection?.objectType ?? "Select a machine"}
        </p>

      </div>

      {/* Status */}

      <div className="mt-4">
        {factorySelection ? (
          <StatusBadge
            label={formatFactoryStatus(factorySelection.payload.status)}
            tone={STATUS_TONE[factorySelection.payload.status]}
          />
        ) : (
          <StatusBadge label="—" tone="neutral" />
        )}
      </div>

      {/* Details */}

      <div className="mt-5 space-y-0.5">

        <DetailRow
          label="Cycle Time"
          value={factorySelection?.payload.cycleTime ?? "--"}
        />

        <DetailRow
          label="Utilization"
          value={factorySelection?.payload.utilization ?? "--"}
        />

        <DetailRow
          label="Operator"
          value={factorySelection?.payload.operator ?? "--"}
        />

        <DetailRow
          label="Maintenance"
          value={factorySelection?.payload.maintenance ?? "--"}
        />

        <DetailRow
          label="Alarms"
          value={factorySelection?.payload.alarms ?? "--"}
        />

        {factorySelection?.payload.liveState && (
          <DetailRow
            label="Live State"
            value={factorySelection.payload.liveState}
          />
        )}

      </div>

      {robotName && (
        <button
          type="button"
          onClick={() => {
            setSelected({
              feature: "robotics",
              objectType: "CR6 Robot",
              objectId: robotName,
              payload: { name: `Robot ${robotName}`, robotName },
            });
            navigate("/robotics");
          }}
          className="mt-5 w-full rounded-[0.2rem] px-3.5 py-2 text-sm font-medium text-white"
          style={{ background: "var(--ff-accent)" }}
          title={`Open Robot ${robotName} isolated in the Robotics tab with its live pose`}
        >
          View Robot {robotName} in Robotics →
        </button>
      )}

    </PanelCard>
  );
}
