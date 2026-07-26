import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";
import { useNavigate } from "react-router-dom";

import { Legend, PanelCard } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";

import { NORTH_TEXAS_COUNTIES } from "../northTexasCounties";
import { projectLonLat, unprojectXZ, type MapXZ } from "../mapProjection";
import {
  ELEVATION_GRID_SIZE,
  ELEVATION_MAX_LAT,
  ELEVATION_MAX_LON,
  ELEVATION_MAX_M,
  ELEVATION_METERS,
  ELEVATION_MIN_LAT,
  ELEVATION_MIN_LON,
  ELEVATION_MIN_M,
  elevationAt,
  metersToFeet,
} from "../northTexasElevation";
import { USA_STATES } from "../usaStates";
import { PROJECTED_COUNTIES, PROJECTED_ROADS, countyCentroid, type ProjectedCounty } from "../projectedMapData";
import {
  FACTORY_COORDS,
  FACTORY_NODE,
  resolveSite,
  type ResolvedSite,
} from "../constructionLocations";
import {
  cancelPlacement,
  setHoveredSite,
  setSiteCoords,
  useSiteState,
} from "../constructionSiteStore";
import { constructionProjects } from "../constructionData";
import type { CorridorTarget, CorridorNavState } from "../corridorNav";

/**
 * Construction Enterprises Map — the Construction feature's viewport.
 *
 * Replaces the abstract block "Site Plan" (EntityCanvas) with a real-
 * geography 3D map: actual US Census county boundaries for North Texas
 * (see northTexasCounties.ts — generated from public-domain Census data,
 * bundled locally, no runtime fetch), with symbolic project massing driven
 * by real project specs. Same bespoke react-three-fiber pattern proven in
 * Manufacturing's GeometryViewport and Factory's FactoryGeometryViewport:
 * Canvas + OrbitControls + click-to-select driving SelectionContext, and
 * the manual initial-camera + explicit OrbitControls target technique
 * (drei's Bounds fit is unreliable alongside OrbitControls — confirmed
 * twice in this codebase; see FactoryGeometryViewport's comment).
 *
 * Honesty conventions (same standard as the Factory viewport's captions):
 * - Massing is symbolic, not to scale — disclosed in-scene.
 * - 'region'-precision projects render at their county centroid with a
 *   dashed ground ring + "approximate — county-level" label, never as a
 *   precise site.
 * - Projects with no real location source render OFF the map, in the
 *   "Unplaced" tray, until sited in-app.
 */

// Real hex values behind the --ff-* tokens (three.js materials need
// literals, not CSS custom properties — same approach as the other two
// viewports).
const ACCENT = "#d9631e";
const PROJECT_COLOR = "#7a828d"; // --ff-tier-project — identity, not status (no real per-project status exists)
const TEXT_SECONDARY = "#5b6472";
const TEXT_MUTED = "#8b93a1";
const COUNTY_CORE = "#fafbfc";
const COUNTY_NEIGHBOR = "#eceef1"; // --ff-chrome-bg
const COUNTY_BORDER = "#c9cdd4";

const COUNTY_DEPTH = 0.35;
/** Symbolic km per story — massing scale is disclosed in-scene, not claimed real. */
const STORY = 0.3;

const SCENE_TARGET: [number, number, number] = [0, 0, -5];
const CAMERA_EYE: [number, number, number] = [0, 175, 130];

function InitialCamera() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  useLayoutEffect(() => {
    camRef.current?.position.set(...CAMERA_EYE);
    camRef.current?.lookAt(...SCENE_TARGET);
  }, []);
  // far was 2000 (fine for the ~250km North Texas-only extent). The real
  // continental US backdrop is ~5,000+ km wide — raised so it doesn't clip
  // when a user zooms out to see the whole country (see maxDistance below).
  return <PerspectiveCamera ref={camRef} makeDefault fov={45} near={1} far={8000} />;
}

// ── Compass — tracks the real, live camera orbit (OrbitControls here has no
// azimuth clamp, so "up" on screen genuinely isn't always north). Reads the
// actual camera position every frame and writes straight to a DOM ref
// (bypassing React state) — same imperative-update-from-useFrame pattern as
// any other per-frame-driven visual in this codebase. ──

/** Camera yaw (radians) around the OrbitControls target. 0 = the initial
 * "camera south of target, looking north" framing, which is what keeps the
 * county labels reading north-up before any drag happens. */
function cameraYaw(camera: THREE.Camera, target: THREE.Vector3): number {
  return Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
}

function CompassTracker({ needleRef }: { needleRef: RefObject<HTMLDivElement | null> }) {
  const target = useMemo(() => new THREE.Vector3(...SCENE_TARGET), []);
  useFrame(({ camera }) => {
    if (!needleRef.current) return;
    // As the camera orbits, true north sweeps the opposite way on screen —
    // negate the yaw so the needle keeps pointing at real north.
    needleRef.current.style.transform = `rotate(${(-cameraYaw(camera, target) * 180) / Math.PI}deg)`;
  });
  return null;
}

// ── Counties: real projected Census rings, promoted to projectedMapData.ts
// once Logistics' own map (features/logistics/LogisticsMap.tsx) became a
// real second consumer of the same real county/road geometry. ──

// ── USA backdrop — real Census-derived continental US state outlines. ──
// Context, not the subject: line outlines only (no fill), washed-out/
// translucent, positioned just under the North Texas terrain layer so it's
// automatically hidden wherever real North Texas detail already covers it,
// and only visible across the rest of the country where there's nothing
// else to show. Same real-data/generated-file convention as the county
// data (see usaStates.ts's own header for sourcing).

type ProjectedState = {
  name: string;
  centroid: MapXZ;
  rings: MapXZ[][];
};

const PROJECTED_STATES: ProjectedState[] = USA_STATES.map((s) => ({
  name: s.name,
  centroid: projectLonLat(s.centroid),
  rings: s.rings.map((ring) => ring.map((pt) => projectLonLat(pt))),
}));

const USA_OUTLINE_COLOR = "#c9cdd4";
const USA_LABEL_COLOR = "#aeb4bd";
/** Just under the terrain (y=-0.04) — real depth-buffer occlusion means this
 * layer is automatically hidden under North Texas's real detail and only
 * shows through everywhere else, with no manual clipping/masking needed. */
const USA_LAYER_Y = -0.045;

function USAOutline() {
  return (
    <group>
      {PROJECTED_STATES.map((s) => (
        <group key={s.name}>
          {s.rings.map((ring, i) => (
            <Line
              key={i}
              points={ring.map((p) => [p.x, USA_LAYER_Y, p.z] as [number, number, number])}
              color={USA_OUTLINE_COLOR}
              lineWidth={0.7}
              transparent
              opacity={0.5}
            />
          ))}
          <Text
            position={[s.centroid.x, USA_LAYER_Y + 0.01, s.centroid.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            // Text size is in world units (km), not screen-relative — a
            // state's real label needs to be tens of km tall to read at the
            // continental zoom level where anyone would actually want to
            // read state names (fontSize=9, proportioned for the ~100km
            // county labels, was genuinely unreadable at USA-wide zoom).
            fontSize={45}
            color={USA_LABEL_COLOR}
            fillOpacity={0.6}
            anchorX="center"
            anchorY="middle"
          >
            {s.name}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ── Lat/lon graticule — real WGS84 gridlines, derived from the same bundled
// Census ring data every other map feature uses (no separate/guessed extent). ──

const GRATICULE_STEP_DEG = 0.5;

function graticuleExtent() {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const c of NORTH_TEXAS_COUNTIES) {
    for (const ring of c.rings) {
      for (const [lon, lat] of ring) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

function stepsBetween(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(start / step) * step; v <= end; v += step) out.push(Number(v.toFixed(4)));
  return out;
}

const GRATICULE = (() => {
  const { minLon, maxLon, minLat, maxLat } = graticuleExtent();
  return {
    meridians: stepsBetween(minLon, maxLon, GRATICULE_STEP_DEG).map((lon) => ({
      lon,
      south: projectLonLat([lon, minLat]),
      north: projectLonLat([lon, maxLat]),
    })),
    parallels: stepsBetween(minLat, maxLat, GRATICULE_STEP_DEG).map((lat) => ({
      lat,
      west: projectLonLat([minLon, lat]),
      east: projectLonLat([maxLon, lat]),
    })),
  };
})();

// TEXT_MUTED (the original choice) blended into the new, much paler muted
// terrain palette — confirmed live (toggle worked, lines were invisible).
// TEXT_SECONDARY is darker and holds contrast against the new terrain tones.
const GRATICULE_COLOR = TEXT_SECONDARY;

/** Real WGS84 lon/lat gridlines at 0.5° steps, labeled at the map's edges. */
function Graticule() {
  return (
    <group>
      {GRATICULE.meridians.map((m) => (
        <group key={`lon-${m.lon}`}>
          <Line
            points={[
              [m.south.x, COUNTY_DEPTH + 0.01, m.south.z] as [number, number, number],
              [m.north.x, COUNTY_DEPTH + 0.01, m.north.z] as [number, number, number],
            ]}
            color={GRATICULE_COLOR}
            lineWidth={0.8}
            transparent
            opacity={0.75}
            dashed
            dashSize={0.8}
            gapSize={0.8}
          />
          <Text
            position={[m.south.x, COUNTY_DEPTH + 0.05, m.south.z + 1.4]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.1}
            color={TEXT_MUTED}
            anchorX="center"
            anchorY="top"
          >
            {`${Math.abs(m.lon).toFixed(1)}°W`}
          </Text>
        </group>
      ))}
      {GRATICULE.parallels.map((p) => (
        <group key={`lat-${p.lat}`}>
          <Line
            points={[
              [p.west.x, COUNTY_DEPTH + 0.01, p.west.z] as [number, number, number],
              [p.east.x, COUNTY_DEPTH + 0.01, p.east.z] as [number, number, number],
            ]}
            color={GRATICULE_COLOR}
            lineWidth={0.8}
            transparent
            opacity={0.75}
            dashed
            dashSize={0.8}
            gapSize={0.8}
          />
          <Text
            position={[p.west.x - 1.4, COUNTY_DEPTH + 0.05, p.west.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.1}
            color={TEXT_MUTED}
            anchorX="right"
            anchorY="middle"
          >
            {`${p.lat.toFixed(1)}°N`}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ── Hypsometric terrain — real elevation, real cartographic color convention ──
// (muted green lowland → tan → grey highland, the standard physical/relief-
// map tint scheme, desaturated to sit as a quiet background layer rather
// than compete with county lines / the F»F corridor / massing). Flat color,
// not vertical relief — this map's camera/lighting is tuned for a flat
// plane, and hypsometric tinting is conventionally flat-shaded on real
// physical maps too.
//
// Normalized against real, fixed Texas elevation extremes — sea level (0m,
// the real Gulf Coast) up to Guadalupe Peak, the real highest point in
// Texas (2,667m / 8,751 ft) — not this dataset's own local min/max, and
// deliberately not the full continental-US range either (an earlier version
// used Mount Whitney/4,421m — real, but compressed North Texas's real
// 74–393m range to under 9% of the ramp, reading as barely-there. Texas's
// own real range is the more legible honest reference: still a real, fixed,
// external scale — never the local dataset's own min/max, which would
// auto-stretch flat terrain to maximum contrast regardless of how flat it
// really is — but North Texas's real range now occupies a real, visible
// ~2.8%–14.7% band, still correctly reading as the flat part of the state,
// just with enough real internal contrast to actually look like terrain.
const TX_MIN_ELEVATION_M = 0;
const TX_MAX_ELEVATION_M = 2667;

// Real bug found live: the original low-elevation stops (#dadfd2, #ddd8c8)
// were ~17-24% saturation at ~83-85% lightness — technically tinted, but
// perceptually just pale grey, especially after the mesh's own lighting
// response. Fixed with real, perceptible green→tan hues, saturation raised
// to ~30-40% (still muted/restrained, not neon) while keeping lightness
// high enough to stay a quiet background layer. Stops positioned in real
// meters so North Texas's own real 74–393m range spans a visible green
// (near 0m) → tan (near 400m) transition within itself, not just a single
// near-uniform tone — the point of switching to the Texas-scale reference
// above.
const HYPSOMETRIC_STOPS: [number, string][] = [
  [0.0, "#a3c08c"], // 0m — Gulf Coast / sea level
  [0.056, "#c3c68f"], // ~150m — mid North Texas
  [0.15, "#d9c98f"], // ~400m — just past North Texas's real max
  [0.3, "#cba873"], // ~800m — Hill Country / Edwards Plateau
  [0.562, "#a67f56"], // ~1500m — higher plateau
  [1.0, "#e8e6e2"], // 2667m — Guadalupe Peak
];

function hypsometricColor(elevationM: number): THREE.Color {
  const t = (elevationM - TX_MIN_ELEVATION_M) / (TX_MAX_ELEVATION_M - TX_MIN_ELEVATION_M);
  const clamped = Math.min(Math.max(t, 0), 1);
  for (let i = 0; i < HYPSOMETRIC_STOPS.length - 1; i++) {
    const [t0, c0] = HYPSOMETRIC_STOPS[i];
    const [t1, c1] = HYPSOMETRIC_STOPS[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const localT = t1 > t0 ? (clamped - t0) / (t1 - t0) : 0;
      return new THREE.Color(c0).lerp(new THREE.Color(c1), localT);
    }
  }
  return new THREE.Color(HYPSOMETRIC_STOPS[HYPSOMETRIC_STOPS.length - 1][1]);
}

// Mesh subdivision is finer than the real 16x16 fetched grid — vertex colors
// between real sample points are bilinearly interpolated (elevationAt), the
// same technique any GIS/terrain renderer uses for a coarse DEM, not
// fabricated data between them.
const TERRAIN_RESOLUTION = 48;

function buildTerrainGeometry(): THREE.BufferGeometry {
  const n = TERRAIN_RESOLUTION;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const lat = ELEVATION_MIN_LAT + (ELEVATION_MAX_LAT - ELEVATION_MIN_LAT) * (i / n);
    for (let j = 0; j <= n; j++) {
      const lon = ELEVATION_MIN_LON + (ELEVATION_MAX_LON - ELEVATION_MIN_LON) * (j / n);
      const { x, z } = projectLonLat([lon, lat]);
      positions.push(x, 0, z);
      const c = hypsometricColor(elevationAt([lon, lat]));
      colors.push(c.r, c.g, c.b);
    }
  }
  const stride = n + 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

const TERRAIN_GEOMETRY = buildTerrainGeometry();

/** Real elevation-tinted terrain, replacing the old flat grey ground plane. */
function Terrain() {
  return (
    <mesh geometry={TERRAIN_GEOMETRY} position={[0, -0.04, 0]}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Contour lines — real isolines extracted from the real elevation grid ──
// via marching squares. This, not the hypsometric tint alone, is the actual
// defining convention of "looks like a topographic map" — real topo maps
// layer contour lines ON TOP of a hypsometric wash; the wash by itself was
// never a substitute for the lines. Every segment endpoint is a linear
// interpolation between two adjacent REAL DEM sample points along a raw
// grid edge — extracted geometry, not fabricated.

/** Real interval, in feet — a standard low-relief topo-quad choice (USGS
 * quads commonly use 20-100ft depending on relief/scale; North Texas's real
 * ~330m/~1,090ft range gets ~22 lines at this interval, legible without
 * clutter). Every 5th (250ft) is an index contour — heavier, labeled. */
const CONTOUR_INTERVAL_FT = 50;
const CONTOUR_INTERVAL_M = CONTOUR_INTERVAL_FT / 3.28084;
const CONTOUR_INDEX_EVERY = 5;

type ContourSegment = { a: MapXZ; b: MapXZ };

function marchingSquaresLevel(level: number): ContourSegment[] {
  const n = ELEVATION_GRID_SIZE;
  const segments: ContourSegment[] = [];

  const lonAt = (j: number) => ELEVATION_MIN_LON + (ELEVATION_MAX_LON - ELEVATION_MIN_LON) * (j / (n - 1));
  const latAt = (i: number) => ELEVATION_MIN_LAT + (ELEVATION_MAX_LAT - ELEVATION_MIN_LAT) * (i / (n - 1));
  const valueAt = (i: number, j: number) => ELEVATION_METERS[i * n + j];
  const pointAt = (i: number, j: number): MapXZ => projectLonLat([lonAt(j), latAt(i)]);

  const interp = (pA: MapXZ, vA: number, pB: MapXZ, vB: number): MapXZ => {
    const t = (level - vA) / (vB - vA);
    return { x: pA.x + (pB.x - pA.x) * t, z: pA.z + (pB.z - pA.z) * t };
  };

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const vTL = valueAt(i, j), vTR = valueAt(i, j + 1);
      const vBL = valueAt(i + 1, j), vBR = valueAt(i + 1, j + 1);
      const pTL = pointAt(i, j), pTR = pointAt(i, j + 1);
      const pBL = pointAt(i + 1, j), pBR = pointAt(i + 1, j + 1);

      // Standard marching-squares case: which corners are above the level.
      const c = (vTL > level ? 8 : 0) | (vTR > level ? 4 : 0) | (vBR > level ? 2 : 0) | (vBL > level ? 1 : 0);
      if (c === 0 || c === 15) continue;

      const top = () => interp(pTL, vTL, pTR, vTR);
      const right = () => interp(pTR, vTR, pBR, vBR);
      const bottom = () => interp(pBL, vBL, pBR, vBR);
      const left = () => interp(pTL, vTL, pBL, vBL);

      // Saddle cases (5, 10) resolved via the average-of-4-corners tie-break
      // — a known, standard simplification for the ambiguous case.
      switch (c) {
        case 1: case 14: segments.push({ a: left(), b: bottom() }); break;
        case 2: case 13: segments.push({ a: bottom(), b: right() }); break;
        case 3: case 12: segments.push({ a: left(), b: right() }); break;
        case 4: case 11: segments.push({ a: top(), b: right() }); break;
        case 6: case 9: segments.push({ a: top(), b: bottom() }); break;
        case 7: case 8: segments.push({ a: left(), b: top() }); break;
        case 5: {
          const avg = (vTL + vTR + vBR + vBL) / 4;
          if (avg > level) { segments.push({ a: top(), b: right() }); segments.push({ a: left(), b: bottom() }); }
          else { segments.push({ a: left(), b: top() }); segments.push({ a: bottom(), b: right() }); }
          break;
        }
        case 10: {
          const avg = (vTL + vTR + vBR + vBL) / 4;
          if (avg > level) { segments.push({ a: left(), b: top() }); segments.push({ a: bottom(), b: right() }); }
          else { segments.push({ a: top(), b: right() }); segments.push({ a: left(), b: bottom() }); }
          break;
        }
      }
    }
  }
  return segments;
}

const CONTOUR_Y = -0.02; // above the terrain (-0.04), below the county extrusion (0 to 0.35)
const CONTOUR_COLOR = "#8a6d4a";
const CONTOUR_INDEX_COLOR = "#6b5334";

type ContourLevel = { elevationM: number; index: boolean; segments: ContourSegment[] };

const CONTOUR_LEVELS: ContourLevel[] = (() => {
  const start = Math.ceil(ELEVATION_MIN_M / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M;
  const levels: ContourLevel[] = [];
  let n = 0;
  for (let m = start; m <= ELEVATION_MAX_M; m += CONTOUR_INTERVAL_M, n++) {
    levels.push({ elevationM: m, index: n % CONTOUR_INDEX_EVERY === 0, segments: marchingSquaresLevel(m) });
  }
  return levels;
})();

function segmentsToLineGeometry(levels: ContourLevel[]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const level of levels) {
    for (const seg of level.segments) {
      positions.push(seg.a.x, CONTOUR_Y, seg.a.z, seg.b.x, CONTOUR_Y, seg.b.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

const REGULAR_CONTOUR_GEOMETRY = segmentsToLineGeometry(CONTOUR_LEVELS.filter((l) => !l.index));
const INDEX_CONTOUR_GEOMETRY = segmentsToLineGeometry(CONTOUR_LEVELS.filter((l) => l.index));

/** Real contour lines, pooled into two draw calls (regular / index) rather
 * than one <Line> per segment or per level. */
function ContourLines() {
  return (
    <>
      <lineSegments geometry={REGULAR_CONTOUR_GEOMETRY}>
        <lineBasicMaterial color={CONTOUR_COLOR} transparent opacity={0.4} />
      </lineSegments>
      <lineSegments geometry={INDEX_CONTOUR_GEOMETRY}>
        <lineBasicMaterial color={CONTOUR_INDEX_COLOR} transparent opacity={0.65} linewidth={1.5} />
      </lineSegments>
      {CONTOUR_LEVELS.filter((l) => l.index && l.segments.length > 0).map((l) => {
        const mid = l.segments[Math.floor(l.segments.length / 2)];
        const pos: MapXZ = { x: (mid.a.x + mid.b.x) / 2, z: (mid.a.z + mid.b.z) / 2 };
        return (
          <Text
            key={l.elevationM}
            position={[pos.x, CONTOUR_Y + 0.01, pos.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.9}
            color={CONTOUR_INDEX_COLOR}
            fillOpacity={0.75}
            anchorX="center"
            anchorY="middle"
          >
            {`${Math.round(metersToFeet(l.elevationM)).toLocaleString()}'`}
          </Text>
        );
      })}
    </>
  );
}

// ── "Wet Utilities" (Water / Sewer / Storm Drain) — ILLUSTRATIVE ONLY. ──
// Real municipal utility line data is fragmented per-jurisdiction and not
// available as a bulk dataset the way county/state/elevation data is — so
// this is a clearly-disclosed schematic overlay, same honesty convention as
// Manufacturing's illustrative instruction durations and Factory's
// illustrative Gantt bars. No real road-network geometry exists anywhere in
// this app's data (checked before writing this), so this deliberately does
// NOT claim road-right-of-way alignment — a plausible orthogonal grid
// instead, at a reasonable illustrative interval, clipped to the real North
// Texas county cluster (never drawn over the USA backdrop).

const WET_UTILITY_SPACING_KM = 8;
const WET_UTILITY_SAMPLE_STEP_KM = 1.5;
const WET_UTILITY_Y = -0.015; // above contours (-0.02), below the county extrusion

function pointInAnyCounty(pt: MapXZ): boolean {
  for (const county of PROJECTED_COUNTIES) {
    for (const ring of county.rings) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const pi = ring[i], pj = ring[j];
        const intersect = pi.z > pt.z !== pj.z > pt.z && pt.x < ((pj.x - pi.x) * (pt.z - pi.z)) / (pj.z - pi.z) + pi.x;
        if (intersect) inside = !inside;
      }
      if (inside) return true;
    }
  }
  return false;
}

const WET_UTILITY_EXTENT = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of PROJECTED_COUNTIES) {
    for (const ring of c.rings) {
      for (const p of ring) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
    }
  }
  return { minX, maxX, minZ, maxZ };
})();

/** Grid lines at `spacingKm` (offset by `offsetKm`), clipped to the real
 * county cluster by sampling every `WET_UTILITY_SAMPLE_STEP_KM` and only
 * keeping sub-segments where both endpoints land inside a real county —
 * an approximation of true polygon clipping, appropriate for a schematic
 * layer that's explicitly disclosed as illustrative, not survey-grade. */
function clippedUtilityGrid(spacingKm: number, offsetKm: number): ContourSegment[] {
  const { minX, maxX, minZ, maxZ } = WET_UTILITY_EXTENT;
  const segments: ContourSegment[] = [];

  const clipLine = (points: MapXZ[]) => {
    for (let i = 0; i < points.length - 1; i++) {
      if (pointInAnyCounty(points[i]) && pointInAnyCounty(points[i + 1])) {
        segments.push({ a: points[i], b: points[i + 1] });
      }
    }
  };

  for (let x = minX + offsetKm; x <= maxX; x += spacingKm) {
    const points: MapXZ[] = [];
    for (let z = minZ; z <= maxZ; z += WET_UTILITY_SAMPLE_STEP_KM) points.push({ x, z });
    clipLine(points);
  }
  for (let z = minZ + offsetKm; z <= maxZ; z += spacingKm) {
    const points: MapXZ[] = [];
    for (let x = minX; x <= maxX; x += WET_UTILITY_SAMPLE_STEP_KM) points.push({ x, z });
    clipLine(points);
  }
  return segments;
}

// Real-world-adjacent civil-drafting convention: blue = water, green = sewer,
// a third distinct color = storm drain. Hues chosen to stay distinguishable
// from the terrain/contour palette (cooler, more saturated than the muted
// olive/tan/brown already in use there).
const WATER_COLOR = "#4a7fa8";
const SEWER_COLOR = "#4a8f6e";
const STORM_COLOR = "#8a7aa8";

const WATER_SEGMENTS = clippedUtilityGrid(WET_UTILITY_SPACING_KM, 0);
const SEWER_SEGMENTS = clippedUtilityGrid(WET_UTILITY_SPACING_KM, WET_UTILITY_SPACING_KM / 2);
const STORM_SEGMENTS = clippedUtilityGrid(WET_UTILITY_SPACING_KM, WET_UTILITY_SPACING_KM / 4);

function segmentsToGeometry(segs: ContourSegment[]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const s of segs) positions.push(s.a.x, WET_UTILITY_Y, s.a.z, s.b.x, WET_UTILITY_Y, s.b.z);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

const WATER_GEOMETRY = segmentsToGeometry(WATER_SEGMENTS);
const SEWER_GEOMETRY = segmentsToGeometry(SEWER_SEGMENTS);
const STORM_GEOMETRY = segmentsToGeometry(STORM_SEGMENTS);

/** Illustrative-only wet utilities layer — see the mandatory disclosure
 * caption this ties to in the toolbar/footer, not just this component's own
 * doc comment. Subdued opacity throughout — a supporting layer, never meant
 * to compete with county lines, massing, or the F»F corridor. */
function WetUtilities() {
  return (
    <>
      <lineSegments geometry={WATER_GEOMETRY}>
        <lineBasicMaterial color={WATER_COLOR} transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={SEWER_GEOMETRY}>
        <lineBasicMaterial color={SEWER_COLOR} transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={STORM_GEOMETRY}>
        <lineBasicMaterial color={STORM_COLOR} transparent opacity={0.5} />
      </lineSegments>
    </>
  );
}

// ── Roads — real Interstate/US/State highway geometry (USGS TNM /
// TIGER-Line, see projectedMapData.ts + northTexasRoads.ts for the real
// source/merge/simplify pipeline). A supporting layer here (subdued,
// same restraint as Contours/Graticule) — Logistics' own map
// (features/logistics/LogisticsMap.tsx) renders this same real data far
// more prominently, since roads are that map's actual subject rather
// than context. ──

const ROADS_Y = COUNTY_DEPTH + 0.015; // above the Graticule (+0.01), below county labels (+0.05)
const ROAD_INTERSTATE_COLOR = "#b8763f";
const ROAD_HIGHWAY_COLOR = "#c9ad8a";

function roadsToGeometry(cls: "interstate" | "highway"): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const road of PROJECTED_ROADS) {
    if (road.class !== cls) continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i], b = road.points[i + 1];
      positions.push(a.x, ROADS_Y, a.z, b.x, ROADS_Y, b.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

const INTERSTATE_ROAD_GEOMETRY = roadsToGeometry("interstate");
const HIGHWAY_ROAD_GEOMETRY = roadsToGeometry("highway");

/** Real Interstate/US/State highway lines, pooled into two draw calls (matching ContourLines' regular/index pattern) rather than one <Line> per route. */
function Roads() {
  return (
    <>
      <lineSegments geometry={HIGHWAY_ROAD_GEOMETRY}>
        <lineBasicMaterial color={ROAD_HIGHWAY_COLOR} transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={INTERSTATE_ROAD_GEOMETRY}>
        <lineBasicMaterial color={ROAD_INTERSTATE_COLOR} transparent opacity={0.7} linewidth={1.5} />
      </lineSegments>
    </>
  );
}

function countyGeometry(county: ProjectedCounty): THREE.ExtrudeGeometry {
  // Shape space (x, y) → world (x, 0, -y) under the -90° X rotation, so
  // shape y = -world z keeps the map north-up.
  const shapes = county.rings.map((ring) => {
    const shape = new THREE.Shape();
    ring.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)));
    return shape;
  });
  return new THREE.ExtrudeGeometry(shapes, { depth: COUNTY_DEPTH, bevelEnabled: false });
}

function County({
  county,
  placing,
  onPlace,
}: {
  county: ProjectedCounty;
  placing: boolean;
  onPlace: (coords: MapXZ) => void;
}) {
  const geometry = useMemo(() => countyGeometry(county), [county]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!placing) return; // normal-mode ground clicks are a no-op (same as Factory's miss behavior)
    e.stopPropagation();
    onPlace({ x: e.point.x, z: e.point.z });
  };

  return (
    <group>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
        {/* Translucent — the real elevation-tinted terrain underneath should read through, not be hidden by a flat fill. */}
        <meshStandardMaterial color={county.core ? COUNTY_CORE : COUNTY_NEIGHBOR} transparent opacity={0.28} />
      </mesh>
      {county.rings.map((ring, i) => (
        <Line
          key={i}
          points={ring.map((p) => [p.x, COUNTY_DEPTH + 0.02, p.z] as [number, number, number])}
          color={COUNTY_BORDER}
          lineWidth={1}
        />
      ))}
      <Text
        position={[county.centroid.x, COUNTY_DEPTH + 0.05, county.centroid.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={county.core ? 3.1 : 2.5}
        color={county.core ? TEXT_SECONDARY : TEXT_MUTED}
        fillOpacity={county.core ? 0.85 : 0.55}
        anchorX="center"
        anchorY="middle"
      >
        {county.name}
      </Text>
    </group>
  );
}

// ── Site massing ──

type SetSelected = ReturnType<typeof useSelection>["setSelected"];

function selectionPayload(name: string) {
  // Same honest payload the old block viewport sent — no real per-project
  // progress/trade/inspector data exists at project level.
  return { name, progress: "—", trade: "—", inspector: "—", punchListCount: "—" };
}

/**
 * Wraps one site's massing: click-to-select (same SelectionContext shape
 * Browse uses), hover sync with the Browse panel (both directions via the
 * site store), and Box3-derived outlines for hover/selection — the same
 * technique as Factory's SubsystemGroup, minus status coloring (no real
 * per-project status exists; the old block view made the same call).
 */
function SiteGroup({
  id,
  objectType,
  title,
  position,
  elevationFt,
  selected,
  hovered,
  placing,
  setSelected,
  children,
}: {
  id: string;
  objectType: string;
  title: string;
  position: MapXZ;
  /** Real elevation at this site's real lon/lat, in feet — undefined only when no real coordinate exists for it. */
  elevationFt: number | undefined;
  selected: boolean;
  hovered: boolean;
  placing: boolean;
  setSelected: SetSelected;
  children: ReactNode;
}) {
  const massingRef = useRef<THREE.Group>(null);
  const [box, setBox] = useState<THREE.Box3 | null>(null);

  useLayoutEffect(() => {
    if (!massingRef.current) return;
    // Box3.setFromObject trusts each descendant's cached matrixWorld — on a
    // freshly-mounted group, R3F hasn't run a render pass yet, so that cache
    // can still be stale/identity, and the computed box lands in local
    // (untransformed) space instead of world space. Confirmed live: a
    // freshly-placed site's hover/selected outline rendered near the map's
    // coordinate origin (~[0, LON0/LAT0]) instead of the site's real
    // position, permanently, since this effect never re-fires on its own.
    // Forcing the world matrix fresh here (parents AND children) before
    // measuring eliminates the race.
    massingRef.current.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(massingRef.current);
    if (!b.isEmpty()) setBox(b);
    // Massing is static per position; recompute only when the site moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.z]);

  const outline = (grow: number, color: string, width: number) => {
    if (!box) return null;
    const size = box.getSize(new THREE.Vector3());
    // Box3.setFromObject returns WORLD-space coordinates, but this outline
    // renders inside the site root group, which is already translated to the
    // anchor — subtract the root's translation or the anchor applies twice
    // (found live: the outline floated ~35 km off a freshly placed site).
    const center = box.getCenter(new THREE.Vector3()).sub(new THREE.Vector3(position.x, COUNTY_DEPTH, position.z));
    return (
      <lineSegments position={center}>
        <edgesGeometry args={[new THREE.BoxGeometry(size.x + grow, size.y + grow, size.z + grow)]} />
        <lineBasicMaterial color={color} linewidth={width} />
      </lineSegments>
    );
  };

  return (
    <group position={[position.x, COUNTY_DEPTH, position.z]}>
      <group
        ref={massingRef}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (placing) return; // fall through so the county underneath takes the placement click
          e.stopPropagation();
          setSelected({ feature: "construction", objectType, objectId: id, payload: selectionPayload(title) });
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHoveredSite(id);
        }}
        onPointerOut={() => setHoveredSite(null)}
      >
        {children}
      </group>
      {hovered && !selected && outline(0.25, ACCENT, 1.2)}
      {selected && outline(0.3, ACCENT, 2.5)}
      <Text
        position={[0, 0.06, 4.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.9}
        color={TEXT_SECONDARY}
        anchorX="center"
        anchorY="top"
        fontWeight="bold"
      >
        {title}
      </Text>
      {elevationFt !== undefined && (
        <Text
          position={[0, 0.06, 6.0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.6}
          color={TEXT_SECONDARY}
          anchorX="center"
          anchorY="top"
        >
          {`${Math.round(elevationFt).toLocaleString()} ft elev.`}
        </Text>
      )}
    </group>
  );
}

function ApproxRing({ region }: { region: string }) {
  const points = useMemo(() => {
    const R = 8.5;
    return Array.from({ length: 49 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return [Math.cos(a) * R, 0.06, Math.sin(a) * R] as [number, number, number];
    });
  }, []);
  return (
    <>
      <Line points={points} color={TEXT_MUTED} lineWidth={1.4} dashed dashSize={1.4} gapSize={1} />
      <Text
        position={[0, 0.06, 6.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.25}
        color={TEXT_MUTED}
        anchorX="center"
        anchorY="top"
      >
        {`approximate — county-level (${region} County)`}
      </Text>
    </>
  );
}

function MassingBox({ x = 0, z = 0, w, d, h, color = PROJECT_COLOR }: { x?: number; z?: number; w: number; d: number; h: number; color?: string }) {
  return (
    <mesh position={[x, h / 2, z]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/**
 * Symbolic massing per project, driven by real specs (heights/counts are
 * the real facts; footprints and the km-per-story scale are symbolic and
 * disclosed in-scene):
 * - Skyline Towers: single 40-story high-rise (fixture: floors(40))
 * - Garden Lofts: single 20-story tower (fixture + garden_lofts_params_v2.json)
 * - Cedarwood Flats: five 5-story buildings A–E (fixture children A–E)
 * - Stonepine Residences: 200-unit single-family subdivision (fixture
 *   comment) — a spread of small footprints, not a tower. 24 symbolic
 *   house footprints stand in for the 200 real units.
 */
function ProjectMassing({ projectId }: { projectId: string }) {
  switch (projectId) {
    case "skyline":
      return <MassingBox w={3} d={3} h={40 * STORY} />;
    case "garden-lofts":
      return <MassingBox w={3.4} d={2.4} h={20 * STORY} />;
    case "cedarwood":
      return (
        <>
          {[-5.2, -2.6, 0, 2.6, 5.2].map((x) => (
            <MassingBox key={x} x={x} w={2} d={1.4} h={5 * STORY} />
          ))}
        </>
      );
    case "stonepine":
      return (
        <>
          {Array.from({ length: 24 }, (_, i) => {
            const col = i % 6;
            const row = Math.floor(i / 6);
            return (
              <MassingBox key={i} x={(col - 2.5) * 1.5} z={(row - 1.5) * 1.5} w={0.8} d={0.8} h={0.45} />
            );
          })}
        </>
      );
    default:
      return null;
  }
}

function FactoryMassing() {
  return (
    <>
      <MassingBox w={8} d={5} h={1.2} color={ACCENT} />
      <MassingBox x={5.2} z={1} w={2.2} d={2.6} h={0.7} color={ACCENT} />
    </>
  );
}

// ── F»F delivery corridors ──

/**
 * Delivery corridor arc from Chappell International to a project site.
 * Dashed when the endpoint is only county-level approximate.
 *
 * Phase 3 (cross-nav): clickable, same as any other real site object —
 * reveals the underlying real project (setSelected) and jumps to Logistics'
 * map framed on this corridor's real endpoints (see corridorNav.ts for why
 * that second part travels via router state rather than SelectionContext).
 * The arc itself renders exactly as before — unchanged.
 *
 * The real click target is a small marker at the arc's real peak (its
 * highest, most visually distinct point, already the arc's natural
 * "midpoint" affordance) using ordinary mesh raycasting, not the arc's own
 * thin Line2 geometry. Found live that trying to make the thin arc itself
 * (even with a widened Line2 raycast threshold, even trimmed by real XZ
 * distance from both endpoints) directly clickable kept winning over the
 * factory massing's own click zone right at the shared origin — the
 * elevated curve visually passes close over the factory box from this
 * camera angle regardless of how it's trimmed, an artifact of screen-space
 * projection, not real-world distance. A small precise marker mesh, using
 * the same reliable raycasting SiteGroup/FactoryMassing already use, avoids
 * that fight entirely and gives users an obvious, discoverable place to
 * click rather than expecting a precise hit on a 1.6px line.
 */
function Corridor({ to, approx, onSelect }: { to: MapXZ; approx: boolean; onSelect: (e: ThreeEvent<MouseEvent>) => void }) {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(FACTORY_COORDS.x, COUNTY_DEPTH + 0.6, FACTORY_COORDS.z);
    const end = new THREE.Vector3(to.x, COUNTY_DEPTH + 0.6, to.z);
    const mid = start.clone().lerp(end, 0.5);
    mid.y = Math.max(5, start.distanceTo(end) * 0.2);
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [to.x, to.z]);
  const points = useMemo(() => curve.getPoints(48), [curve]);
  const peak = useMemo(() => curve.getPoint(0.5), [curve]);

  return (
    <>
      <Line points={points} color={ACCENT} lineWidth={1.6} transparent opacity={0.65} dashed={approx} dashSize={1.6} gapSize={1.1} />
      <mesh
        position={peak}
        onClick={onSelect}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[2.6, 12, 12]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.85} />
      </mesh>
    </>
  );
}

// ── Scene root ──

function MapScene({
  sites,
  selectedId,
  hoveredId,
  placementFor,
  showCorridors,
  showGraticule,
  showContours,
  showWetUtilities,
  showRoads,
  setSelected,
  onCorridorClick,
}: {
  sites: ResolvedSite[];
  selectedId: string | undefined;
  hoveredId: string | null;
  placementFor: string | null;
  showCorridors: boolean;
  showGraticule: boolean;
  showContours: boolean;
  showWetUtilities: boolean;
  showRoads: boolean;
  setSelected: SetSelected;
  onCorridorClick: (target: CorridorTarget) => void;
}) {
  const titleOf = (projectId: string) => constructionProjects.find((p) => p.id === projectId)?.title ?? projectId;

  /** Where a site renders: exact coords when sited, county centroid when region-level, nowhere when unlocated. */
  const anchorOf = (site: ResolvedSite): MapXZ | undefined => {
    if (site.coords) return site.coords;
    if (site.precision === "region" && site.region) return countyCentroid(site.region);
    return undefined;
  };

  /**
   * Real elevation (feet) at a site's real lon/lat — sited/address precision
   * inverse-projects the clicked map coords back to real lon/lat (exact,
   * see mapProjection.ts); region precision uses the real county centroid
   * lon/lat directly (already real, no round-trip through the map
   * projection needed). Undefined only when no real coordinate exists.
   */
  const elevationFtOf = (site: ResolvedSite): number | undefined => {
    if (site.coords) return metersToFeet(elevationAt(unprojectXZ(site.coords)));
    if (site.precision === "region" && site.region) {
      const county = NORTH_TEXAS_COUNTIES.find((c) => c.name === site.region);
      if (county) return metersToFeet(elevationAt(county.centroid));
    }
    return undefined;
  };

  return (
    <group>
      {/* Real continental US backdrop — replaces the old flat grey placeholder rectangle. */}
      <USAOutline />

      {/* Real elevation-tinted terrain, covering the real fetched grid extent. */}
      <Terrain />

      {/* Real contour lines extracted from the same real DEM grid — the actual topo-map-defining layer. */}
      {showContours && <ContourLines />}

      {/* ILLUSTRATIVE ONLY — see the mandatory disclosure caption whenever this is toggled on. */}
      {showWetUtilities && <WetUtilities />}

      {PROJECTED_COUNTIES.map((c) => (
        <County
          key={c.name}
          county={c}
          placing={placementFor !== null}
          onPlace={(coords) => placementFor && setSiteCoords(placementFor, coords)}
        />
      ))}

      {showGraticule && <Graticule />}

      {/* Real Interstate/US/State highway geometry — supporting layer here, see Roads()'s own doc comment. */}
      {showRoads && <Roads />}

      {/* Factory node — real, precise (Saginaw, TX, real geography) */}
      <SiteGroup
        id={FACTORY_NODE.id}
        objectType="Factory"
        title={FACTORY_NODE.title}
        position={FACTORY_COORDS}
        elevationFt={metersToFeet(elevationAt(FACTORY_NODE.lonLat))}
        selected={selectedId === FACTORY_NODE.id}
        hovered={hoveredId === FACTORY_NODE.id}
        placing={placementFor !== null}
        setSelected={setSelected}
      >
        <FactoryMassing />
      </SiteGroup>

      {/* Project sites — only those with an honest place to stand */}
      {sites.map((site) => {
        const anchor = anchorOf(site);
        if (!anchor) return null;
        return (
          <group key={site.projectId}>
            <SiteGroup
              id={site.projectId}
              objectType="Project"
              title={titleOf(site.projectId)}
              position={anchor}
              elevationFt={elevationFtOf(site)}
              selected={selectedId === site.projectId}
              hovered={hoveredId === site.projectId}
              placing={placementFor !== null}
              setSelected={setSelected}
            >
              <ProjectMassing projectId={site.projectId} />
            </SiteGroup>
            {site.precision === "region" && site.region && (
              <group position={[anchor.x, COUNTY_DEPTH, anchor.z]}>
                <ApproxRing region={site.region} />
              </group>
            )}
            {showCorridors && (
              <Corridor
                to={anchor}
                approx={site.precision === "region"}
                onSelect={(e) => {
                  e.stopPropagation();
                  onCorridorClick({
                    projectId: site.projectId,
                    title: titleOf(site.projectId),
                    coords: anchor,
                    approx: site.precision === "region",
                  });
                }}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

export default function ConstructionMap() {
  const { selected, setSelected } = useSelection();
  const { overrides, placementFor, hoveredId } = useSiteState();
  const navigate = useNavigate();
  const [showCorridors, setShowCorridors] = useState(true);
  const [showGraticule, setShowGraticule] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [showWetUtilities, setShowWetUtilities] = useState(false);
  const [showRoads, setShowRoads] = useState(true);
  const compassNeedleRef = useRef<HTMLDivElement>(null);

  const selectedId = selected?.feature === "construction" ? selected.objectId : undefined;
  const sites = constructionProjects.map((p) => resolveSite(p.id, overrides));
  const placingTitle = placementFor
    ? constructionProjects.find((p) => p.id === placementFor)?.title ?? placementFor
    : null;

  /**
   * Phase 3 cross-nav: reuses the Factory→Robotics pattern's real half
   * (setSelected, with the honest "construction" shape for what was
   * actually clicked — the real project, not a fabricated logistics
   * shipment) plus a real navigate() to Logistics — but the corridor's real
   * endpoint travels via router state, not through setSelected's payload.
   * See corridorNav.ts for why.
   */
  const handleCorridorClick = (target: CorridorTarget) => {
    setSelected({ feature: "construction", objectType: "Project", objectId: target.projectId, payload: selectionPayload(target.title) });
    navigate("/logistics", { state: { corridorTarget: target } satisfies CorridorNavState });
  };

  // Esc cancels placement mode.
  useEffect(() => {
    if (!placementFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelPlacement();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementFor]);

  return (
    <PanelCard title="Construction Enterprises Map" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="flex flex-wrap items-center gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color={PROJECT_COLOR} label="Project" />
        <Legend color={ACCENT} label="Chappell International (F»F hub)" />
        <button
          type="button"
          onClick={() => setShowCorridors((v) => !v)}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            showCorridors
              ? { background: "var(--ff-accent)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
          title="Factory-to-site delivery corridors — dashed where the site is only county-level approximate"
        >
          F»F Corridors
        </button>
        <button
          type="button"
          onClick={() => setShowGraticule((v) => !v)}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            showGraticule
              ? { background: "var(--ff-accent)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
          title="Real WGS84 latitude/longitude gridlines, 0.5° steps — derived from the same Census county data as the map itself"
        >
          Lat/Lon Grid
        </button>
        <button
          type="button"
          onClick={() => setShowContours((v) => !v)}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            showContours
              ? { background: "var(--ff-accent)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
          title="Real elevation contour lines (50ft interval), extracted from the real Copernicus DEM GLO-90 grid via marching squares"
        >
          Contours
        </button>
        <button
          type="button"
          onClick={() => setShowRoads((v) => !v)}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            showRoads
              ? { background: "var(--ff-accent)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
          title="Real Interstate/US/State highway geometry (USGS National Map Transportation service, real Census TIGER/Line data)"
        >
          Roads
        </button>
        <button
          type="button"
          onClick={() => setShowWetUtilities((v) => !v)}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            showWetUtilities
              ? { background: "var(--ff-accent)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
          title="Water/Sewer/Storm Drain — illustrative/schematic only, not surveyed utility locations"
        >
          Wet Utilities
        </button>
      </div>

      <div className={`relative flex-1 ${placementFor ? "cursor-crosshair" : ""}`} style={{ background: "var(--ff-content-bg)" }}>
        <Canvas>
          <ambientLight intensity={0.85} />
          <directionalLight position={[120, 200, 80]} intensity={0.8} />
          <MapScene
            sites={sites}
            selectedId={selectedId}
            hoveredId={hoveredId}
            placementFor={placementFor}
            showCorridors={showCorridors}
            showGraticule={showGraticule}
            showContours={showContours}
            showWetUtilities={showWetUtilities}
            showRoads={showRoads}
            setSelected={setSelected}
            onCorridorClick={handleCorridorClick}
          />
          <InitialCamera />
          <CompassTracker needleRef={compassNeedleRef} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            target={SCENE_TARGET}
            maxPolarAngle={Math.PI * 0.44}
            minDistance={12}
            // maxDistance was 520 (enough to frame the ~250km North Texas
            // extent). Raised so a user can actually zoom out to see the
            // real continental US backdrop (~5,000+ km across) rather than
            // hitting a limit well short of it; default framing (CAMERA_EYE)
            // is unchanged, so the default view is still North Texas.
            maxDistance={6000}
          />
        </Canvas>

        {/* Compass — reflects the live camera orbit; the map data itself is always fixed north-up. */}
        <div
          className="absolute right-3 bottom-3 flex items-center justify-center rounded-full border"
          style={{ width: 40, height: 40, background: "var(--ff-panel-bg)", borderColor: "var(--ff-panel-border)" }}
          title="Compass — tracks the current camera angle; drag to orbit and it stays pointed at true north"
        >
          <div ref={compassNeedleRef} className="relative" style={{ width: "100%", height: "100%" }}>
            <span
              className="absolute font-bold"
              style={{ top: 2, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: ACCENT }}
            >
              N
            </span>
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: 1.5,
                height: 13,
                background: ACCENT,
                transform: "translate(-50%, -100%)",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{ left: "50%", top: "50%", width: 3, height: 3, background: TEXT_MUTED, transform: "translate(-50%, -50%)" }}
            />
          </div>
        </div>

        {placementFor && (
          <div
            className="absolute left-1/2 top-2 -translate-x-1/2 flex items-center gap-3 rounded border px-3 py-1.5 text-xs font-medium shadow-sm"
            style={{ background: "var(--ff-panel-bg)", borderColor: "var(--ff-accent)", color: "var(--ff-text-primary)" }}
          >
            Click the map to place {placingTitle}
            <button
              type="button"
              onClick={cancelPlacement}
              className="rounded px-1.5 py-0.5"
              style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }}
            >
              Cancel (Esc)
            </button>
          </div>
        )}

        {showWetUtilities && (
          <div className="absolute bottom-2 left-3">
            <p
              className="rounded px-2 py-1 text-[0.65rem] font-medium"
              style={{ background: "rgba(236, 238, 241, 0.5)", color: "var(--ff-text-muted)" }}
            >
              Wet Utilities (Water/Sewer/Storm Drain): ILLUSTRATIVE/SCHEMATIC ONLY — not surveyed or real utility locations. Before any excavation in Texas, call 811 (Texas811) at least 2 business days ahead for a real utility locate — required by law.
            </p>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
