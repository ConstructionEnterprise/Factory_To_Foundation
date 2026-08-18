import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { usePermission } from "@/context/AuthContext";
import { constructionProjects } from "@/features/construction/constructionData";
import { BrowseList, PanelCard, ToolbarButton, type BrowseListItem } from "@/framework/ui";

import {
  listDispatches,
  listDrivers,
  listMaterials,
  listModules,
  listTrucks,
  type LogisticsDispatch,
  type LogisticsDriver,
  type LogisticsMaterial,
  type LogisticsModule,
  type LogisticsTruck,
} from "../logisticsOperationsApi";

/**
 * Real Browse Logistics panel (Phase 8) — replaces the old
 * logisticsData.ts fixture (6 hardcoded nodes) entirely. Groups into the
 * same real 4 zones Phase 1 confirmed (receiving/storage/yard/
 * transportation), but every leaf under Storage/Yard/Transportation is now
 * a real Postgres row (LogisticsMaterial/Module/Dispatch), not a fixture.
 *
 * Receiving stays a real, honest empty zone — no LogisticsReceiving model
 * exists anywhere in this codebase (confirmed, not assumed: Phase 4's own
 * schema comment says so explicitly), and nothing since has asked for one.
 * Shown as a real disclosed "no data source yet" leaf, not silently
 * omitted and not fabricated.
 *
 * Truck/Driver are real models too, but deliberately don't get their own
 * top-level Browse rows — every real dispatch already carries a resolved
 * truck identifier + driver name (looked up here, once, from the same
 * real lists this panel already fetches), which is what actually matters
 * operationally. This matches the original fixture's own shape (a
 * "Trailer" entry, not separate truck/driver browse rows) with real data
 * behind it now instead of invented status/destination strings.
 */

type LoadedData = {
  materials: LogisticsMaterial[];
  modules: LogisticsModule[];
  dispatches: LogisticsDispatch[];
  trucks: LogisticsTruck[];
  drivers: LogisticsDriver[];
};

function truckLabel(trucks: LogisticsTruck[], id: string): string {
  return trucks.find((t) => t.id === id)?.identifier ?? "Unknown truck";
}
function driverLabel(drivers: LogisticsDriver[], id: string): string {
  return drivers.find((d) => d.id === id)?.name ?? "Unknown driver";
}
function projectLabel(id: string): string {
  return constructionProjects.find((p) => p.id === id)?.title ?? id;
}
function moduleLocationLabel(m: LogisticsModule): string {
  return m.location ? m.location : "Location not recorded";
}

function buildBrowseItems(data: LoadedData): BrowseListItem[] {
  const materialItems: BrowseListItem[] =
    data.materials.length > 0
      ? data.materials.map((m) => ({ id: `material:${m.id}`, title: m.name }))
      : [{ id: "storage-empty", title: "No materials yet" }];

  const moduleItems: BrowseListItem[] =
    data.modules.length > 0
      ? data.modules.map((m) => ({ id: `module:${m.id}`, title: `${m.name} — ${moduleLocationLabel(m)}` }))
      : [{ id: "yard-empty", title: "No modules yet" }];

  const dispatchItems: BrowseListItem[] =
    data.dispatches.length > 0
      ? data.dispatches.map((d) => ({
          id: `dispatch:${d.id}`,
          title: `${truckLabel(data.trucks, d.truckId)} → ${projectLabel(d.destinationProjectId)}`,
        }))
      : [{ id: "transportation-empty", title: "No dispatches yet" }];

  return [
    {
      id: "zone-receiving",
      title: "Receiving",
      children: [{ id: "receiving-empty", title: "No real data source yet" }],
    },
    { id: "zone-storage", title: "Storage", children: materialItems },
    { id: "zone-yard", title: "Yard", children: moduleItems },
    { id: "zone-transportation", title: "Transportation", children: dispatchItems },
  ];
}

const EMPTY_LEAF_IDS = new Set(["receiving-empty", "storage-empty", "yard-empty", "transportation-empty"]);
const ZONE_HEADER_IDS = new Set(["zone-receiving", "zone-storage", "zone-yard", "zone-transportation"]);

type LogisticsBrowseProps = {
  /** Opens the real (provisional) Material-creation form — see LogisticsMaterialForm's own doc comment. */
  onNewMaterial?: () => void;
  /** Opens the real (provisional) Module-creation form — see LogisticsModuleForm's own doc comment. */
  onNewModule?: () => void;
  /** Opens the real (provisional) Dispatch-creation form — see LogisticsDispatchForm's own doc comment for why this still lives here rather than an inline Browse affordance. */
  onNewDispatch?: () => void;
  /** Opens the real (provisional) chain-of-custody tracker — see LogisticsDispatchTracker's own doc comment. */
  onTrackDispatches?: () => void;
  /** Opens the real, configurable mileage-rate manager — see MileageRateManager's own doc comment. */
  onMileageRate?: () => void;
};

/**
 * Real, narrow-column dispatch-specific action controls (Phase 10,
 * 2026-08-18) -- moved out of the ribbon's "Filters" dropdown into a real
 * "Dispatch" tab inside this panel's own header, mirroring
 * ManufacturingBrowse.tsx's Objects/Shop Drawings tab-toggle exactly
 * (`PanelCard`'s own `toolbar` prop). Deliberately real actions ONLY --
 * the old generic search/zone/status/Filters/Reset controls that used to
 * sit alongside these were confirmed decorative (no onClick/onChange
 * anywhere, same fate as every other placeholder toolbar removed this
 * phase) and are dropped here entirely, not relocated. Stacked
 * vertically, not ToolbarShell's horizontal flex-wrap row -- this lives
 * in a narrow sidebar column now, not a wide ribbon dropdown.
 */
function DispatchControls({ onNewMaterial, onNewModule, onNewDispatch, onTrackDispatches, onMileageRate }: LogisticsBrowseProps) {
  const createPermission = usePermission("logistics", "create");
  const readPermission = usePermission("logistics", "read");
  const updatePermission = usePermission("logistics", "update");

  return (
    <div className="flex flex-col gap-2 p-3">
      {onNewMaterial && (
        <ToolbarButton onClick={onNewMaterial} disabled={!createPermission.allowed} title={createPermission.reason}>
          + New Material
        </ToolbarButton>
      )}
      {onNewModule && (
        <ToolbarButton onClick={onNewModule} disabled={!createPermission.allowed} title={createPermission.reason}>
          + New Module
        </ToolbarButton>
      )}
      {onNewDispatch && (
        <ToolbarButton onClick={onNewDispatch} disabled={!createPermission.allowed} title={createPermission.reason}>
          + New Dispatch
        </ToolbarButton>
      )}
      {onTrackDispatches && (
        <ToolbarButton onClick={onTrackDispatches} disabled={!readPermission.allowed} title={readPermission.reason}>
          Track Dispatches
        </ToolbarButton>
      )}
      {onMileageRate && (
        <ToolbarButton onClick={onMileageRate} disabled={!updatePermission.allowed} title={updatePermission.reason}>
          Mileage Rate
        </ToolbarButton>
      )}
    </div>
  );
}

export default function LogisticsBrowse(props: LogisticsBrowseProps) {
  const [mode, setMode] = useState<"browse" | "dispatch">("browse");
  const { selected, setSelected } = useSelection();
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listMaterials(), listModules(), listDispatches(), listTrucks(), listDrivers()])
      .then(([materials, modules, dispatches, trucks, drivers]) => {
        setData({ materials, modules, dispatches, trucks, drivers });
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const activeId = (() => {
    if (selected?.feature !== "logistics") return undefined;
    // Real objectId already carries its own kind prefix (see onSelect below), so this round-trips exactly.
    return selected.objectId;
  })();

  function handleSelect(id: string) {
    if (!data || ZONE_HEADER_IDS.has(id) || EMPTY_LEAF_IDS.has(id)) return;

    const [kind, realId] = id.split(":");

    if (kind === "material") {
      const material = data.materials.find((m) => m.id === realId);
      if (!material) return;
      setSelected({
        feature: "logistics",
        objectType: "Material",
        objectId: id,
        payload: {
          kind: "material",
          name: material.name,
          quantityOnHand: material.quantityOnHand,
          quantityReserved: material.quantityReserved,
          quantityAvailable: material.quantityAvailable,
          location: material.location,
        },
      });
      return;
    }

    if (kind === "module") {
      const mod = data.modules.find((m) => m.id === realId);
      if (!mod) return;
      const dispatch = mod.dispatchId ? data.dispatches.find((d) => d.id === mod.dispatchId) : undefined;
      setSelected({
        feature: "logistics",
        objectType: "Module",
        objectId: id,
        payload: {
          kind: "module",
          name: mod.name,
          location: mod.location,
          dispatchId: mod.dispatchId,
          dispatchLabel: dispatch ? `${truckLabel(data.trucks, dispatch.truckId)} → ${projectLabel(dispatch.destinationProjectId)}` : null,
          dispatchStatus: dispatch?.status ?? null,
        },
      });
      return;
    }

    if (kind === "dispatch") {
      const dispatch = data.dispatches.find((d) => d.id === realId);
      if (!dispatch) return;
      setSelected({
        feature: "logistics",
        objectType: "Dispatch",
        objectId: id,
        payload: {
          kind: "dispatch",
          truckIdentifier: truckLabel(data.trucks, dispatch.truckId),
          driverName: driverLabel(data.drivers, dispatch.driverId),
          destinationTitle: projectLabel(dispatch.destinationProjectId),
          status: dispatch.status,
          route: dispatch.route,
          traffic: dispatch.traffic,
          eta: dispatch.eta,
          odometerStart: dispatch.odometerStart,
          odometerEnd: dispatch.odometerEnd,
          miles: dispatch.miles,
          businessPurpose: dispatch.businessPurpose,
          taxReportedAt: dispatch.taxReportedAt,
          dispatchedAt: dispatch.dispatchedAt,
        },
      });
    }
  }

  const toggle = (
    <div className="flex gap-1">
      {(["browse", "dispatch"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className="rounded-[0.2rem] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide"
          style={{
            background: mode === m ? "var(--ff-accent)" : "transparent",
            color: mode === m ? "white" : "var(--ff-text-muted)",
          }}
        >
          {m === "browse" ? "Browse" : "Dispatch"}
        </button>
      ))}
    </div>
  );

  return (
    <PanelCard title="Browse Logistics" toolbar={toggle} className="h-full">
      {mode === "dispatch" ? (
        <DispatchControls {...props} />
      ) : (
        <>
          {error && (
            <p className="p-3 text-xs" style={{ color: "var(--ff-status-critical)" }}>
              Couldn't load real Logistics data ({error}).
            </p>
          )}
          {!data && !error && (
            <p className="p-3 text-xs" style={{ color: "var(--ff-text-muted)" }}>
              Loading…
            </p>
          )}
          {data && <BrowseList items={buildBrowseItems(data)} activeId={activeId} onSelect={handleSelect} />}
        </>
      )}
    </PanelCard>
  );
}
