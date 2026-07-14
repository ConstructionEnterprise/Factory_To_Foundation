import { createContext, useContext } from "react";

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type CameraContextValue = {
  camera: Camera;
  setCamera: (camera: Camera) => void;
  fitToBounds: (bounds: Bounds) => void;
  reset: () => void;
};

export const CameraContext = createContext<CameraContextValue | undefined>(
  undefined
);

/**
 * Read/drive the camera of the nearest enclosing <Viewport>.
 * Must be called from a component rendered inside a Viewport.
 */
export function useCamera() {
  const context = useContext(CameraContext);

  if (!context) {
    throw new Error("useCamera must be used inside a <Viewport>.");
  }

  return context;
}
