import { useEffect, useState } from "react";

import { useSelection } from "@/context/SelectionContext";
import { constructionProjects } from "@/features/construction/constructionData";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

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

export default function LogisticsBrowse() {
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
        payload: { kind: "material", name: material.name, quantity: material.quantity, location: material.location },
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
          dispatchedAt: dispatch.dispatchedAt,
        },
      });
    }
  }

  return (
    <PanelCard title="Browse Logistics" className="h-full">
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
    </PanelCard>
  );
}
