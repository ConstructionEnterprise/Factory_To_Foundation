import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";

import { Legend, PanelCard } from "@/framework/ui";

import { PROJECTED_COUNTIES, PROJECTED_ROADS } from "@/features/construction/projectedMapData";
import { FACTORY_COORDS, FACTORY_NODE } from "@/features/construction/constructionLocations";
import type { MapXZ } from "@/features/construction/mapProjection";

/**
 * Logistics Enterprises Map (Phase 2 of the Logistics brief) — real North
 * Texas county context + the real Interstate/US/State highway network
 * (same real projectedMapData.ts source Construction's map's "Roads"
 * toggle uses), rendered as THIS map's actual subject rather than a
 * supporting layer: thicker lines, more saturated color. Same bespoke
 * react-three-fiber pattern proven three times now (Manufacturing's
 * GeometryViewport, Factory's FactoryGeometryViewport, Construction's
 * ConstructionMap) — manual initial-camera + explicit OrbitControls
 * target, since drei's `Bounds` fit is confirmed unreliable alongside
 * OrbitControls in this codebase.
 *
 * Real, honest scope for this phase: county outlines + roads + the real
 * Chappell International factory location, camera defaulting there (its
 * real Saginaw, TX geography — every F»F corridor's real origin). Real
 * dispatch/truck/module data and corridor-click cross-navigation are later
 * phases (4/6 real data, 3 cross-nav) — this is the base map they'll land
 * markers/routes on, not yet wired to either.
 *
 * Route names are click-to-reveal, not always-on (a real usability change
 * from the first version of this map, which showed always-on labels and
 * hit a real duplicate/overlap bug — see the label-normalization comment
 * below for that history). Click a road/highway to show its real name;
 * Ctrl/Cmd-click adds more to the selection; clicking empty space (or a
 * county) clears it. This also sidesteps the earlier proximity-dedup
 * problem entirely — only what's explicitly selected ever shows text, so
 * automatic label clutter can't recur.
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
const SELECTED_COLOR = "#f2c94c";
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

/** Real thin lines are hard to hit with three.js's default raycast
 * threshold at this map's km-scale coordinates — widens it once so
 * clicking a road is actually reliable, not pixel-perfect-only. */
function RaycastTuning() {
  const { raycaster } = useThree();
  useLayoutEffect(() => {
    raycaster.params.Line = { threshold: 1.5 };
  }, [raycaster]);
  return null;
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
      {/* raycast disabled — a county click should fall through to the
          background plane's clear-selection handler, never swallow it. */}
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} raycast={() => null}>
        <meshBasicMaterial color={county.core ? COUNTY_FILL_CORE : COUNTY_FILL_NEIGHBOR} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {county.rings.map((ring, i) => (
        <Line key={i} points={ring.map((p) => [p.x, 0.01, p.z] as [number, number, number])} color={COUNTY_BORDER} lineWidth={1} raycast={() => null} />
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

// ── Label normalization ──
// Real bug found live in the first version of this map: labels were
// duplicating/overlapping (e.g. "President George Bush Hwy" and
// "President George Bush Tpke" both rendering, "I- 635"/"635"/"I-635 Hov"
// all rendering separately). Root cause, confirmed against the real data:
// TIGER's own source fields are populated inconsistently across real
// segments of the SAME corridor (a literal stray-space formatting
// artifact, a bare route number on some segments vs. "I-<n>" on others, an
// HOV-lane-specific name for managed-lane segments of the same real
// interstate, an official corridor alternating between two generic
// road-type suffixes like "... Tpke" and "... Hwy"). This is NOT a
// geometric merge failure — differently-labeled real segments were never
// eligible to merge with each other in Phase 2's line-merge (grouped
// strictly by exact (class,label)), so the same real corridor legitimately
// produced multiple separate objects under different exact strings.
// Normalizing here groups them back into one real canonical, clickable
// route — this also means clicking ANY fragment of a multi-fragment named
// route (e.g. President George Bush Tpke's real 12 fragments) reveals the
// one correct canonical name, not an arbitrary fragment's own label.

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

type RouteGroup = {
  key: string;
  cls: "interstate" | "highway";
  label: string;
  centroid: MapXZ;
  geometry: THREE.BufferGeometry;
};

/** Real named routes, grouped by normalized corridor identity (both real
 * classes — the brief asks for "road or highway" click-to-reveal) — each
 * becomes one real clickable object combining every real fragment sharing
 * that canonical name. Real fragments with no label at all (66 of 1,367 —
 * TIGER carries no name for them) get no group at all; they still render
 * (see UNLABELED_GEOMETRY below), just never interactively. */
function buildRouteGroups(): RouteGroup[] {
  const groups = new Map<string, { cls: "interstate" | "highway"; members: string[]; points: MapXZ[]; segments: [MapXZ, MapXZ][] }>();
  for (const road of PROJECTED_ROADS) {
    if (!road.label) continue;
    const normalized = normalizeRouteLabel(road.label);
    const groupKey = routeGroupKey(normalized);
    const key = `${road.class}|${groupKey}`;
    if (!groups.has(key)) groups.set(key, { cls: road.class, members: [], points: [], segments: [] });
    const g = groups.get(key)!;
    g.members.push(normalized);
    g.points.push(...road.points);
    for (let i = 0; i < road.points.length - 1; i++) g.segments.push([road.points[i], road.points[i + 1]]);
  }

  return Array.from(groups.entries()).map(([key, g]) => {
    const cx = g.points.reduce((s, p) => s + p.x, 0) / g.points.length;
    const cz = g.points.reduce((s, p) => s + p.z, 0) / g.points.length;
    const positions: number[] = [];
    for (const [a, b] of g.segments) positions.push(a.x, ROADS_Y, a.z, b.x, ROADS_Y, b.z);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return { key, cls: g.cls, label: canonicalDisplayLabel(g.members), centroid: { x: cx, z: cz }, geometry };
  });
}

const ROUTE_GROUPS = buildRouteGroups();

/** Real unlabeled fragments, merged per class same as before — rendered so
 * the road network still looks visually complete, but never interactive
 * (raycast disabled): there's no real name to reveal for these. */
function buildUnlabeledGeometry(cls: "interstate" | "highway"): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const road of PROJECTED_ROADS) {
    if (road.class !== cls || road.label) continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i], b = road.points[i + 1];
      positions.push(a.x, ROADS_Y, a.z, b.x, ROADS_Y, b.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

const UNLABELED_INTERSTATE_GEOMETRY = buildUnlabeledGeometry("interstate");
const UNLABELED_HIGHWAY_GEOMETRY = buildUnlabeledGeometry("highway");

function RouteGroupLine({ group, selected, onSelect }: { group: RouteGroup; selected: boolean; onSelect: (key: string, additive: boolean) => void }) {
  const baseColor = group.cls === "interstate" ? INTERSTATE_COLOR : HIGHWAY_COLOR;
  return (
    <group>
      <lineSegments
        geometry={group.geometry}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(group.key, e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <lineBasicMaterial
          color={selected ? SELECTED_COLOR : baseColor}
          transparent
          opacity={selected ? 1 : group.cls === "interstate" ? 0.95 : 0.85}
          linewidth={selected ? 3 : group.cls === "interstate" ? 2.5 : 1}
        />
      </lineSegments>
      {selected && (
        <Text
          position={[group.centroid.x, ROADS_Y + 0.02, group.centroid.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.6}
          color={SELECTED_COLOR}
          fillOpacity={0.95}
          fontWeight="bold"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#2b2b2b"
        >
          {group.label}
        </Text>
      )}
    </group>
  );
}

function FactoryLandmark() {
  return (
    <group position={[FACTORY_COORDS.x, 0.02, FACTORY_COORDS.z]}>
      <mesh position={[0, 0.6, 0]} raycast={() => null}>
        <boxGeometry args={[8, 1.2, 5]} />
        <meshStandardMaterial color={ACCENT} />
      </mesh>
      <mesh position={[5.2, 0.35, 1]} raycast={() => null}>
        <boxGeometry args={[2.2, 0.7, 2.6]} />
        <meshStandardMaterial color={ACCENT} />
      </mesh>
      <Text position={[0, 0.03, 4.2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.9} color={TEXT_SECONDARY} fontWeight="bold" anchorX="center" anchorY="top">
        {FACTORY_NODE.title}
      </Text>
    </group>
  );
}

function MapScene({ selectedKeys, onSelect, onClear }: { selectedKeys: Set<string>; onSelect: (key: string, additive: boolean) => void; onClear: () => void }) {
  return (
    <group>
      {/* Background plane — any click that isn't on a road/highway lands
          here and clears the selection (unless Ctrl/Cmd is held, in which
          case a stray background click during a multi-select shouldn't
          wipe it out). */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!(e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)) onClear();
        }}
      >
        <planeGeometry args={[600, 600]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {PROJECTED_COUNTIES.map((c) => (
        <CountyOutline key={c.name} county={c} />
      ))}

      <lineSegments geometry={UNLABELED_HIGHWAY_GEOMETRY} raycast={() => null}>
        <lineBasicMaterial color={HIGHWAY_COLOR} transparent opacity={0.85} />
      </lineSegments>
      <lineSegments geometry={UNLABELED_INTERSTATE_GEOMETRY} raycast={() => null}>
        <lineBasicMaterial color={INTERSTATE_COLOR} transparent opacity={0.95} linewidth={2.5} />
      </lineSegments>

      {ROUTE_GROUPS.map((g) => (
        <RouteGroupLine key={g.key} group={g} selected={selectedKeys.has(g.key)} onSelect={onSelect} />
      ))}

      <FactoryLandmark />
    </group>
  );
}

export default function LogisticsMap() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const handleSelect = (key: string, additive: boolean) => {
    setSelectedKeys((prev) => {
      if (!additive) return prev.has(key) && prev.size === 1 ? new Set() : new Set([key]);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const handleClear = () => setSelectedKeys(new Set());

  return (
    <PanelCard title="Logistics Enterprises Map" className="h-[560px]" bodyClassName="flex flex-col flex-1">
      <div className="flex flex-wrap items-center gap-6 px-6 py-4 border-b border-gray-100">
        <Legend color={INTERSTATE_COLOR} label="Interstate / Controlled-Access Highway" />
        <Legend color={HIGHWAY_COLOR} label="US / State Highway" />
        <Legend color={ACCENT} label="Chappell International (F»F hub)" />
        <span className="text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Click a road for its name — Ctrl/Cmd-click to select more than one
        </span>
      </div>

      <div className="relative flex-1" style={{ background: "var(--ff-content-bg)" }}>
        <Canvas>
          <ambientLight intensity={0.9} />
          <directionalLight position={[120, 200, 80]} intensity={0.75} />
          <MapScene selectedKeys={selectedKeys} onSelect={handleSelect} onClear={handleClear} />
          <InitialCamera />
          <RaycastTuning />
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
