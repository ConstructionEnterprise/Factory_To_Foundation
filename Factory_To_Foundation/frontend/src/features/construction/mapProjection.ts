/**
 * Projection for the Construction Enterprises Map: real WGS84 [lon, lat]
 * → flat map space, 1 unit = 1 km, equirectangular, centered on the core
 * North Texas county cluster.
 *
 * Axes: +x = east, +z = south (three.js ground plane, Y-up), so a camera
 * looking down with -Z "up" reads as a normal north-up map.
 *
 * Longitude scale is per-point-latitude, not fixed at LAT0. A fixed
 * cos(LAT0) scale (the original North Texas-only version of this function)
 * is negligibly wrong across North Texas's own ~2.25° latitude span
 * (confirmed: ~1.3% at the cluster's own north/south edges) — but this map
 * now spans the full continental US (usaStates.ts), up to ~49°N. At that
 * latitude a fixed cos(32.8°) scale overstates east-west distance by a real ~28%
 * (true km/deg-lon at 49°N is ~73, the fixed formula still uses ~93.5) —
 * northern states would render visibly too wide. Using each point's own
 * latitude for its longitude scale is the standard fix and keeps this one
 * projection function accurate at both scales, rather than adding a second,
 * separate one for the USA backdrop.
 *
 * Real side effect, disclosed: this makes a straight 2-point line no longer
 * an exact meridian across a large latitude span (the true meridian curves
 * slightly, since the x-scale changes with z). Negligible for the North
 * Texas graticule (2.25° span, same ~1.3% figure above) — those stay simple
 * 2-point lines. Not an issue for the real state/county polygons, since
 * every real vertex is projected individually.
 *
 * This also means existing North Texas map-space coordinates (including
 * already-placed project sites persisted in localStorage) shift by that
 * same ~1.3% at most when re-rendered under this corrected formula — real,
 * disclosed, and small enough to stay well within the placement-precision
 * margins already established (sites were deliberately placed 10km+ from
 * any county border).
 */

const LON0 = -97.0;
const LAT0 = 32.8;
const KM_PER_DEG_LAT = 110.9;

export type MapXZ = { x: number; z: number };

function kmPerDegLonAt(lat: number): number {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

export function projectLonLat(lonLat: [number, number]): MapXZ {
  const [lon, lat] = lonLat;
  return {
    x: (lon - LON0) * kmPerDegLonAt(lat),
    z: -(lat - LAT0) * KM_PER_DEG_LAT,
  };
}

/** Exact inverse of projectLonLat. z depends only on latitude, so the real
 * latitude is recovered first (exactly), which then gives the correct
 * per-point longitude scale to recover the real longitude (also exactly —
 * no iteration/approximation needed despite the scale now being
 * latitude-dependent). Needed for real-world lookups (e.g. elevation)
 * against a site placed by map click, which only ever has map-space x/z. */
export function unprojectXZ(xz: MapXZ): [number, number] {
  const lat = LAT0 - xz.z / KM_PER_DEG_LAT;
  return [xz.x / kmPerDegLonAt(lat) + LON0, lat];
}
