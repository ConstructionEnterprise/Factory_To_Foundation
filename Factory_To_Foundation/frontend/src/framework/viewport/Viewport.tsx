import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { CameraContext, type Bounds, type Camera } from "./CameraContext";
import "./Viewport.css";

type ViewportProps = {
  /** GraphCanvas, ViewportControls, or any other camera-aware content. */
  children: ReactNode;
  /**
   * World-space bounds of whatever the viewport is displaying.
   * When provided, the viewport fits itself to these bounds on mount,
   * whenever they change, and on double-click / Reset View.
   * When omitted, double-click / Reset View return the camera to origin.
   */
  contentBounds?: Bounds;
  minZoom?: number;
  maxZoom?: number;
};

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };
const FIT_PADDING = 60;

/**
 * A fixed-size, clipping camera viewport — the CAD/Figma/Blender pattern.
 * Owns pan, zoom, and fit-to-content. Never lets its content overflow the
 * browser; the camera moves instead of the DOM growing.
 *
 * This component is intentionally generic: it doesn't know or care what
 * it's showing. Anything rendered inside it (e.g. GraphCanvas) reads the
 * camera via useCamera() and applies its own CSS transform.
 */
export default function Viewport({
  children,
  contentBounds,
  minZoom = 0.2,
  maxZoom = 3,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ lastX: number; lastY: number } | null>(null);

  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [isDragging, setIsDragging] = useState(false);

  const clampZoom = useCallback(
    (zoom: number) => Math.min(maxZoom, Math.max(minZoom, zoom)),
    [minZoom, maxZoom]
  );

  const fitToBounds = useCallback(
    (bounds: Bounds) => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
      const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);

      const zoomX = (rect.width - FIT_PADDING * 2) / boundsWidth;
      const zoomY = (rect.height - FIT_PADDING * 2) / boundsHeight;
      const zoom = clampZoom(Math.min(zoomX, zoomY));

      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;

      setCamera({
        zoom,
        x: rect.width / 2 - centerX * zoom,
        y: rect.height / 2 - centerY * zoom,
      });
    },
    [clampZoom]
  );

  const reset = useCallback(() => {
    if (contentBounds) {
      fitToBounds(contentBounds);
    } else {
      setCamera(DEFAULT_CAMERA);
    }
  }, [contentBounds, fitToBounds]);

  // Fit to content once bounds are known, and whenever they actually change
  // (compared by value, not by object identity — callers may recompute
  // bounds on every render without that forcing a re-fit and stomping on
  // the user's current pan/zoom).
  useEffect(() => {
    if (contentBounds) {
      fitToBounds(contentBounds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contentBounds?.minX,
    contentBounds?.minY,
    contentBounds?.maxX,
    contentBounds?.maxY,
  ]);

  const handleMouseDown = (event: ReactMouseEvent) => {
    if (event.button !== 0) return; // left button only
    dragRef.current = { lastX: event.clientX, lastY: event.clientY };
    setIsDragging(true);
  };

  const handleMouseMove = (event: ReactMouseEvent) => {
    if (!dragRef.current) return;

    const dx = event.clientX - dragRef.current.lastX;
    const dy = event.clientY - dragRef.current.lastY;
    dragRef.current = { lastX: event.clientX, lastY: event.clientY };

    setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
  };

  const stopDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleWheel = (event: ReactWheelEvent) => {
    event.preventDefault();

    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    setCamera((c) => {
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nextZoom = clampZoom(c.zoom * factor);

      // Keep the point under the cursor fixed while zooming.
      const worldX = (cursorX - c.x) / c.zoom;
      const worldY = (cursorY - c.y) / c.zoom;

      return {
        zoom: nextZoom,
        x: cursorX - worldX * nextZoom,
        y: cursorY - worldY * nextZoom,
      };
    });
  };

  const handleDoubleClick = () => {
    if (contentBounds) fitToBounds(contentBounds);
  };

  return (
    <CameraContext.Provider value={{ camera, setCamera, fitToBounds, reset }}>
      <div
        ref={containerRef}
        className={`viewport${isDragging ? " viewport--dragging" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {children}
      </div>
    </CameraContext.Provider>
  );
}
