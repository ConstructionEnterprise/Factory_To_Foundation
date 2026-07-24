import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";

import { Legend, PanelCard } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";

import { NORTH_TEXAS_COUNTIES } from "../northTexasCounties";
import { projectLonLat, unprojectXZ, type MapXZ } from "../mapProjection";
import {
  ELEVATION_MAX_LAT,
  ELEVATION_MAX_LON,
  ELEVATION_MIN_LAT,
  ELEVATION_MIN_LON,
  elevationAt,
  metersToFeet,
} from "../northTexasElevation";
import { USA_STATES } from "../usaStates";
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

// ── Counties: project the real Census rings into map space once, at module scope ──

type ProjectedCounty = {
  name: string;
  core: boolean;
  centroid: MapXZ;
  rings: MapXZ[][];
};

const PROJECTED_COUNTIES: ProjectedCounty[] = NORTH_TEXAS_COUNTIES.map((c) => ({
  name: c.name,
  core: c.core,
  centroid: projectLonLat(c.centroid),
  rings: c.rings.map((ring) => ring.map((pt) => projectLonLat(pt))),
}));

export function countyCentroid(name: string): MapXZ | undefined {
  return PROJECTED_COUNTIES.find((c) => c.name === name)?.centroid;
}

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
// Normalized against real, fixed continental-US elevation extremes — sea
// level (0m) up to Mount Whitney, CA, the real highest point in the
// contiguous 48 states (4,421m / 14,505 ft) — not this dataset's own local
// min/max. Auto-stretching a region's own min/max to the full 0–1 ramp
// would show maximum color contrast regardless of how flat the real terrain
// actually is, which overstates North Texas's genuinely modest real relief
// (74–393m here lands in just the bottom ~9% of this fixed real scale) —
// the same category of honesty problem as fabricating a number that isn't
// there. This also means the ramp is already correctly scaled for future
// real data in higher-relief states, without redesigning it later.
const USA_MIN_ELEVATION_M = 0;
const USA_MAX_ELEVATION_M = 4421;

const HYPSOMETRIC_STOPS: [number, string][] = [
  [0.0, "#dadfd2"],
  [0.09, "#ddd8c8"],
  [0.3, "#dccbb2"],
  [0.6, "#cdbaa4"],
  [1.0, "#e9e7e3"],
];

function hypsometricColor(elevationM: number): THREE.Color {
  const t = (elevationM - USA_MIN_ELEVATION_M) / (USA_MAX_ELEVATION_M - USA_MIN_ELEVATION_M);
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
 * Future hook (NOT v1 scope, deliberately not built): Logistics could
 * animate real module deliveries along these same curves — the curve
 * object here is the natural attachment point for that.
 */
function Corridor({ to, approx }: { to: MapXZ; approx: boolean }) {
  const points = useMemo(() => {
    const start = new THREE.Vector3(FACTORY_COORDS.x, COUNTY_DEPTH + 0.6, FACTORY_COORDS.z);
    const end = new THREE.Vector3(to.x, COUNTY_DEPTH + 0.6, to.z);
    const mid = start.clone().lerp(end, 0.5);
    mid.y = Math.max(5, start.distanceTo(end) * 0.2);
    return new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(48);
  }, [to.x, to.z]);
  return (
    <Line
      points={points}
      color={ACCENT}
      lineWidth={1.6}
      transparent
      opacity={0.65}
      dashed={approx}
      dashSize={1.6}
      gapSize={1.1}
    />
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
  setSelected,
}: {
  sites: ResolvedSite[];
  selectedId: string | undefined;
  hoveredId: string | null;
  placementFor: string | null;
  showCorridors: boolean;
  showGraticule: boolean;
  setSelected: SetSelected;
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

      {PROJECTED_COUNTIES.map((c) => (
        <County
          key={c.name}
          county={c}
          placing={placementFor !== null}
          onPlace={(coords) => placementFor && setSiteCoords(placementFor, coords)}
        />
      ))}

      {showGraticule && <Graticule />}

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
            {showCorridors && <Corridor to={anchor} approx={site.precision === "region"} />}
          </group>
        );
      })}
    </group>
  );
}

export default function ConstructionMap() {
  const { selected, setSelected } = useSelection();
  const { overrides, placementFor, hoveredId } = useSiteState();
  const [showCorridors, setShowCorridors] = useState(true);
  const [showGraticule, setShowGraticule] = useState(true);
  const compassNeedleRef = useRef<HTMLDivElement>(null);

  const selectedId = selected?.feature === "construction" ? selected.objectId : undefined;
  const sites = constructionProjects.map((p) => resolveSite(p.id, overrides));
  const unplaced = sites.filter((s) => s.precision === "unlocated");
  const placingTitle = placementFor
    ? constructionProjects.find((p) => p.id === placementFor)?.title ?? placementFor
    : null;

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
            setSelected={setSelected}
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

        {unplaced.length > 0 && (
          <div
            className="absolute right-3 top-2 w-52 rounded border px-3 py-2"
            style={{ background: "var(--ff-panel-bg)", borderColor: "var(--ff-panel-border)" }}
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-secondary)" }}>
              Unplaced — no real location data
            </p>
            <ul className="mt-1 space-y-0.5">
              {unplaced.map((site) => {
                const title = constructionProjects.find((p) => p.id === site.projectId)?.title ?? site.projectId;
                return (
                  <li key={site.projectId}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected({
                          feature: "construction",
                          objectType: "Project",
                          objectId: site.projectId,
                          payload: selectionPayload(title),
                        })
                      }
                      className="w-full rounded px-1.5 py-0.5 text-left text-xs hover:bg-gray-100"
                      style={{
                        color: selectedId === site.projectId ? "var(--ff-accent)" : "var(--ff-text-primary)",
                        fontWeight: selectedId === site.projectId ? 600 : 400,
                      }}
                    >
                      {title}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-[0.6rem] leading-snug" style={{ color: "var(--ff-text-muted)" }}>
              Select one, then use "Site this project" in the Selected panel.
            </p>
          </div>
        )}

        <p
          className="absolute bottom-2 left-3 rounded px-2 py-1 text-[0.65rem]"
          style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }}
        >
          County & state boundaries: real US Census data · terrain: real elevation (Copernicus DEM GLO-90) · building massing symbolic (real story counts, not to scale)
        </p>
      </div>
    </PanelCard>
  );
}
