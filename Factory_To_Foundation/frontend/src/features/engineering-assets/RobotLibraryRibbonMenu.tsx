import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import "@/framework/workspace/Workspace.css";

import RobotLibraryBrowse from "./RobotLibraryBrowse";
import RobotLibraryDetail from "./RobotLibraryDetail";
import RobotLibraryInspector from "./RobotLibraryInspector";

type Rect = { top: number; left: number; width: number; height: number };
type EdgeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DragHandle = EdgeHandle | "move";
type DragOrigin = { x: number; y: number; rect: Rect };

const MIN_WIDTH = 620;
const MIN_HEIGHT = 320;

/**
 * Module-level, not component state: DropdownMenu only renders `children`
 * while the menu is open (`{open && <div className="dropdown-menu-panel">
 * {children}</div>}`), so this component unmounts on every close. A
 * useState here would forget the size every time. Resets on a full page
 * reload, which is fine -- "remembers across close/reopen this session"
 * was the actual ask, not durable persistence.
 */
let lastRect: Rect | null = null;
let wasMaximized = false;

function getBounds(): Rect {
  // FeaturePage renders exactly one <main> per page -- its own content
  // area, already excluding the sidebar and the command ribbon. Measuring
  // it at runtime (instead of hardcoding sidebar-width/ribbon-height
  // constants) means this keeps working correctly if either ever changes.
  const main = document.querySelector("main");
  const rect = main?.getBoundingClientRect();
  if (!rect) {
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  }
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function clampRect(rect: Rect, bounds: Rect): Rect {
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), bounds.width);
  const height = Math.min(Math.max(rect.height, MIN_HEIGHT), bounds.height);
  const left = Math.min(Math.max(rect.left, bounds.left), bounds.left + bounds.width - width);
  const top = Math.min(Math.max(rect.top, bounds.top), bounds.top + bounds.height - height);
  return { top, left, width, height };
}

function defaultRect(bounds: Rect): Rect {
  const width = Math.min(760, bounds.width - 32);
  const height = Math.min(480, bounds.height - 32);
  return clampRect({ top: bounds.top + 16, left: bounds.left + 16, width, height }, bounds);
}

function applyHandle(handle: DragHandle, origin: DragOrigin, dx: number, dy: number): Rect {
  if (handle === "move") {
    return { ...origin.rect, top: origin.rect.top + dy, left: origin.rect.left + dx };
  }
  let { top, left, width, height } = origin.rect;
  if (handle.includes("e")) width = origin.rect.width + dx;
  if (handle.includes("s")) height = origin.rect.height + dy;
  if (handle.includes("w")) {
    width = origin.rect.width - dx;
    left = origin.rect.left + dx;
  }
  if (handle.includes("n")) {
    height = origin.rect.height - dy;
    top = origin.rect.top + dy;
  }
  return { top, left, width, height };
}

/**
 * Factory command-ribbon content for the "Robot Library" dropdown.
 *
 * Deliberately NOT a rebuild: RobotLibraryBrowse/Detail/Inspector are
 * reused completely unchanged (same components since Phase 5) -- only the
 * surrounding window chrome is new.
 *
 * This is a real resizable workspace window, not a CSS `resize: both`
 * panel (tried first -- see git history -- correct as far as it went, but
 * couldn't support left-edge resize, viewport-aware maximize, or a
 * restore step, since native resize only grows toward the bottom-right).
 * Root element uses `position: fixed` with explicit top/left/width/height
 * driven by pointer-event math, constrained to FeaturePage's own <main>
 * content area (never covers the sidebar).
 *
 * Kept as a plain child of DropdownMenu's `children` slot rather than a
 * React portal, specifically so DropdownMenu's own click-outside-closes
 * detection (`containerRef.current.contains(event.target)`, a DOM
 * containment check) keeps working correctly -- `position: fixed` moves
 * where an element is painted, not its place in the DOM tree, so this
 * stays a real descendant of the trigger's container even while visually
 * floating anywhere in the Factory workspace. A portal into document.body
 * would break that containment check and make every click inside this
 * window register as an "outside click" that closes the dropdown.
 *
 * Drag state deliberately uses useState/useEffect, not useRef -- this
 * project's lint config flags any `.current` read/write reachable from a
 * function created during render (a React Compiler correctness rule), and
 * every drag handler here is exactly that kind of function.
 *
 * One accepted minor cosmetic side effect: DropdownMenu.css's own
 * `.dropdown-menu-panel` wrapper sizes itself to its content, and a
 * `position: fixed` child contributes no size to that calculation, so the
 * wrapper collapses to a small padding+border box near the trigger
 * button. This window renders on top of and around that exact corner in
 * its default position, so it isn't visible in normal use -- not fixed
 * further since doing so would mean editing DropdownMenu.tsx/css, shared
 * by every other ribbon menu (Metrics/Filters/Instructions), for a
 * one-consumer cosmetic concern.
 */
export default function RobotLibraryRibbonMenu() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [rect, setRect] = useState<Rect>(() => {
    const bounds = getBounds();
    return lastRect ? clampRect(lastRect, bounds) : defaultRect(bounds);
  });
  const [maximized, setMaximized] = useState(wasMaximized);
  const [preMaximizeRect, setPreMaximizeRect] = useState<Rect>(rect);
  const [activeHandle, setActiveHandle] = useState<DragHandle | null>(null);
  const [dragOrigin, setDragOrigin] = useState<DragOrigin | null>(null);

  useEffect(() => {
    lastRect = rect;
    wasMaximized = maximized;
  }, [rect, maximized]);

  useEffect(() => {
    function handleWindowResize() {
      setRect((r) => clampRect(r, getBounds()));
    }
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    if (!activeHandle || !dragOrigin) return;

    function handleMove(e: PointerEvent) {
      const dx = e.clientX - dragOrigin!.x;
      const dy = e.clientY - dragOrigin!.y;
      setRect(clampRect(applyHandle(activeHandle!, dragOrigin!, dx, dy), getBounds()));
    }
    function handleUp() {
      setActiveHandle(null);
      setDragOrigin(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [activeHandle, dragOrigin]);

  function startDrag(handle: DragHandle) {
    return (e: React.PointerEvent) => {
      if (maximized) return; // moving/resizing a maximized window isn't a meaningful action
      e.preventDefault();
      setActiveHandle(handle);
      setDragOrigin({ x: e.clientX, y: e.clientY, rect });
    };
  }

  function toggleMaximize() {
    if (maximized) {
      setRect(clampRect(preMaximizeRect, getBounds()));
      setMaximized(false);
    } else {
      setPreMaximizeRect(rect);
      setRect(getBounds());
      setMaximized(true);
    }
  }

  const cursorFor: Record<EdgeHandle, string> = {
    n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
    ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
  };
  const EDGE_HIT = 6;
  const CORNER_HIT = 12;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        zIndex: 40,
      }}
      className="flex flex-col rounded-md border bg-white shadow-xl"
    >
      <div
        onPointerDown={startDrag("move")}
        className="flex items-center justify-between border-b px-3 py-1.5 shrink-0"
        style={{ borderColor: "var(--ff-panel-border)", cursor: maximized ? "default" : "move" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
          Robot Library
        </span>
        <button
          type="button"
          onClick={toggleMaximize}
          onPointerDown={(e) => e.stopPropagation()}
          title={maximized ? "Restore" : "Maximize"}
          className="rounded p-1 hover:bg-gray-100"
        >
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      <div className="flex-1 p-2 min-h-0">
        <Group orientation="horizontal" className="workspace">
          <Panel id="robot-library-browse-panel" defaultSize="26%" minSize="18%">
            <RobotLibraryBrowse activeId={selectedId} onSelect={setSelectedId} />
          </Panel>

          <Separator id="robot-library-browse-divider" className="resize-handle" />

          <Panel id="robot-library-detail-panel" defaultSize="48%" minSize="30%">
            <RobotLibraryDetail selectedId={selectedId} />
          </Panel>

          <Separator id="robot-library-inspector-divider" className="resize-handle" />

          <Panel id="robot-library-inspector-panel" defaultSize="26%" minSize="18%">
            <RobotLibraryInspector selectedId={selectedId} />
          </Panel>
        </Group>
      </div>

      {!maximized && (
        <>
          {/* Edges */}
          <div onPointerDown={startDrag("n")} style={{ position: "absolute", top: -EDGE_HIT / 2, left: CORNER_HIT, right: CORNER_HIT, height: EDGE_HIT, cursor: cursorFor.n }} />
          <div onPointerDown={startDrag("s")} style={{ position: "absolute", bottom: -EDGE_HIT / 2, left: CORNER_HIT, right: CORNER_HIT, height: EDGE_HIT, cursor: cursorFor.s }} />
          <div onPointerDown={startDrag("w")} style={{ position: "absolute", left: -EDGE_HIT / 2, top: CORNER_HIT, bottom: CORNER_HIT, width: EDGE_HIT, cursor: cursorFor.w }} />
          <div onPointerDown={startDrag("e")} style={{ position: "absolute", right: -EDGE_HIT / 2, top: CORNER_HIT, bottom: CORNER_HIT, width: EDGE_HIT, cursor: cursorFor.e }} />
          {/* Corners */}
          <div onPointerDown={startDrag("nw")} style={{ position: "absolute", top: -CORNER_HIT / 2, left: -CORNER_HIT / 2, width: CORNER_HIT, height: CORNER_HIT, cursor: cursorFor.nw }} />
          <div onPointerDown={startDrag("ne")} style={{ position: "absolute", top: -CORNER_HIT / 2, right: -CORNER_HIT / 2, width: CORNER_HIT, height: CORNER_HIT, cursor: cursorFor.ne }} />
          <div onPointerDown={startDrag("sw")} style={{ position: "absolute", bottom: -CORNER_HIT / 2, left: -CORNER_HIT / 2, width: CORNER_HIT, height: CORNER_HIT, cursor: cursorFor.sw }} />
          <div onPointerDown={startDrag("se")} style={{ position: "absolute", bottom: -CORNER_HIT / 2, right: -CORNER_HIT / 2, width: CORNER_HIT, height: CORNER_HIT, cursor: cursorFor.se }} />
        </>
      )}
    </div>
  );
}
