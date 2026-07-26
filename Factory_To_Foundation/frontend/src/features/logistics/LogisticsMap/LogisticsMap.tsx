import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";

import { Legend, PanelCard } from "@/framework/ui";

import { PROJECTED_COUNTIES, PROJECTED_ROADS, type ProjectedRoad } from "@/features/construction/projectedMapData";
import { FACTORY_COORDS, FACTORY_NODE } from "@/features/construction/constructionLocations";
import type { MapXZ } from "@/features/construction/mapProjection";

/**
 * Logistics Enterprises Map (Phase 2 of the Logistics brief) — real North
 * Texas county context + the real Interstate/US/State highway network
 * (same real projectedMapData.ts source Construction's map's "Roads"
 * toggle uses), rendered as THIS map's actual subject rather than a
 * supporting layer: thicker lines, more saturated color, real route labels
 * on the major interstates. Same bespoke react-three-fiber pattern proven
 * three times now (Manufacturing's GeometryViewport, Factory's
 * FactoryGeometryViewport, Construction's ConstructionMap) — manual
 * initial-camera + explicit OrbitControls target, since drei's `Bounds`
 * fit is confirmed unreliable alongside OrbitControls in this codebase.
 *
 * Real, honest scope for this phase: county outlines + roads + the real
 * Chappell International factory location, camera defaulting there (its
 * real Saginaw, TX geography — every F»F corridor's real origin). Real
 * dispatch/truck/module data and corridor-click cross-navigation are later
 * phases (4/6 real data, 3 cross-nav) — this is the base map they'll land
 * markers/routes on, not yet wired to either.
 */

const ACCENT = "#d9631e";
const TEXT_SECONDARY = "#5b6472";
const TEXT_MUTED = "#8b93a1";
const COUNTY_FILL_CORE = "#f2f0ec";
const COUNTY_FILL_NEIGHBOR = "#eceef1";
const COUNTY_BORDER = "#d8dbe0";

// More prominent than Construction's own "Roads" toggle (ROAD_INTERSTATE_COLOR
// #b8763f there) — roads are this map's actual subject, not a supporting layer.
const INTERSTATE_COLOR = "#c0392b";
const HIGHWAY_COLOR = "#d98a3d";
const ROADS_Y = 0.03;

const SCENE_TARGET: [number, number, number] = [FACTORY_COORDS.x, 0, FACTORY_COORDS.z];
const CAMERA_EYE: [number, number, number] = [FACTORY_COORDS.x, 90, FACTORY_COORDS.z + 70];

function InitialCamera() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  useLayoutEffect(() => {
    camRef.current?.position.set(...CAMERA_EYE);
    camRef.current?.lookAt(...SCENE_TARGET);
  }, []);
  return <PerspectiveCamera ref={camRef} makeDefault fov={45} near={1} far={2000} />;
}

function CountyOutline({ county }: { county: (typeof PROJECTED_COUNTIES)[number] }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const ring = county.rings[0];
    ring.forEach((p, i) => (i === 0 ? s.moveTo(p.x, -p.z) : s.lineTo(p.x, -p.z)));
    return s;
  }, [county]);
  const geometry = useMemo(() => new THREE.ShapeGeometry(shape), [shape]);

  return (
    <group>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <meshBasicMaterial color={county.core ? COUNTY_FILL_CORE : COUNTY_FILL_NEIGHBOR} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {county.rings.map((ring, i) => (
        <Line key={i} points={ring.map((p) => [p.x, 0.01, p.z] as [number, number, number])} color={COUNTY_BORDER} lineWidth={1} />
      ))}
      <Text
        position={[county.centroid.x, 0.02, county.centroid.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={county.core ? 2.6 : 2.1}
        color={TEXT_MUTED}
        fillOpacity={county.core ? 0.6 : 0.4}
        anchorX="center"
        anchorY="middle"
      >
        {county.name}
      </Text>
    </group>
  );
}

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

const INTERSTATE_GEOMETRY = roadsToGeometry("interstate");
const HIGHWAY_GEOMETRY = roadsToGeometry("highway");

// ── Label normalization + proximity dedup ──
// Real bug found live: labels were duplicating/overlapping (e.g.
// "President George Bush Hwy" and "President George Bush Tpke" both
// rendering, "I- 635"/"635"/"I-635 Hov" all rendering separately). Root
// cause, confirmed against the real data: TIGER's own source fields are
// populated inconsistently across real segments of the SAME corridor (a
// literal stray-space formatting artifact, a bare route number on some
// segments vs. "I-<n>" on others, an HOV-lane-specific name for managed-
// lane segments of the same real interstate, an official corridor
// alternating between two generic road-type suffixes like "... Tpke" and
// "... Hwy"). This is NOT a geometric merge failure — differently-labeled
// real segments were never eligible to merge with each other in Phase 2's
// line-merge (grouped strictly by exact (class,label)), so the same real
// corridor legitimately produced multiple separate objects under
// different exact strings. Confirmed via psql-equivalent direct grep
// against northTexasRoads.ts before writing this, not assumed.

/** Priority order for which generic road-type suffix wins as the canonical
 * display name when the same real corridor carries more than one across
 * its real segments. */
const ROAD_SUFFIXES = ["Tpke", "Fwy", "Expy", "Pkwy", "Hwy"] as const;

function normalizeRouteLabel(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ");
  s = s.replace(/^I-\s+/, "I-"); // real stray-space artifact ("I- 635" -> "I-635")
  s = s.replace(/\s+Hov$/i, ""); // real HOV/managed-lane naming for the same real corridor
  if (/^\d+$/.test(s)) s = `I-${s}`; // bare route number on a real interstate-class segment
  return s;
}

/** Strips a trailing generic road-type suffix to detect when two
 * differently-suffixed real strings actually name the same real corridor. */
function routeGroupKey(normalized: string): string {
  for (const suffix of ROAD_SUFFIXES) {
    if (normalized.endsWith(` ${suffix}`)) return normalized.slice(0, -(suffix.length + 1));
  }
  return normalized;
}

function canonicalDisplayLabel(members: string[]): string {
  for (const suffix of ROAD_SUFFIXES) {
    const match = members.find((m) => m.endsWith(` ${suffix}`));
    if (match) return match;
  }
  return members[0];
}

/** Real named interstates only (rarer, more important) get an in-scene label — every named highway would be too visually busy at this map's scale. */
function interstateLabels(): { key: string; label: string; pos: MapXZ }[] {
  // Group real fragments by normalized corridor identity first (collapses
  // known label variants of the same real route to one entry).
  const groups = new Map<string, { members: string[]; points: MapXZ[] }>();
  for (const road of PROJECTED_ROADS as ProjectedRoad[]) {
    if (road.class !== "interstate" || !road.label) continue;
    const normalized = normalizeRouteLabel(road.label);
    const groupKey = routeGroupKey(normalized);
    if (!groups.has(groupKey)) groups.set(groupKey, { members: [], points: [] });
    const g = groups.get(groupKey)!;
    g.members.push(normalized);
    g.points.push(...road.points);
  }

  const candidates = Array.from(groups.entries()).map(([groupKey, g]) => {
    // Real centroid across every real fragment sharing this canonical
    // corridor — more representative than an arbitrary first-fragment
    // midpoint when a route remains split into many real pieces (e.g. the
    // 9+3 President George Bush Tpke/Hwy fragments combined).
    const cx = g.points.reduce((s, p) => s + p.x, 0) / g.points.length;
    const cz = g.points.reduce((s, p) => s + p.z, 0) / g.points.length;
    // Real total polyline length — used below to prefer the more
    // significant real corridor when two labels collide geographically.
    let length = 0;
    for (let i = 0; i < g.points.length - 1; i++) length += Math.hypot(g.points[i + 1].x - g.points[i].x, g.points[i + 1].z - g.points[i].z);
    return { key: groupKey, label: canonicalDisplayLabel(g.members), pos: { x: cx, z: cz }, length };
  });

  // Real geographic proximity suppression, independent of name — catches
  // both genuinely-different nearby real names (e.g. N/S Walton Walker
  // Blvd) and any remaining same-corridor fragments normalization above
  // didn't group (a real fork/gap, not just a naming inconsistency).
  // Processed longest-corridor-first so a minor crossing road doesn't
  // arbitrarily win over a major one it happens to be near.
  const MIN_LABEL_SPACING_KM = 3.5;
  const kept: typeof candidates = [];
  for (const c of [...candidates].sort((a, b) => b.length - a.length)) {
    const tooClose = kept.some((k) => Math.hypot(k.pos.x - c.pos.x, k.pos.z - c.pos.z) < MIN_LABEL_SPACING_KM);
    if (!tooClose) kept.push(c);
  }
  return kept;
}
const INTERSTATE_LABELS = interstateLabels();

function Roads() {
  return (
    <>
      <lineSegments geometry={HIGHWAY_GEOMETRY}>
        <lineBasicMaterial color={HIGHWAY_COLOR} transparent opacity={0.85} />
      </lineSegments>
      <lineSegments geometry={INTERSTATE_GEOMETRY}>
        <lineBasicMaterial color={INTERSTATE_COLOR} transparent opacity={0.95} linewidth={2.5} />
      </lineSegments>
      {INTERSTATE_LABELS.map((l) => (
        <Text
          key={l.key}
          position={[l.pos.x, ROADS_Y + 0.02, l.pos.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.4}
          color={INTERSTATE_COLOR}
          fillOpacity={0.85}
          fontWeight="bold"
          anchorX="center"
          anchorY="middle"
        >
          {l.label}
        </Text>
      ))}
    </>
  );
}

function FactoryLandmark() {
  return (
    <group position={[FACTORY_COORDS.x, 0.02, FACTORY_COORDS.z]}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[8, 1.2, 5]} />
        <meshStandardMaterial color={ACCENT} />
      </mesh>
      <mesh position={[5.2, 0.35, 1]}>
        <boxGeometry args={[2.2, 0.7, 2.6]} />
        <meshStandardMaterial color={ACCENT} />
      </mesh>
      <Text position={[0, 0.03, 4.2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.9} color={TEXT_SECONDARY} fontWeight="bold" anchorX="center" anchorY="top">
        {FACTORY_NODE.title}
      </Text>
    </group>
  );
}

function MapScene() {
  return (
    <group>
      {PROJECTED_COUNTIES.map((c) => (
        <CountyOutline key={c.name} county={c} />
      ))}
      <Roads />
      <FactoryLandmark />
    </group>
  );
}

export default function LogisticsMap() {
  return (
    <PanelCard title="Logistics Enterprises Map" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="flex flex-wrap items-center gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color={INTERSTATE_COLOR} label="Interstate / Controlled-Access Highway" />
        <Legend color={HIGHWAY_COLOR} label="US / State Highway" />
        <Legend color={ACCENT} label="Chappell International (F»F hub)" />
      </div>

      <div className="relative flex-1" style={{ background: "var(--ff-content-bg)" }}>
        <Canvas>
          <ambientLight intensity={0.9} />
          <directionalLight position={[120, 200, 80]} intensity={0.75} />
          <MapScene />
          <InitialCamera />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            target={SCENE_TARGET}
            maxPolarAngle={Math.PI * 0.47}
            minDistance={8}
            maxDistance={400}
          />
        </Canvas>
      </div>
    </PanelCard>
  );
}
