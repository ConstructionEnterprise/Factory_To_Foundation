import { useSyncExternalStore } from "react";

import { aabbsOverlap, mergeAabbs, primAabb, testBodies, type Aabb } from "./collisionEngine";
import { buildCollisionBodies, isExcludedPair, pairKey, type CollisionBody } from "./collisionGeometry";
import type { TwinState } from "./useTwinState";
import { TWIN_BRIDGE_URL } from "@/lib/env";

/**
 * Live collision monitor — polls the twin bridge on its own fast cadence
 * and runs the real collision engine against every NEW observed frame.
 *
 * Sampling basis, stated honestly (this is the report's fidelity
 * ceiling, disclosed wherever results are shown): the twin writes
 * state.json every 10 animation frames (~135 ms measured); this poll
 * runs at 150 ms so essentially every WRITTEN snapshot is checked —
 * far finer than the UI's own 750 ms display poll — but sim ticks
 * BETWEEN writes (up to ~10 per write at speed 1, ~100 at speed 10)
 * are genuinely unobserved. No interpolation is fabricated to fill
 * those gaps: a fast transient that starts and ends entirely between
 * two written snapshots is honestly invisible to this monitor.
 */
const BRIDGE_URL = `${TWIN_BRIDGE_URL}/twin-state`;
const POLL_MS = 150;
const BROAD_PHASE_MARGIN = 0.05;

export type CollisionEvent = {
  id: number;
  a: string;
  b: string;
  /** Real sim tick (state.json `frame`) of the first observed intersecting snapshot. */
  startFrame: number;
  /** Real sim tick of the last observed intersecting snapshot. */
  endFrame: number;
  /** Exact max penetration depth seen across the event's observed snapshots (m). */
  maxPenetration: number;
  /** How many observed snapshots showed the intersection — the real measurement resolution of this event. */
  samples: number;
  ongoing: boolean;
  /**
   * True while the contact has held in EVERY snapshot since monitoring
   * began — the measurable signature of a by-construction condition
   * (static overlaps in the source constants, the table plane overhanging
   * the rails, a robot already parked against its rack). Not a hardcoded
   * pair list: if such a contact ever ends, the event closes and moves to
   * the transient log like any other.
   */
  persistent: boolean;
};

export type RobotPairStat = {
  pair: string;
  a: string;
  b: string;
  /** Exact minimum arm-to-arm distance observed (m) — segment closed-form, not approximated. */
  minDistance: number;
  atFrame: number;
};

export type CollisionSnapshot = {
  monitoring: boolean;
  connected: boolean;
  /** Last observed sim tick. */
  lastFrame: number | null;
  /** Sim tick at which monitoring began observing. */
  firstFrame: number | null;
  /** Snapshots actually checked so far. */
  checkedSnapshots: number;
  /** Subsystem ids currently in at least one real intersection. */
  activeContactIds: string[];
  events: CollisionEvent[];
  robotPairStats: RobotPairStat[];
};

let snapshot: CollisionSnapshot = {
  monitoring: false,
  connected: false,
  lastFrame: null,
  firstFrame: null,
  checkedSnapshots: 0,
  activeContactIds: [],
  events: [],
  robotPairStats: [],
};

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let nextEventId = 1;
const openEvents = new Map<string, CollisionEvent>();
const closedEvents: CollisionEvent[] = [];
const robotStats = new Map<string, RobotPairStat>();

function emit(next: Partial<CollisionSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

function closeAllOpenEvents() {
  for (const ev of openEvents.values()) {
    ev.ongoing = false;
    closedEvents.push(ev);
  }
  openEvents.clear();
}

function processFrame(state: TwinState) {
  const frame = state.frame;
  const prevFrame = snapshot.lastFrame;

  // Twin reset (frame counter went backwards): close events honestly
  // rather than stitching two different runs into one event, and
  // re-baseline persistence — contacts present at the first snapshot of
  // the NEW run are by-construction again, not transients of the old one.
  if (prevFrame !== null && frame < prevFrame) {
    closeAllOpenEvents();
    snapshot = { ...snapshot, firstFrame: null };
  }

  const bodies = buildCollisionBodies(state);
  const aabbs = new Map<string, Aabb>(bodies.map((b) => [b.id, mergeAabbs(b.prims.map(primAabb))]));

  const contactsThisFrame = new Map<string, { a: CollisionBody; b: CollisionBody; maxPenetration: number }>();

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (isExcludedPair(a.id, b.id)) continue;

      const bothRobots = a.id.startsWith("robots.") && b.id.startsWith("robots.");
      // Robot-robot pairs always run narrow phase so their exact minimum
      // distance is tracked continuously (the arms are the shapes that
      // genuinely approach each other); everything else earns narrow
      // phase only when body AABBs come near.
      if (!bothRobots && !aabbsOverlap(aabbs.get(a.id)!, aabbs.get(b.id)!, BROAD_PHASE_MARGIN)) continue;

      const result = testBodies(a.prims, b.prims);

      if (bothRobots && result.minDistance !== undefined) {
        const key = pairKey(a.id, b.id);
        const prev = robotStats.get(key);
        if (!prev || result.minDistance < prev.minDistance) {
          robotStats.set(key, { pair: key, a: a.id, b: b.id, minDistance: result.minDistance, atFrame: frame });
        }
      }

      if (result.intersecting) {
        contactsThisFrame.set(pairKey(a.id, b.id), { a, b, maxPenetration: result.maxPenetration });
      }
    }
  }

  // Merge into events: extend open ones, open new ones, close vanished ones.
  for (const [key, contact] of contactsThisFrame) {
    const open = openEvents.get(key);
    if (open) {
      open.endFrame = frame;
      open.samples += 1;
      if (contact.maxPenetration > open.maxPenetration) open.maxPenetration = contact.maxPenetration;
    } else {
      openEvents.set(key, {
        id: nextEventId++,
        a: contact.a.id,
        b: contact.b.id,
        startFrame: frame,
        endFrame: frame,
        maxPenetration: contact.maxPenetration,
        samples: 1,
        ongoing: true,
        persistent: snapshot.firstFrame === null, // only pre-existing at the very first checked snapshot
      });
    }
  }
  for (const [key, ev] of openEvents) {
    if (!contactsThisFrame.has(key)) {
      ev.ongoing = false;
      ev.persistent = false; // it ended — by definition no longer a by-construction condition
      closedEvents.push(ev);
      openEvents.delete(key);
    }
  }

  const activeIds = new Set<string>();
  for (const { a, b } of contactsThisFrame.values()) {
    activeIds.add(a.id);
    activeIds.add(b.id);
  }

  emit({
    connected: true,
    lastFrame: frame,
    firstFrame: snapshot.firstFrame ?? frame,
    checkedSnapshots: snapshot.checkedSnapshots + 1,
    activeContactIds: [...activeIds],
    events: [...openEvents.values(), ...closedEvents].sort((x, y) => y.startFrame - x.startFrame),
    robotPairStats: [...robotStats.values()].sort((x, y) => x.minDistance - y.minDistance),
  });
}

async function poll() {
  try {
    const res = await fetch(BRIDGE_URL, { credentials: "include" });
    if (!res.ok) throw new Error(`bridge ${res.status}`);
    const state = (await res.json()) as TwinState;
    if (state.frame === snapshot.lastFrame) {
      if (!snapshot.connected) emit({ connected: true });
      return; // same written snapshot — nothing new to check
    }
    processFrame(state);
  } catch {
    if (snapshot.connected) emit({ connected: false });
  }
}

/** Idempotent — first caller starts the session-long monitor; the run log persists across tab switches the way a real run log should. */
export function startCollisionMonitor() {
  if (timer !== null) return;
  timer = setInterval(poll, POLL_MS);
  poll();
  emit({ monitoring: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CollisionSnapshot {
  return snapshot;
}

export function useCollisionSnapshot(): CollisionSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
