import type { Bounds, EntityNodeData } from "@/framework/viewport";

export type AssetStatus = "active" | "maintenance" | "retired";
export type AssetCategory = "Vehicles" | "Equipment" | "Tools" | "Infrastructure";

export type AssetNodeData = {
  id: string;
  title: string;
  subtitle: string;
  category: AssetCategory;
  family: string;
  status: AssetStatus;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  location: string;
  acquisitionDate: string;
  lastService: string;
  /** Real absence, never a placeholder string -- null for a retired asset with no next service scheduled. */
  nextService: string | null;
  notes: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AssetSummary = {
  total: number;
  active: number;
  maintenance: number;
  retired: number;
};

const STATUS_COLOR: Record<AssetStatus, string> = {
  active: "#22c55e",
  maintenance: "#f59e0b",
  retired: "#9ca3af",
};

type AssetSeed = Omit<AssetNodeData, "x" | "y" | "width" | "height">;

const assetSeeds: AssetSeed[] = [
  { id: "semi-truck-01", title: "Semi Truck 01", subtitle: "Fleet / Transportation", category: "Vehicles", family: "Fleet / Transportation", status: "active", manufacturer: "Freightliner", model: "Cascadia 126", serialNumber: "CE-TRK-1001", assetTag: "CE-VEH-001", location: "Logistics Yard", acquisitionDate: "March 12, 2024", lastService: "May 14, 2026", nextService: "September 14, 2026", notes: "Primary outbound haul tractor assigned to project and module deliveries." },
  { id: "flatbed-trailer-01", title: "Flatbed Trailer 01", subtitle: "Fleet / Transportation", category: "Vehicles", family: "Fleet / Transportation", status: "maintenance", manufacturer: "Fontaine", model: "Magnitude 53' Flatbed", serialNumber: "CE-TRL-1002", assetTag: "CE-VEH-002", location: "Logistics Yard", acquisitionDate: "May 8, 2023", lastService: "June 20, 2026", nextService: "July 3, 2026", notes: "Seasonal brake inspection and deck repair." },
  { id: "module-transport-trailer-01", title: "Module Transport Trailer 01", subtitle: "Fleet / Transportation", category: "Vehicles", family: "Fleet / Transportation", status: "active", manufacturer: "Trail King", model: "Step-Deck Transport", serialNumber: "CE-TRL-1003", assetTag: "CE-VEH-003", location: "Module Staging Yard", acquisitionDate: "August 30, 2024", lastService: "April 28, 2026", nextService: "October 28, 2026", notes: "Dedicated to wide-load module transport between yard and site." },
  { id: "yard-truck-01", title: "Yard Truck 01", subtitle: "Fleet / Transportation", category: "Vehicles", family: "Fleet / Transportation", status: "active", manufacturer: "TICO", model: "Pro-Spotter", serialNumber: "CE-TRK-1004", assetTag: "CE-VEH-004", location: "Logistics Yard", acquisitionDate: "January 10, 2024", lastService: "June 5, 2026", nextService: "December 5, 2026", notes: "Yard spotter used for trailer staging and dock moves." },
  { id: "ce-service-truck-01", title: "CE Service Truck 01", subtitle: "Fleet / Transportation", category: "Vehicles", family: "Fleet / Transportation", status: "active", manufacturer: "Ford", model: "F-550 Service Body", serialNumber: "CE-TRK-1005", assetTag: "CE-VEH-005", location: "Maintenance Shop", acquisitionDate: "November 18, 2022", lastService: "July 2, 2026", nextService: "October 2, 2026", notes: "Mobile maintenance response truck with parts bins and welding leads." },
  { id: "forklift-f-01", title: "Forklift F-01", subtitle: "Material Handling", category: "Equipment", family: "Material Handling", status: "active", manufacturer: "Toyota", model: "8FGCU25", serialNumber: "CE-FLK-2001", assetTag: "CE-EQP-006", location: "Material Receiving", acquisitionDate: "February 3, 2024", lastService: "May 29, 2026", nextService: "September 29, 2026", notes: "General-purpose warehouse lift truck for inbound pallets." },
  { id: "forklift-f-02", title: "Forklift F-02", subtitle: "Material Handling", category: "Equipment", family: "Material Handling", status: "maintenance", manufacturer: "Hyster", model: "H50XT", serialNumber: "CE-FLK-2002", assetTag: "CE-EQP-007", location: "Maintenance Shop", acquisitionDate: "April 17, 2023", lastService: "June 18, 2026", nextService: "July 1, 2026", notes: "Hydraulic inspection and mast chain replacement scheduled." },
  { id: "telehandler-th-01", title: "Telehandler TH-01", subtitle: "Material Handling", category: "Equipment", family: "Material Handling", status: "active", manufacturer: "JCB", model: "510-56", serialNumber: "CE-HTL-2003", assetTag: "CE-EQP-008", location: "Construction Site", acquisitionDate: "September 22, 2023", lastService: "April 14, 2026", nextService: "October 14, 2026", notes: "Site lift and set equipment for module placement support." },
  { id: "electric-pallet-jack-01", title: "Electric Pallet Jack EPJ-01", subtitle: "Material Handling", category: "Equipment", family: "Material Handling", status: "retired", manufacturer: "Crown", model: "WP 3050", serialNumber: "CE-EPJ-2004", assetTag: "CE-EQP-009", location: "Maintenance Shop", acquisitionDate: "June 7, 2021", lastService: "December 14, 2025", nextService: "N/A", notes: "Retired after battery system failure and repeated charger faults." },
  { id: "coil-handling-cart-01", title: "Coil Handling Cart CH-01", subtitle: "Material Handling", category: "Equipment", family: "Material Handling", status: "maintenance", manufacturer: "Custom Fabrication", model: "Heavy-Duty Coil Cart", serialNumber: "CE-CHC-2005", assetTag: "CE-EQP-010", location: "Material Receiving", acquisitionDate: "October 19, 2024", lastService: "June 22, 2026", nextService: "July 5, 2026", notes: "Wheel bearing and deck alignment correction in progress." },
  { id: "gantry-crane-c-01", title: "Gantry Crane C-01", subtitle: "Cranes / Lifting", category: "Equipment", family: "Cranes / Lifting", status: "active", manufacturer: "Gorbel", model: "Aluminum Gantry Crane", serialNumber: "CE-CRN-3001", assetTag: "CE-EQP-011", location: "Factory Floor", acquisitionDate: "May 16, 2023", lastService: "March 3, 2026", nextService: "September 3, 2026", notes: "Used for module lift alignment and heavy fixture repositioning." },
  { id: "jib-crane-j-01", title: "Jib Crane J-01", subtitle: "Cranes / Lifting", category: "Equipment", family: "Cranes / Lifting", status: "retired", manufacturer: "Spanco", model: "Wall-Mounted Jib Crane", serialNumber: "CE-CRN-3002", assetTag: "CE-EQP-012", location: "Maintenance Shop", acquisitionDate: "March 8, 2020", lastService: "February 11, 2025", nextService: "N/A", notes: "Retired after structural arm fatigue was confirmed during inspection." },
  { id: "scissor-lift-sl-01", title: "Scissor Lift SL-01", subtitle: "Cranes / Lifting", category: "Equipment", family: "Cranes / Lifting", status: "maintenance", manufacturer: "Genie", model: "GS-3246", serialNumber: "CE-LFT-3003", assetTag: "CE-EQP-013", location: "Field Operations", acquisitionDate: "December 3, 2022", lastService: "June 12, 2026", nextService: "June 28, 2026", notes: "Hydraulic leak and platform sensor calibration." },
  { id: "boom-lift-bl-01", title: "Boom Lift BL-01", subtitle: "Cranes / Lifting", category: "Equipment", family: "Cranes / Lifting", status: "active", manufacturer: "JLG", model: "450AJ", serialNumber: "CE-LFT-3004", assetTag: "CE-EQP-014", location: "Construction Site", acquisitionDate: "February 20, 2024", lastService: "April 7, 2026", nextService: "October 7, 2026", notes: "Exterior work and rooftop access lift." },
  { id: "lgs-roll-former-rf-01", title: "LGS Roll Former RF-01", subtitle: "Manufacturing Equipment", category: "Equipment", family: "Manufacturing Equipment", status: "active", manufacturer: "FRAMECAD", model: "F325i", serialNumber: "CE-MFG-4001", assetTag: "CE-EQP-015", location: "Manufacturing Facility", acquisitionDate: "July 11, 2023", lastService: "May 21, 2026", nextService: "November 21, 2026", notes: "Primary light-gauge steel roll-forming line." },
  { id: "panel-assembly-station-pa-01", title: "Panel Assembly Station PA-01", subtitle: "Manufacturing Equipment", category: "Equipment", family: "Manufacturing Equipment", status: "active", manufacturer: "CE Fabrication", model: "Panel Assembly Cell", serialNumber: "CE-MFG-4002", assetTag: "CE-EQP-016", location: "Panel Assembly Cell", acquisitionDate: "August 4, 2024", lastService: "June 1, 2026", nextService: "September 1, 2026", notes: "Dedicated panel nailing, fastening, and staging workstation." },
  { id: "automated-sheathing-station-sh-01", title: "Automated Sheathing Station SH-01", subtitle: "Manufacturing Equipment", category: "Equipment", family: "Manufacturing Equipment", status: "active", manufacturer: "Hilti", model: "Autonomous Fastening Cell", serialNumber: "CE-MFG-4003", assetTag: "CE-EQP-017", location: "Panel Assembly Cell", acquisitionDate: "October 12, 2024", lastService: "May 8, 2026", nextService: "November 8, 2026", notes: "Automated panel sheathing and fastener placement station." },
  { id: "cnc-cutting-station-cnc-01", title: "CNC Cutting Station CNC-01", subtitle: "Manufacturing Equipment", category: "Equipment", family: "Manufacturing Equipment", status: "maintenance", manufacturer: "Biesse", model: "Rover A Smart", serialNumber: "CE-MFG-4004", assetTag: "CE-EQP-018", location: "Manufacturing Facility", acquisitionDate: "January 23, 2023", lastService: "June 24, 2026", nextService: "July 9, 2026", notes: "Spindle calibration and dust collection service." },
  { id: "industrial-air-compressor-ac-01", title: "Industrial Air Compressor AC-01", subtitle: "Manufacturing Equipment", category: "Equipment", family: "Manufacturing Equipment", status: "maintenance", manufacturer: "Sullair", model: "185 Tier 4F", serialNumber: "CE-MFG-4005", assetTag: "CE-EQP-019", location: "Power Room", acquisitionDate: "May 15, 2022", lastService: "June 27, 2026", nextService: "July 12, 2026", notes: "Oil separator replacement and pressure regulation check." },
  { id: "cr6-assembly-robot-r-01", title: "CR6 Assembly Robot R-01", subtitle: "Robotics", category: "Equipment", family: "Robotics", status: "active", manufacturer: "Universal Robots", model: "UR30 / CR6 Cell", serialNumber: "CE-ROB-5001", assetTag: "CE-EQP-020", location: "Robotics Cell", acquisitionDate: "September 6, 2024", lastService: "May 19, 2026", nextService: "November 19, 2026", notes: "Assembly assist robot for repeatable material placement." },
  { id: "welding-robot-r-02", title: "Welding Robot R-02", subtitle: "Robotics", category: "Equipment", family: "Robotics", status: "active", manufacturer: "FANUC", model: "Arc Mate 120iD", serialNumber: "CE-ROB-5002", assetTag: "CE-EQP-021", location: "Robotics Cell", acquisitionDate: "February 15, 2024", lastService: "April 30, 2026", nextService: "October 30, 2026", notes: "Automated weld path robot for structural assemblies." },
  { id: "material-handling-robot-r-03", title: "Material Handling Robot R-03", subtitle: "Robotics", category: "Equipment", family: "Robotics", status: "active", manufacturer: "ABB", model: "IRB 2600", serialNumber: "CE-ROB-5003", assetTag: "CE-EQP-022", location: "Robotics Cell", acquisitionDate: "June 18, 2024", lastService: "May 11, 2026", nextService: "November 11, 2026", notes: "Conveyor-to-fixture transfer robot for panel handling." },
  { id: "vision-inspection-system-vi-01", title: "Vision Inspection System VI-01", subtitle: "Robotics", category: "Equipment", family: "Robotics", status: "active", manufacturer: "Cognex", model: "In-Sight 7000", serialNumber: "CE-ROB-5004", assetTag: "CE-EQP-023", location: "Quality Lab", acquisitionDate: "November 29, 2024", lastService: "June 10, 2026", nextService: "December 10, 2026", notes: "Automated visual inspection and defect detection system." },
  { id: "table-jig-tj-01", title: "Table Jig TJ-01", subtitle: "Production Fixtures", category: "Tools", family: "Production Fixtures", status: "active", manufacturer: "Custom Fabrication", model: "Modular Assembly Jig", serialNumber: "CE-TOL-6001", assetTag: "CE-TOL-024", location: "Factory Floor", acquisitionDate: "January 7, 2024", lastService: "May 5, 2026", nextService: "October 5, 2026", notes: "Primary build table jig for repeatable assembly alignment." },
  { id: "roller-fixture-rfj-01", title: "Roller Fixture RFJ-01", subtitle: "Production Fixtures", category: "Tools", family: "Production Fixtures", status: "retired", manufacturer: "Custom Fabrication", model: "Roller Transfer Fixture", serialNumber: "CE-TOL-6002", assetTag: "CE-TOL-025", location: "Maintenance Shop", acquisitionDate: "October 9, 2020", lastService: "January 18, 2025", nextService: "N/A", notes: "Retired after frame wear and non-serviceable roller damage." },
  { id: "module-tilt-fixture-tf-01", title: "Module Tilt Fixture TF-01", subtitle: "Production Fixtures", category: "Tools", family: "Production Fixtures", status: "active", manufacturer: "CE Fabrication", model: "Tilt-Frame Fixture", serialNumber: "CE-TOL-6003", assetTag: "CE-TOL-026", location: "Module Staging Yard", acquisitionDate: "August 16, 2024", lastService: "April 26, 2026", nextService: "October 26, 2026", notes: "Supports module tilt-up and staging alignment." },
  { id: "laser-measurement-system-lm-01", title: "Laser Measurement System LM-01", subtitle: "Quality / Inspection", category: "Tools", family: "Quality / Inspection", status: "active", manufacturer: "Leica", model: "DISTO X6", serialNumber: "CE-QLT-6004", assetTag: "CE-TOL-027", location: "Quality Lab", acquisitionDate: "February 28, 2024", lastService: "May 28, 2026", nextService: "September 28, 2026", notes: "Measurement kit for layout verification and tolerance checks." },
  { id: "digital-torque-calibration-kit-tc-01", title: "Digital Torque Calibration Kit TC-01", subtitle: "Quality / Inspection", category: "Tools", family: "Quality / Inspection", status: "active", manufacturer: "Fluke", model: "Torque Calibration Kit", serialNumber: "CE-QLT-6005", assetTag: "CE-TOL-028", location: "Quality Lab", acquisitionDate: "May 24, 2023", lastService: "June 3, 2026", nextService: "December 3, 2026", notes: "Used for torque validation on production and field tools." },
  { id: "industrial-inspection-tablet-it-01", title: "Industrial Inspection Tablet IT-01", subtitle: "Quality / Inspection", category: "Tools", family: "Quality / Inspection", status: "retired", manufacturer: "Zebra", model: "ET45", serialNumber: "CE-QLT-6006", assetTag: "CE-TOL-029", location: "Maintenance Shop", acquisitionDate: "December 14, 2021", lastService: "August 29, 2025", nextService: "N/A", notes: "Retired inspection tablet replaced by ruggedized mobile devices." },
  { id: "dock-leveler-dl-01", title: "Dock Leveler DL-01", subtitle: "Facility / Infrastructure", category: "Infrastructure", family: "Facility / Infrastructure", status: "active", manufacturer: "Rite-Hite", model: "Hydraulic Dock Leveler", serialNumber: "CE-INF-7001", assetTag: "CE-INF-030", location: "Dock", acquisitionDate: "March 5, 2022", lastService: "April 20, 2026", nextService: "October 20, 2026", notes: "Main loading dock interface for trailer and service truck transfers." },
];

const GRID_COLUMNS = 5;
const CARD_WIDTH = 210;
const CARD_HEIGHT = 92;
const HORIZONTAL_SPACING = 250;
const VERTICAL_SPACING = 150;

/**
 * Real Asset records have no x/y/width/height -- that's frontend-only grid
 * placement, not FF data. Exported so AssetsPage can apply the exact same
 * layout to real fetched records that this fixture always used for itself.
 */
export function layoutAssets(seeds: AssetSeed[]): AssetNodeData[] {
  return seeds.map((asset, index) => ({
    ...asset,
    x: (index % GRID_COLUMNS) * HORIZONTAL_SPACING,
    y: Math.floor(index / GRID_COLUMNS) * VERTICAL_SPACING,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  }));
}

/**
 * Retained as-is, unused by the real data path (AssetsPage now fetches
 * real Asset records and lays them out itself via layoutAssets) --
 * kept for this phase per explicit instruction, not reverted. Real
 * reconciliation/removal is a separate, later step once the DB-backed
 * path is verified.
 */
export const assetNodes: AssetNodeData[] = layoutAssets(assetSeeds);

export function toEntityNode(node: AssetNodeData): EntityNodeData {
  return {
    id: node.id,
    title: node.title,
    subtitle: node.subtitle,
    accentColor: STATUS_COLOR[node.status],
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

export function getAssetsBounds(nodes: AssetNodeData[] = assetNodes): Bounds {
  // Real empty state while the real fetch is still in flight -- Math.min/max
  // over an empty array is Infinity/-Infinity, not a usable bounds.
  if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const xs = nodes.flatMap((n) => [n.x, n.x + n.width]);
  const ys = nodes.flatMap((n) => [n.y, n.y + n.height]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/**
 * Real Asset dates come back from the API as ISO timestamps, not the
 * fixture's original "October 12, 2024" display strings -- this restores
 * that same display format so the real-data path looks identical to the
 * fixture it replaced. Null (a real "N/A", never a placeholder) passes
 * through as null; callers decide their own null-display text.
 */
export function formatAssetDate(iso: string): string;
export function formatAssetDate(iso: string | null): string | null;
export function formatAssetDate(iso: string | null): string | null {
  if (iso === null) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function formatAssetStatus(status: AssetStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "maintenance":
      return "Maintenance";
    case "retired":
      return "Retired";
  }
}

export function getAssetSummary(nodes: AssetNodeData[] = assetNodes): AssetSummary {
  return nodes.reduce<AssetSummary>(
    (summary, asset) => {
      summary.total += 1;
      summary[asset.status] += 1;
      return summary;
    },
    { total: 0, active: 0, maintenance: 0, retired: 0 }
  );
}
