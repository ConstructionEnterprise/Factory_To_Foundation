import { NORTH_TEXAS_COUNTIES } from "./northTexasCounties";
import { NORTH_TEXAS_ROADS, type RoadClass } from "./northTexasRoads";
import { projectLonLat, type MapXZ } from "./mapProjection";

/**
 * Real projected map data (real Census counties, real TIGER/USGS roads),
 * shared between Construction's map (ConstructionMap.tsx) and Logistics'
 * map (features/logistics/LogisticsMap.tsx) — promoted here once Logistics
 * became a real second consumer of the same real county/road geometry,
 * rather than duplicating the projection math in a second map component.
 * Y-height and material styling stay owned by each map, since the two
 * maps use real roads at different visual prominence (Construction: a
 * supporting toggle; Logistics: the primary subject).
 */

export type ProjectedCounty = {
  name: string;
  core: boolean;
  centroid: MapXZ;
  rings: MapXZ[][];
};

export const PROJECTED_COUNTIES: ProjectedCounty[] = NORTH_TEXAS_COUNTIES.map((c) => ({
  name: c.name,
  core: c.core,
  centroid: projectLonLat(c.centroid),
  rings: c.rings.map((ring) => ring.map((pt) => projectLonLat(pt))),
}));

export function countyCentroid(name: string): MapXZ | undefined {
  return PROJECTED_COUNTIES.find((c) => c.name === name)?.centroid;
}

export type ProjectedRoad = {
  class: RoadClass;
  label: string | null;
  /** Real projected [x,z] vertices (map space, 1 unit = 1km) — one continuous real route per entry. */
  points: MapXZ[];
};

export const PROJECTED_ROADS: ProjectedRoad[] = NORTH_TEXAS_ROADS.map((r) => ({
  class: r.class,
  label: r.label,
  points: r.coords.map((pt) => projectLonLat(pt)),
}));
