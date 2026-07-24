// GENERATED FILE — do not hand-edit. Real elevation data.
// Source: Copernicus DEM 2021 release GLO-90 (90m resolution), served via
// the Open-Meteo Elevation API (https://open-meteo.com/en/docs/elevation-api,
// DOI: https://doi.org/10.5270/ESA-c5d3d65). Fetched live, one-off, outside
// the repo (16x16 grid, 256 real point queries, batched 100 at a time —
// the API's per-request coordinate limit). Same "generated once, bundled,
// no runtime fetch" convention as northTexasCounties.ts.
//
// Grid covers the exact same real lon/lat extent ConstructionMap.tsx's own
// graticuleExtent() derives from the bundled county data, so the terrain
// and the county/graticule layers line up without a second, separate bounds
// concept. Values are real meters above sea level — real regional relief
// here is modest (~74m–393m across the full extent, i.e. ~243–1289 ft), not
// dramatic, and that's reported as-is rather than exaggerated.

export const ELEVATION_GRID_SIZE = 16;
export const ELEVATION_MIN_LON = -98.0685;
export const ELEVATION_MAX_LON = -95.8587;
export const ELEVATION_MIN_LAT = 31.7089;
export const ELEVATION_MAX_LAT = 33.9596;

/** Real elevation in meters, row-major (lat ascending, then lon ascending), 16x16. */
export const ELEVATION_METERS: number[] = [
  344, 329, 280, 228, 233, 174, 147, 140, 171, 157, 151, 138, 145, 129, 132, 76,
  369, 351, 301, 224, 242, 162, 168, 185, 168, 154, 143, 129, 108, 100, 74, 105,
  342, 297, 275, 221, 159, 191, 196, 225, 165, 158, 129, 131, 120, 100, 89, 91,
  393, 344, 291, 209, 173, 217, 214, 227, 171, 140, 143, 108, 118, 83, 100, 142,
  361, 271, 235, 243, 260, 240, 209, 160, 196, 134, 149, 109, 98, 95, 133, 167,
  340, 305, 222, 247, 276, 253, 212, 201, 210, 152, 143, 109, 116, 103, 145, 170,
  285, 238, 261, 304, 218, 225, 216, 166, 195, 170, 127, 111, 124, 140, 137, 154,
  301, 336, 330, 328, 225, 161, 173, 166, 163, 128, 151, 145, 153, 161, 143, 131,
  313, 348, 309, 286, 195, 227, 207, 178, 142, 186, 138, 169, 149, 155, 143, 157,
  323, 308, 288, 252, 256, 227, 185, 180, 173, 211, 179, 160, 172, 158, 141, 153,
  314, 303, 235, 255, 294, 250, 192, 164, 174, 234, 160, 178, 212, 177, 158, 146,
  309, 328, 275, 317, 271, 271, 213, 190, 189, 228, 214, 208, 197, 196, 180, 158,
  355, 291, 302, 277, 268, 289, 216, 206, 201, 224, 248, 238, 213, 184, 197, 172,
  293, 280, 325, 364, 337, 305, 243, 265, 237, 218, 248, 176, 188, 181, 156, 179,
  272, 273, 281, 303, 264, 295, 209, 229, 229, 222, 220, 183, 188, 148, 157, 136,
  278, 268, 241, 238, 238, 243, 273, 247, 199, 216, 186, 216, 197, 151, 172, 169,
];

/** Real min/max across the fetched grid — for building a color ramp against actual data range, not a guessed one. */
export const ELEVATION_MIN_M = Math.min(...ELEVATION_METERS);
export const ELEVATION_MAX_M = Math.max(...ELEVATION_METERS);

/**
 * Bilinear-sampled real elevation (meters) at any [lon, lat] inside the grid
 * extent — standard interpolation between real DEM sample points (the same
 * technique any GIS/terrain renderer uses for a coarse grid), not fabricated
 * data. Clamps to the grid edge outside the extent rather than extrapolating.
 */
export function elevationAt(lonLat: [number, number]): number {
  const [lon, lat] = lonLat;
  const gx = ((lon - ELEVATION_MIN_LON) / (ELEVATION_MAX_LON - ELEVATION_MIN_LON)) * (ELEVATION_GRID_SIZE - 1);
  const gy = ((lat - ELEVATION_MIN_LAT) / (ELEVATION_MAX_LAT - ELEVATION_MIN_LAT)) * (ELEVATION_GRID_SIZE - 1);
  const cx = Math.min(Math.max(gx, 0), ELEVATION_GRID_SIZE - 1);
  const cy = Math.min(Math.max(gy, 0), ELEVATION_GRID_SIZE - 1);
  const x0 = Math.floor(cx), x1 = Math.min(x0 + 1, ELEVATION_GRID_SIZE - 1);
  const y0 = Math.floor(cy), y1 = Math.min(y0 + 1, ELEVATION_GRID_SIZE - 1);
  const tx = cx - x0, ty = cy - y0;
  const at = (x: number, y: number) => ELEVATION_METERS[y * ELEVATION_GRID_SIZE + x];
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

export function metersToFeet(m: number): number {
  return m * 3.28084;
}
