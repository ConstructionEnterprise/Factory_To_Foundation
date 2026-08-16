import { useSelection } from "@/context/SelectionContext";
import { BrowseList, PanelCard, type BrowseListItem } from "@/framework/ui";

import type { VehicleRecord } from "./fleetApi";

// Real, closed vehicle class set (Vehicle.vehicleClass, backend/prisma/schema.prisma) --
// only "truck" has any real rows today (see Vehicle model's doc comment).
const CLASS_ORDER = ["truck", "autonomous_dolly", "trailer", "forklift"];
const CLASS_LABEL: Record<string, string> = {
  truck: "Trucks",
  autonomous_dolly: "Autonomous Dollies",
  trailer: "Trailers",
  forklift: "Forklifts",
};

function toBrowseItems(vehicles: VehicleRecord[]): BrowseListItem[] {
  return CLASS_ORDER.filter((cls) => vehicles.some((v) => v.vehicleClass === cls)).map((cls) => ({
    id: `class-${cls}`,
    title: CLASS_LABEL[cls] ?? cls,
    children: vehicles.filter((v) => v.vehicleClass === cls).map((v) => ({ id: v.id, title: v.identifier })),
  }));
}

export default function FleetBrowse({ vehicles }: { vehicles: VehicleRecord[] }) {
  const { selected, setSelected } = useSelection();
  const activeId = selected?.feature === "fleet" ? selected.objectId : undefined;

  return (
    <PanelCard title="Browse Fleet" className="h-full">
      <BrowseList
        items={toBrowseItems(vehicles)}
        activeId={activeId}
        onSelect={(id) => {
          const vehicle = vehicles.find((v) => v.id === id);
          if (!vehicle) return;
          setSelected({
            feature: "fleet",
            objectType: CLASS_LABEL[vehicle.vehicleClass] ?? vehicle.vehicleClass,
            objectId: vehicle.id,
            payload: {
              name: vehicle.identifier,
              vehicleClass: vehicle.vehicleClass,
              status: vehicle.status,
              location: vehicle.location,
              logisticsTruckIdentifier: vehicle.logisticsTruckIdentifier,
            },
          });
        }}
      />
    </PanelCard>
  );
}
